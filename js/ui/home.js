// ============================================================
//  游戏首页：欢迎页 + 池塘命名
//  - 首次进入显示欢迎页，用户可为池塘命名
//  - 名称保存到 localStorage，游玩界面点击标题可随时改名
//  - 名称不走 i18n（用户自定义值原样保留）；仅默认名跟随语言
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

export function createHome({ onStart, onToast, onReset } = {}) {
  const el = {
    home: document.getElementById('home'),
    title: document.getElementById('pond-title'),
    homeTitle: document.getElementById('home-title'),
    input: document.getElementById('pond-input'),
    startBtn: document.getElementById('pond-start'),
    welcome: document.getElementById('home-welcome'),
    prompt: document.getElementById('home-prompt'),
    hint: document.getElementById('home-hint'),
    reset: document.getElementById('pond-reset'),
  };

  let custom = readCustomName();
  let entered = false;

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
    // 文档标题也带上池塘名，便于多标签区分
    const base = t('doc.title');
    document.title = custom ? `${custom} · ${base}` : base;
  }

  /** 初始化首页（显示欢迎页） */
  function show() {
    if (!el.home) return;
    syncTitle();
    el.home.classList.remove('hide');
    if (el.prompt) el.prompt.textContent = t('home.prompt');
    if (el.welcome) el.welcome.textContent = t('home.welcome');
    if (el.startBtn) el.startBtn.textContent = t('home.start');
    if (el.hint) el.hint.textContent = t('home.rename');
    // 首页大标题跟随当前语言下的默认名
    if (el.homeTitle) el.homeTitle.textContent = t('pond.default');
    if (el.input) {
      el.input.value = '';
      el.input.placeholder = t('home.placeholder');
    }
  }

  function hide() {
    if (!el.home) return;
    el.home.classList.add('hide');
  }

  /** 确认名称并进入 */
  function enter() {
    const v = el.input ? el.input.value.trim() : '';
    if (v) {
      custom = v.slice(0, 24);
      writeCustomName(custom);
    }
    syncTitle();
    hide();
    if (!entered) {
      entered = true;
      if (onStart) onStart(); // 首次进入：解锁音频等
    }
  }

  /** 游玩界面点击标题改名 */
  function rename() {
    const next = window.prompt(t('home.prompt'), displayName());
    if (next === null) return; // 取消
    const v = next.trim();
    custom = v ? v.slice(0, 24) : null;
    writeCustomName(custom);
    syncTitle();
    if (onToast && v) onToast('pond.renamed');
  }

  function bind() {
    if (el.startBtn) el.startBtn.addEventListener('click', enter);
    if (el.input) {
      el.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); enter(); }
      });
      // 防止输入时误触画布交互
      el.input.addEventListener('pointerdown', (e) => e.stopPropagation());
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
          if (onToast) onToast('pond.reset.done');
        }
      });
    }
  }

  /** 语言切换后刷新默认名相关的文本 */
  function refreshLang() {
    if (el.prompt) el.prompt.textContent = t('home.prompt');
    if (el.welcome) el.welcome.textContent = t('home.welcome');
    if (el.startBtn) el.startBtn.textContent = t('home.start');
    if (el.hint) el.hint.textContent = t('home.rename');
    if (el.homeTitle) el.homeTitle.textContent = t('pond.default');
    if (el.title) el.title.title = t('home.rename');
    if (el.input) el.input.placeholder = t('home.placeholder');
    syncTitle();
  }

  return { show, hide, bind, refreshLang, syncTitle, get name() { return displayName(); } };
}
