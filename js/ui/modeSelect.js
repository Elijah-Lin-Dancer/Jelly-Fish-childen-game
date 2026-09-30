// ============================================================
//  新存档 · 选模式（阶段八 · 8A）
//  - MC 式：建新世界时先选 和平 / 冒险
//  - 仅在"无存档"时弹出一次；选定后写入池塘存档元数据并锁死
//  - 已有存档从元数据恢复，不弹（决策 2：每存档独立）
// ============================================================

import { t } from './i18n.js';

export function createModeSelect({ onPick } = {}) {
  let el = null;
  let picked = false;

  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'mode-select hide';
    el.innerHTML =
      '<div class="mode-card">' +
      '  <div class="mode-title" id="mode-title"></div>' +
      '  <div class="mode-sub" id="mode-sub"></div>' +
      '  <div class="mode-options">' +
      '    <button class="mode-opt peace" data-mode="peace">' +
      '      <span class="mode-opt-name" id="mode-peace-name"></span>' +
      '      <span class="mode-opt-desc" id="mode-peace-desc"></span>' +
      '    </button>' +
      '    <button class="mode-opt adventure" data-mode="adventure">' +
      '      <span class="mode-opt-name" id="mode-adventure-name"></span>' +
      '      <span class="mode-opt-desc" id="mode-adventure-desc"></span>' +
      '    </button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelectorAll('.mode-opt').forEach((b) => {
      b.addEventListener('click', () => choose(b.dataset.mode));
    });
    return el;
  }

  function paint() {
    ensure();
    el.querySelector('#mode-title').textContent = t('mode.pick');
    el.querySelector('#mode-sub').textContent = t('mode.pickSub');
    el.querySelector('#mode-peace-name').textContent = t('mode.peace');
    el.querySelector('#mode-peace-desc').textContent = t('mode.peace.desc');
    el.querySelector('#mode-adventure-name').textContent = t('mode.adventure');
    el.querySelector('#mode-adventure-desc').textContent = t('mode.adventure.desc');
  }

  function choose(m) {
    if (picked) return;
    picked = true;
    hide();
    if (onPick) onPick(m);
  }

  function show() {
    if (picked) return;
    paint();
    ensure().classList.remove('hide');
  }

  function hide() { if (el) el.classList.add('hide'); }

  function refreshLang() { if (el && !el.classList.contains('hide')) paint(); }

  return { show, hide, refreshLang, get active() { return el && !el.classList.contains('hide'); } };
}
