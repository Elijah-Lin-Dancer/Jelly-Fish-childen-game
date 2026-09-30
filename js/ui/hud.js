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
    themeBtn: document.getElementById('theme-btn'),
    soundBtn: document.getElementById('sound-btn'),
    langBtn: document.getElementById('lang-btn'),
    dnBtn: document.getElementById('daynight-btn'),
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

  function refreshButtons() {
    if (el.feedBtn) el.feedBtn.classList.toggle('active', !!actions.isFeedMode && actions.isFeedMode());
    if (el.langBtn) el.langBtn.textContent = app.lang === 'zh' ? '中' : 'EN';
    if (el.dnBtn) el.dnBtn.classList.toggle('muted', !dayNight.enabled);
    if (el.hint) el.hint.classList.toggle('feed', !!actions.isFeedMode && actions.isFeedMode());
  }

  function refreshLang() {
    refreshDex(); refreshPhase(); refreshTheme();
  }

  function bind() {
    if (el.soundBtn) el.soundBtn.addEventListener('click', () => actions.toggleSound());
    if (el.langBtn) el.langBtn.addEventListener('click', () => actions.toggleLang());
    if (el.themeBtn) el.themeBtn.addEventListener('click', () => actions.toggleTheme());
    if (el.feedBtn) el.feedBtn.addEventListener('click', () => actions.toggleFeed());
    if (el.dnBtn) el.dnBtn.addEventListener('click', () => actions.toggleDayNight());
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

  function setFps(v) {
    if (el.fps) el.fps.textContent = t('fps', { n: v });
  }

  return { bind, refreshDex, refreshPhase, refreshTheme, refreshButtons, refreshLang, toast, toastKey, setFps, el };
}
