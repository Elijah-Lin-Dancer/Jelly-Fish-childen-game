// ============================================================
//  i18n：data-i18n 属性注入，切换只改 DOM 文本，不重建 Canvas
// ============================================================

import { LOCALES } from './locales.js';
import { app } from '../core/state.js';

const STORAGE_KEY = 'ocean.lang';

export function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch (e) { /* 隐私模式 */ }
  // 用户指定：默认英文
  return 'en';
}

export function t(key, params) {
  const dict = LOCALES[app.lang] || LOCALES.en;
  let s = dict[key];
  if (s === undefined) s = LOCALES.en[key];
  if (s === undefined) return key;
  if (params) {
    for (const k in params) {
      s = s.split('{' + k + '}').join(String(params[k]));
    }
  }
  return s;
}

/** 把字典应用到 DOM：data-i18n -> textContent，data-i18n-title -> title */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    const v = t(k);
    if (v !== undefined) el.textContent = v;
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const k = el.getAttribute('data-i18n-title');
    const v = t(k);
    if (v !== undefined) el.setAttribute('title', v);
  });
  document.documentElement.lang = app.lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('doc.title');
}

export function setLang(lang) {
  app.lang = lang === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem(STORAGE_KEY, app.lang); } catch (e) { /* 忽略 */ }
  applyI18n();
  return app.lang;
}

export function toggleLang() {
  return setLang(app.lang === 'zh' ? 'en' : 'zh');
}

export function initI18n() {
  setLang(detectLang());
}
