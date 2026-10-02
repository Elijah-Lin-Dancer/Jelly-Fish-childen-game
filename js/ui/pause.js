// ============================================================
//  暂停菜单（Minecraft 风格）
// ------------------------------------------------------------
//  原版缺失的「暂停 / 返回标题」：玩家一旦进入池塘就没法主动停下来，
//  也没法体面地退出（只能刷新页面 —— 那会丢掉没落盘的进度）。
//
//  【开关】
//    · Esc 键（游戏中）
//    · 右上角 ⏸ 按钮
//
//  【菜单项】
//    继续游戏      —— 关掉遮罩，恢复世界更新
//    设置          —— 打开设置面板（遮罩留在下面，关掉设置回到暂停）
//    保存并回到标题 —— 先落盘再回标题屏，不丢进度
//
//  【为什么要停世界更新】
//    暂停时如果继续跑 update，水母会照游、昼夜会照转 ——
//    玩家回来发现「说好的暂停，怎么天黑了」。所以暂停期间停掉
//    scheduler 的世界推进，并让 rAF 停帧（见 main.js 的 setPaused）。
//
//  【为什么要重置时间基准】
//    rAF 恢复时 t 会突然跳一大截，若不重置 lastT，第一帧的 dt
//    会被钳到 33ms 但整个昼夜相位仍会按真实流逝推进。
//    main.js 的 resume 路径里重置 lastT=0 来规避（与 visibilitychange 同款处理）。
// ============================================================

import { t } from './i18n.js';

/**
 * @param {object} actions
 *  - onResume()          继续游戏
 *  - onOpenSettings()    打开设置（暂停遮罩保持）
 *  - onQuit()            保存并回标题
 *  - isInGame()          当前是否在游戏中（标题屏不该能暂停）
 */
export function createPauseMenu(actions = {}) {
  const el = {
    modal: document.getElementById('pause-modal'),
    title: document.getElementById('pause-title'),
    resume: document.getElementById('pause-resume'),
    settings: document.getElementById('pause-settings'),
    quit: document.getElementById('pause-quit'),
    hint: document.getElementById('pause-hint'),
  };

  let open = false;

  function render() {
    if (el.title) el.title.textContent = t('pause.title');
    if (el.resume) el.resume.textContent = t('pause.resume');
    if (el.settings) el.settings.textContent = t('pause.settings');
    if (el.quit) el.quit.textContent = t('pause.quit');
    if (el.hint) el.hint.textContent = t('pause.hint');
  }

  function show() {
    // 标题屏 / 未进游戏时不该弹暂停
    if (actions.isInGame && !actions.isInGame()) return;
    if (open) return;
    open = true;
    render();
    if (el.modal) el.modal.classList.remove('hide');
    document.body.classList.add('paused');    // 供 CSS 提升设置面板层级等
    if (actions.onPause) actions.onPause();
  }

  function hide() {
    if (!open) return;
    open = false;
    if (el.modal) el.modal.classList.add('hide');
    document.body.classList.remove('paused');
    if (actions.onResume) actions.onResume();
  }

  function toggle() { if (open) hide(); else show(); }

  function pick(fn) {
    return () => { if (fn) fn(); };
  }

  function bind() {
    if (el.resume) {
      el.resume.addEventListener('click', hide);
      el.resume.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hide(); }
      });
    }
    if (el.settings) {
      const go = pick(() => { if (actions.onOpenSettings) actions.onOpenSettings(); });
      el.settings.addEventListener('click', go);
      el.settings.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    }
    if (el.quit) {
      const go = pick(() => {
        // 回标题前先把遮罩收掉，避免标题屏上还压着暂停菜单
        open = false;
        if (el.modal) el.modal.classList.add('hide');
        document.body.classList.remove('paused');
        if (actions.onQuit) actions.onQuit();
      });
      el.quit.addEventListener('click', go);
      el.quit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    }
    // 点击遮罩空白处 = 继续（与设置面板一致的直觉）
    if (el.modal) {
      el.modal.addEventListener('click', (e) => { if (e.target === el.modal) hide(); });
    }
  }

  return {
    bind, show, hide, toggle, render,
    get isOpen() { return open; },
  };
}
