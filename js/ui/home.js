// ============================================================
//  标题屏（阶段十）· 由原"欢迎页 + 池塘命名"升级为 MC 式标题菜单
//  - 活海洋全景（画布仍在背后渲染）+ 大标题 + 竖排菜单
//  - 继续 / 新建世界 / 设置 / 语言（对齐 MC 主菜单）
//  - 仍负责"池塘命名/改名"：改名走点击左上角标题
//  参考：https://minecraft.wiki/w/Tutorial:Menu_screen_(Java_Edition)
// ============================================================

import { t } from './i18n.js';
import { app } from '../core/state.js';

const STORAGE_KEY = 'ocean.pondName';

/** 读取用户自定义名称；为空则返回 null（表示使用默认名） */
function readCustomName() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch (e) {
    return null; // 隐私模式
  }
}

function writeCustomName(v) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* 忽略 */ }
}

/**
 * @param {object} opts
 *  - onStart()           首次进入（解锁音频）
 *  - onToast(key)        轻提示
 *  - onReset()           重置池塘
 *  - hasSave()           是否有存档（决定"继续"是否可用）
 *  - onContinue()        点"继续"
 *  - onNewWorld()        点"新建世界"（打开创建面板）
 *  - onOpenSettings()    点"设置"
 */
export function createHome({
  onStart, onToast, onReset,
  hasSave, onContinue, onNewWorld, onOpenSettings,
} = {}) {
  const el = {
    home: document.getElementById('home'),
    title: document.getElementById('pond-title'),
    homeTitle: document.getElementById('home-title'),
    welcome: document.getElementById('home-welcome'),
    hint: document.getElementById('home-hint'),
    reset: document.getElementById('pond-reset'),
    continueBtn: document.getElementById('title-continue'),
    newBtn: document.getElementById('title-new'),
    settingsBtn: document.getElementById('title-settings'),
    langBtn: document.getElementById('title-lang'),
  };

  let custom = readCustomName();
  let entered = false;
  let enterHook = null;

  /** 当前应显示的名称：自定义优先，否则用默认（跟随语言） */
  function displayName() {
    return custom || t('pond.default');
  }

  /** 同步左上角标题 + 文档标题 */
  function syncTitle() {
    if (el.title) {
      el.title.textContent = displayName();
      el.title.classList.toggle('renamed', !!custom);
    }
    const base = t('doc.title');
    document.title = custom ? `${custom} · ${base}` : base;
  }

  /** 显示标题屏 */
  function show() {
    if (!el.home) return;
    syncTitle();
    el.home.classList.remove('hide');
    if (el.homeTitle) el.homeTitle.innerHTML = t('title.logo');
    if (el.welcome) el.welcome.textContent = t('home.welcome');
    if (el.hint) el.hint.textContent = t('home.rename');
    // "继续"仅在有存档时可用（对齐 MC：无世界时灰色/隐藏）
    const canContinue = hasSave ? !!hasSave() : false;
    if (el.continueBtn) {
      el.continueBtn.classList.toggle('disabled', !canContinue);
      el.continueBtn.textContent = t('title.continue');
    }
    if (el.newBtn) el.newBtn.textContent = t('title.new');
    if (el.settingsBtn) el.settingsBtn.textContent = t('title.settings');
    if (el.langBtn) el.langBtn.textContent = t('title.lang', { lang: app.lang.toUpperCase() });
  }

  function hide() {
    if (!el.home) return;
    el.home.classList.add('hide');
  }

  function enter() {
    hide();
    if (!entered) {
      entered = true;
      if (onStart) onStart();
    }
    if (enterHook) enterHook();
  }

  /** 注册"进入池塘"回调 */
  function onEnter(fn) { enterHook = fn; }

  /** 游玩界面点击左上角标题改名 */
  function rename() {
    const next = window.prompt(t('home.prompt'), displayName());
    if (next === null) return;
    const v = next.trim();
    custom = v ? v.slice(0, 24) : null;
    writeCustomName(custom);
    syncTitle();
    if (onToast && v) onToast('pond.renamed');
  }

  function bind() {
    if (el.continueBtn) {
      el.continueBtn.addEventListener('click', () => {
        if (hasSave && !hasSave()) {
          if (onToast) onToast('title.nosave');
          return;
        }
        if (onContinue) onContinue();
        enter();
      });
    }
    if (el.newBtn) {
      el.newBtn.addEventListener('click', () => { if (onNewWorld) onNewWorld(); });
    }
    if (el.settingsBtn) {
      el.settingsBtn.addEventListener('click', () => { if (onOpenSettings) onOpenSettings(); });
    }
    if (el.langBtn) {
      // 语言按钮由 main 的 toggleLang 接管（保持 HUD 与标题屏同步）
      el.langBtn.addEventListener('click', () => { if (el._onLang) el._onLang(); });
    }
    if (el.title) {
      el.title.addEventListener('click', rename);
      el.title.style.cursor = 'pointer';
      el.title.title = t('home.rename');
    }
    if (el.reset) {
      el.reset.addEventListener('click', () => {
        const done = onReset ? onReset() : false;
        if (done) {
          custom = null;
          writeCustomName(null);
          syncTitle();
          if (el.homeTitle) el.homeTitle.innerHTML = t('title.logo');
          if (onToast) onToast('pond.reset.done');
        }
      });
    }
  }

  /** 语言按钮回调注入（由 main 绑定 toggleLang） */
  function onLang(fn) { el._onLang = fn; }

  /** 语言切换后刷新标题屏文本 */
  function refreshLang() {
    if (el.homeTitle) el.homeTitle.innerHTML = t('title.logo');
    if (el.welcome) el.welcome.textContent = t('home.welcome');
    if (el.hint) el.hint.textContent = t('home.rename');
    if (el.continueBtn) el.continueBtn.textContent = t('title.continue');
    if (el.newBtn) el.newBtn.textContent = t('title.new');
    if (el.settingsBtn) el.settingsBtn.textContent = t('title.settings');
    if (el.langBtn) el.langBtn.textContent = t('title.lang', { lang: app.lang.toUpperCase() });
    if (el.title) el.title.title = t('home.rename');
    syncTitle();
  }

  return {
    show, hide, bind, refreshLang, syncTitle, onEnter, onLang,
    get name() { return displayName(); },
    /** 供外部（创建面板）设置池塘名 */
    setName(v) {
      const s = (v || '').trim();
      custom = s ? s.slice(0, 24) : null;
      writeCustomName(custom);
      syncTitle();
    },
  };
}
