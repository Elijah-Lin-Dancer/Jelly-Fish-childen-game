// ============================================================
//  HUD 控制器：按钮绑定 + 计数/时段文本刷新 + 提示条
// ============================================================

import { t } from './i18n.js';
import { collection, theme, dayNight, app, perf } from '../core/state.js';
import { JELLY_KEYS } from './locales.js';

export function createHud(actions) {
  const el = {
    dex: document.getElementById('dex'),
    dexText: document.getElementById('dex-text'),
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
    themeBtn: document.getElementById('theme-btn'),
    soundBtn: document.getElementById('sound-btn'),
    langBtn: document.getElementById('lang-btn'),
    dnBtn: document.getElementById('daynight-btn'),
    ach: document.getElementById('ach'),
    achText: document.getElementById('ach-text'),
    nestBtn: document.getElementById('nest-btn'),
    shareBtn: document.getElementById('share-btn'),
    settingsBtn: document.getElementById('settings-btn'),
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
    if (el.langBtn) el.langBtn.textContent = app.lang === 'zh' ? '中' : 'EN';
    if (el.dnBtn) el.dnBtn.classList.toggle('muted', !dayNight.enabled);
    if (el.hint) el.hint.classList.toggle('feed', !!actions.isFeedMode && actions.isFeedMode());
    if (el.hint) el.hint.classList.toggle('current', !!actions.isCurrentMode && actions.isCurrentMode());
  }

  function refreshLang() {
    refreshDex(); refreshPhase(); refreshTheme();
  }
  function bind() {
    if (el.soundBtn) el.soundBtn.addEventListener('click', () => actions.toggleSound());
    if (el.langBtn) el.langBtn.addEventListener('click', () => actions.toggleLang());
    if (el.themeBtn) el.themeBtn.addEventListener('click', () => actions.toggleTheme());
    if (el.feedBtn) el.feedBtn.addEventListener('click', () => actions.toggleFeed());
    if (el.currentBtn) el.currentBtn.addEventListener('click', () => actions.toggleCurrent && actions.toggleCurrent());
    if (el.labBtn) el.labBtn.addEventListener('click', () => actions.openLab && actions.openLab());
    if (el.atlasBtn) el.atlasBtn.addEventListener('click', () => actions.openAtlas && actions.openAtlas());
    if (el.buildBtn) el.buildBtn.addEventListener('click', () => actions.openBuild && actions.openBuild());
    if (el.dnBtn) el.dnBtn.addEventListener('click', () => actions.toggleDayNight());
    if (el.nestBtn) el.nestBtn.addEventListener('click', () => actions.toggleActivity && actions.toggleActivity());
    if (el.shareBtn) el.shareBtn.addEventListener('click', () => actions.share && actions.share());
    if (el.settingsBtn) el.settingsBtn.addEventListener('click', () => actions.openSettings && actions.openSettings());
    if (el.dex) {
      el.dex.addEventListener('click', () => actions.openDex && actions.openDex());
      el.dex.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (actions.openDex) actions.openDex();
        }
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
