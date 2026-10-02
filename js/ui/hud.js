// ============================================================
//  HUD 控制器：按钮绑定 + 计数/时段文本刷新 + 提示条
// ============================================================

import { t } from './i18n.js';
import { collection, theme, dayNight, perf } from '../core/state.js';
import { JELLY_KEYS } from './locales.js';

export function createHud(actions) {
  const el = {
    dex: document.getElementById('dex'),
    dexText: document.getElementById('dex-text'),
    pauseBtn: document.getElementById('pause-btn'),
    phase: document.getElementById('phase-text'),
    themeText: document.getElementById('theme-text'),
    fps: document.getElementById('fps-text'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    feedBtn: document.getElementById('feed-btn'),
    currentBtn: document.getElementById('current-btn'),
    labBtn: document.getElementById('lab-btn'),
    bioText: document.getElementById('bio-text'),
    atlasBtn: document.getElementById('atlas-btn'),
    buildBtn: document.getElementById('build-btn'),
    zoneText: document.getElementById('zone-text'),
    worldText: document.getElementById('world-text'),
    ach: document.getElementById('ach'),
    achText: document.getElementById('ach-text'),
    nestBtn: document.getElementById('nest-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    // 右下角 FAB（玩法按钮收纳）+ 图鉴面板分享钮
    fab: document.getElementById('fab'),
    fabMain: document.getElementById('fab-main'),
    fabTray: document.getElementById('fab-tray'),
    dexShare: document.getElementById('dex-share'),
  };

  let toastTimer = null;

  function toast(key) {
    if (!el.toast) return;
    el.toast.textContent = t(key);
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  /** 带参数的 toast */
  function toastKey(key, params) {
    if (!el.toast) return;
    el.toast.textContent = t(key, params);
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
  }

  /** 直接给出文本的 toast（隐藏纪念内容的匈牙利语开场白等） */
  function toastText(text) {
    if (!el.toast || text == null) return;
    el.toast.textContent = text;
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 4200);
  }

  function refreshDex() {
    if (!el.dexText) return;
    el.dexText.textContent = t('dex.label', {
      n: collection.found.size,
      total: collection.total,
    });
    if (el.dex) el.dex.classList.toggle('complete', collection.found.size >= collection.total);
  }

  function refreshPhase() {
    if (!el.phase) return;
    const s = dayNight.sun;
    let key = 'phase.noon';
    if (s < 0.38) key = 'phase.night';
    else if (s < 0.62) key = (dayNight.phase % 1) < 0.5 ? 'phase.dawn' : 'phase.dusk';
    el.phase.textContent = dayNight.enabled ? t(key) : '—';
  }

  function refreshTheme() {
    if (el.themeText) el.themeText.textContent = t('theme.' + theme.name);
  }

  /** 刷新成就星标 n/total */
  function refreshAch(n) {
    if (n == null) return;
    if (el.achText) {
      el.achText.textContent = t('ach.label', { n, total: 6 });
    }
    if (el.ach) el.ach.classList.toggle('complete', n >= 6);
  }

  /** 归巢玩法按钮高亮 */
  function refreshActivity(active) {
    if (el.nestBtn) el.nestBtn.classList.toggle('active', !!active);
  }

  /** 生物荧光余额 */
  function refreshBio(n) {
    if (el.bioText) el.bioText.textContent = t('bio.label', { n: n | 0 });
  }

  /** 当前海域名 */
  function refreshZone(labelKey) {
    if (el.zoneText) el.zoneText.textContent = t(labelKey);
  }

  /**
   * 阶段十：当前群系（世界）+ 种子显示。
   * 罕见蘑菇海追加标记；种子可抄写分享。
   */
  function refreshWorld(worldType, seedStr, forced) {
    if (!el.worldText) return;
    const name = t('world.' + worldType);
    const rare = forced ? ' ✦' : '';
    const seed = seedStr ? ` · ${t('create.seedShort')} ${seedStr}` : '';
    el.worldText.textContent = `${name}${rare}${seed}`;
  }

  function refreshButtons() {
    if (el.feedBtn) el.feedBtn.classList.toggle('active', !!actions.isFeedMode && actions.isFeedMode());
    if (el.currentBtn) el.currentBtn.classList.toggle('active', !!actions.isCurrentMode && actions.isCurrentMode());
    // FAB 上的小金点：喂食/洋流模式进行中，提醒孩子"有事情在发生"
    if (el.fab) {
      const modeOn = (!!actions.isFeedMode && actions.isFeedMode()) ||
                     (!!actions.isCurrentMode && actions.isCurrentMode());
      el.fab.classList.toggle('mode-on', !!modeOn);
    }
    if (el.hint) el.hint.classList.toggle('feed', !!actions.isFeedMode && actions.isFeedMode());
    if (el.hint) el.hint.classList.toggle('current', !!actions.isCurrentMode && actions.isCurrentMode());
  }

  function refreshLang() {
    refreshDex(); refreshPhase(); refreshTheme();
  }
  // ---------- 右下角 FAB（玩法动作收纳） ----------
  let fabOpen = false;

  /** 托盘按钮沿 1/4 圆弧摆开（90° 正上 → 180° 正左），半径随视口缩放 */
  function layoutTray() {
    if (!el.fabTray) return;
    const btns = el.fabTray.querySelectorAll('.btn');
    const n = btns.length;
    if (!n) return;
    const mobile = Math.min(window.innerWidth, window.innerHeight) <= 620;
    const R = mobile ? 92 : 118;
    btns.forEach((b, i) => {
      const ang = Math.PI * (0.5 + 0.5 * (n > 1 ? i / (n - 1) : 0));
      // 屏幕坐标 y 向下：θ=90° → 正上 (0,-R)，θ=180° → 正左 (-R,0)
      const tx = Math.cos(ang) * R;
      const ty = -Math.sin(ang) * R;
      b.style.setProperty('--tx', tx.toFixed(1) + 'px');
      b.style.setProperty('--ty', ty.toFixed(1) + 'px');
    });
  }

  function setFab(open) {
    fabOpen = !!open;
    if (el.fab) el.fab.classList.toggle('open', fabOpen);
    if (el.fabMain) el.fabMain.setAttribute('aria-expanded', fabOpen ? 'true' : 'false');
    if (el.fabTray) el.fabTray.setAttribute('aria-hidden', fabOpen ? 'false' : 'true');
    if (fabOpen) layoutTray();
  }

  /** 闲置减淡：7 秒无输入 → 右下角操作区降透明度；FAB 展开期间不减淡 */
  let idleTimer = null;
  function pokeIdle() {
    document.body.classList.remove('hud-idle');
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!fabOpen) document.body.classList.add('hud-idle');
    }, 7000);
  }

  function bind() {
    if (el.feedBtn) el.feedBtn.addEventListener('click', () => actions.toggleFeed());
    if (el.currentBtn) el.currentBtn.addEventListener('click', () => actions.toggleCurrent && actions.toggleCurrent());
    if (el.labBtn) el.labBtn.addEventListener('click', () => actions.openLab && actions.openLab());
    if (el.atlasBtn) el.atlasBtn.addEventListener('click', () => actions.openAtlas && actions.openAtlas());
    if (el.buildBtn) el.buildBtn.addEventListener('click', () => actions.openBuild && actions.openBuild());
    if (el.nestBtn) el.nestBtn.addEventListener('click', () => actions.toggleActivity && actions.toggleActivity());
    if (el.settingsBtn) el.settingsBtn.addEventListener('click', () => actions.openSettings && actions.openSettings());
    if (el.dexShare) {
      el.dexShare.addEventListener('click', () => actions.share && actions.share());
      el.dexShare.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (actions.share) actions.share(); }
      });
    }

    // FAB 开合：点击 / 键盘；点托盘任一动作后自动收起（capture 阶段收起，动作照常触发）
    if (el.fabMain) {
      const toggleFab = () => setFab(!fabOpen);
      el.fabMain.addEventListener('click', toggleFab);
      el.fabMain.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFab(); }
      });
    }
    if (el.fabTray) el.fabTray.addEventListener('click', () => setFab(false), true);
    document.addEventListener('click', (e) => {
      if (fabOpen && el.fab && !el.fab.contains(e.target)) setFab(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fabOpen) setFab(false); });
    window.addEventListener('resize', () => { if (fabOpen) layoutTray(); });

    // 闲置减淡监听（任何输入立即恢复亮度）
    ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach((ev) => {
      window.addEventListener(ev, pokeIdle, { passive: true });
    });
    pokeIdle();

    if (el.dex) {
      el.dex.addEventListener('click', () => actions.openDex && actions.openDex());
      el.dex.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (actions.openDex) actions.openDex();
        }
      });
    }
    // 暂停按钮（右上角）：与 Esc 同一个入口
    if (el.pauseBtn) {
      const pause = () => actions.openPause && actions.openPause();
      el.pauseBtn.addEventListener('click', pause);
      el.pauseBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pause(); }
      });
    }
  }

  /** 绑定成就星标点击（回调由 main 注入，避免循环依赖） */
  function bindAch(onClick) {
    if (!el.ach) return;
    el.ach.addEventListener('click', onClick);
    el.ach.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    });
  }

  function setFps(v) {
    if (el.fps) el.fps.textContent = t('fps', { n: v });
  }

  return { bind, bindAch, refreshDex, refreshPhase, refreshTheme, refreshAch, refreshActivity, refreshBio, refreshZone, refreshWorld, refreshButtons, refreshLang, toast, toastKey, toastText, setFps, el };
}
