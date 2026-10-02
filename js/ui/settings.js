// ============================================================
//  设置面板
//  - 手动画质档（0 最高 / 1 / 2 省电），复用 setTier
//  - 减弱动效（联动 prefers-reduced-motion 的思路，手动覆盖）
//  - 静音记忆（持久化声音开关）
//  存储：localStorage 'ocean.settings'
// ============================================================

import { t } from './i18n.js';
import { setTier, setDensity, density, DENSITY_TIERS, perf, theme, dayNight, app } from '../core/state.js';

const STORAGE_KEY = 'ocean.settings';

function load() {
  const def = { tier: -1, reducedMotion: false, sound: false, density: 1 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const d = JSON.parse(raw);
    return Object.assign(def, d && typeof d === 'object' ? d : {});
  } catch (e) {
    return def;
  }
}

export function createSettings(actions = {}) {
  const el = {
    overlay: document.getElementById('settings-modal'),
    close: document.getElementById('settings-close'),
    title: document.getElementById('settings-title'),
    tier: document.getElementById('settings-tier'),
    densitySeg: document.getElementById('settings-density'),
    densityLabel: document.getElementById('settings-density-label'),
    motion: document.getElementById('settings-motion'),
    sound: document.getElementById('settings-sound'),
    tierLabel: document.getElementById('settings-tier-label'),
    motionLabel: document.getElementById('settings-motion-label'),
    soundLabel: document.getElementById('settings-sound-label'),
    // 自右下角移入的配置项：主题 / 语言 / 昼夜
    themeSeg: document.getElementById('settings-theme'),
    langSeg: document.getElementById('settings-lang'),
    daynight: document.getElementById('settings-daynight'),
    themeLabel: document.getElementById('settings-theme-label'),
    langLabel: document.getElementById('settings-lang-label'),
    daynightLabel: document.getElementById('settings-daynight-label'),
  };

  const state = load();
  let open = false;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }

  /** 应用减弱动效到 <html> */
  function applyMotion() {
    document.documentElement.classList.toggle('reduce-motion', !!state.reducedMotion);
  }

  /** 应用画质档（-1 表示自动） */
  function applyTier() {
    if (state.tier >= 0) {
      setTier(state.tier);
      if (actions.onAutoQuality) actions.onAutoQuality(false);
    } else {
      if (actions.onAutoQuality) actions.onAutoQuality(true);
    }
    // 画质档位变了会重算 quality（密度系数会一并乘进去），
    // 所以这里要再刷一次已保存的密度档，避免被档位基数覆盖。
    syncDensity();
  }

  /**
   * 把「已保存的密度档」同步进 state 并应用到 world。
   * 单独抽出来，是因为 applyTier 和「密度行点击」都要走这条路。
   * applyToWorld=true 时通知 main 做「热过渡」（补生成 / 裁远端），
   * 启动阶段不需要（世界还没生成，seedWorld 会直接按新密度铺）。
   */
  function syncDensity(applyToWorld) {
    setDensity(typeof state.density === 'number' ? state.density : 1);
    if (applyToWorld && actions.onDensityChange) actions.onDensityChange();
  }

  /** seg-group 通用构建（主题/语言沿用画质行的交互模式） */
  function buildSeg(container, options, isCurrent, onPick) {
    if (!container) return;
    container.innerHTML = '';
    for (const o of options) {
      const b = document.createElement('div');
      b.className = 'seg' + (isCurrent(o) ? ' active' : '');
      b.textContent = o.label;
      b.setAttribute('role', 'button');
      b.tabIndex = 0;
      const pick = () => { onPick(o); render(); };
      b.addEventListener('click', pick);
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      container.appendChild(b);
    }
  }

  function render() {
    if (el.title) el.title.textContent = t('settings.title');
    if (el.tierLabel) el.tierLabel.textContent = t('settings.quality');
    if (el.motionLabel) el.motionLabel.textContent = t('settings.reduceMotion');
    if (el.soundLabel) el.soundLabel.textContent = t('settings.sound');
    if (el.themeLabel) el.themeLabel.textContent = t('settings.theme');
    if (el.langLabel) el.langLabel.textContent = t('settings.language');
    if (el.daynightLabel) el.daynightLabel.textContent = t('settings.daynight');
    if (el.densityLabel) el.densityLabel.textContent = t('settings.density');

    if (el.tier) {
      const opts = [
        { v: -1, k: 'settings.quality.auto' },
        { v: 0, k: 'settings.quality.high' },
        { v: 1, k: 'settings.quality.medium' },
        { v: 2, k: 'settings.quality.low' },
      ];
      el.tier.innerHTML = '';
      for (const o of opts) {
        const b = document.createElement('div');
        b.className = 'seg' + (state.tier === o.v ? ' active' : '');
        b.textContent = t(o.k);
        b.setAttribute('role', 'button');
        b.tabIndex = 0;
        b.addEventListener('click', () => {
          state.tier = o.v;
          persist();
          applyTier();
          render();
        });
        b.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            state.tier = o.v;
            persist();
            applyTier();
            render();
          }
        });
        el.tier.appendChild(b);
      }
    }

    // 生物密度（三档：稀疏 / 标准 / 热闹）—— 与画质解耦的独立杠杆
    buildSeg(el.densitySeg, DENSITY_TIERS.map((d, i) => ({
      v: i, label: t('settings.density.' + d.key),
    })), (o) => state.density === o.v, (o) => {
      if (state.density === o.v) return;
      state.density = o.v;
      persist();
      syncDensity(true);           // 游戏中即时生效（热过渡）
      if (actions.onDensityToast) actions.onDensityToast(t('settings.density.' + DENSITY_TIERS[o.v].key));
    });

    // 主题（右下角"切换主题"钮移入于此；直接读 state.theme.name）
    buildSeg(el.themeSeg, [
      { v: 'shallow', label: t('theme.shallow') },
      { v: 'deep', label: t('theme.deep') },
    ], (o) => theme.name === o.v, (o) => { if (o.v !== theme.name) actions.setTheme && actions.setTheme(o.v); });

    // 语言（EN / 中文）
    buildSeg(el.langSeg, [
      { v: 'en', label: 'English' },
      { v: 'zh', label: '中文' },
    ], (o) => app.lang === o.v, (o) => { if (o.v !== app.lang) actions.setLang && actions.setLang(o.v); });

    if (el.motion) el.motion.classList.toggle('on', !!state.reducedMotion);
    if (el.sound) el.sound.classList.toggle('on', !!state.sound);
    if (el.daynight) el.daynight.classList.toggle('on', !!dayNight.enabled);
  }

  function show() {
    render();
    if (el.overlay) el.overlay.classList.remove('hide');
    open = true;
  }

  function hide() {
    if (el.overlay) el.overlay.classList.add('hide');
    open = false;
  }

  function toggle() { if (open) hide(); else show(); }

  function bind() {
    if (el.close) el.close.addEventListener('click', hide);
    if (el.overlay) {
      el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) hide(); });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });

    if (el.motion) {
      const toggleMotion = () => {
        state.reducedMotion = !state.reducedMotion;
        persist();
        applyMotion();
        render();
      };
      el.motion.addEventListener('click', toggleMotion);
      el.motion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMotion(); }
      });
    }
    if (el.sound) {
      const toggleSoundRow = () => {
        // 由 main 执行真正的音频开关，并回写状态
        const on = actions.toggleSound ? actions.toggleSound() : false;
        state.sound = !!on;
        persist();
        render();
      };
      el.sound.addEventListener('click', toggleSoundRow);
      el.sound.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSoundRow(); }
      });
    }
    // 昼夜循环开关（原右下角 daynight 钮移入于此；状态读 state.dayNight.enabled）
    if (el.daynight) {
      const toggleDayNightRow = () => {
        if (actions.toggleDayNight) actions.toggleDayNight();
        render();
      };
      el.daynight.addEventListener('click', toggleDayNightRow);
      el.daynight.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDayNightRow(); }
      });
    }
  }

  /** 启动时应用已保存的设置 */
  function init() {
    applyMotion();
    applyTier();
  }

  return {
    bind, init, show, hide, toggle, render,
    get state() { return state; },
    get isOpen() { return open; },
  };
}
