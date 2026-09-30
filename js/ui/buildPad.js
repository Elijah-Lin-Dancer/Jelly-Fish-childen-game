// ============================================================
//  建造面板（阶段八 · 8A）
//  - 列出预设模块：图标 / 名称 / 花费 / 已放置数
//  - 选中模块 → 关闭面板 → 在海域空位点击放置
//  - 面板内可"移除模式"（点击已放置建筑将其移除，返还一半荧光）
// ============================================================

import { t } from './i18n.js';

export function createBuildPad({ build, economy, onToast, onRefreshBio } = {}) {
  const el = {
    modal: document.getElementById('build-modal'),
    close: document.getElementById('build-close'),
    list: document.getElementById('build-list'),
    bio: document.getElementById('build-bio'),
    hint: document.getElementById('build-hint'),
  };

  let open = false;
  let selected = null;      // 当前选中待放置的模块 id
  let removeMode = false;   // 是否处于"移除"模式
  let onSelect = null;

  /** 外部（main）注册：玩家选好模块后开始放置流程 */
  function onSelectModule(fn) { onSelect = fn; }

  function isOpen() { return open; }

  function render() {
    if (!el.list) return;
    if (el.bio) el.bio.textContent = economy ? String(economy.bio) : '0';
    if (el.hint) el.hint.textContent = t('build.hint');

    el.list.innerHTML = '';
    const mods = (build && build.modules) || [];
    for (const m of mods) {
      const owned = build ? build.countOf(m.id) : 0;
      const afford = economy ? economy.bio >= m.cost : true;
      const row = document.createElement('div');
      row.className = 'build-item' + (selected === m.id ? ' sel' : '') + (afford ? '' : ' poor');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.innerHTML =
        '<span class="build-ico">' + icon(m.id) + '</span>' +
        '<span class="build-name">' + t(m.label) + '</span>' +
        '<span class="build-owned">' + owned + '</span>' +
        '<span class="build-cost">◈ ' + m.cost + '</span>';
      const pick = () => {
        if (!afford) { if (onToast) onToast('build.broke'); return; }
        selected = removeMode ? null : m.id;
        removeMode = false;
        if (onSelect) onSelect(m.id);
        close();
      };
      row.addEventListener('click', pick);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      el.list.appendChild(row);
    }

    // 移除行
    const rm = document.createElement('div');
    rm.className = 'build-item remove' + (removeMode ? ' sel' : '');
    rm.setAttribute('role', 'button');
    rm.setAttribute('tabindex', '0');
    rm.innerHTML =
      '<span class="build-ico">' + icon('remove') + '</span>' +
      '<span class="build-name">' + t('build.remove') + '</span>' +
      '<span class="build-owned">' + (build ? build.size : 0) + '</span>' +
      '<span class="build-cost"></span>';
    const pickRm = () => {
      if (!build || !build.size) { if (onToast) onToast('build.empty'); return; }
      removeMode = true;
      selected = null;
      if (onSelect) onSelect(null);   // 通知 main 进入移除模式
      close();
    };
    rm.addEventListener('click', pickRm);
    rm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickRm(); }
    });
    el.list.appendChild(rm);
  }

  function toggle() { open ? close() : show(); }

  function show() {
    if (!el.modal) return;
    open = true;
    render();
    el.modal.classList.remove('hide');
  }

  function close() {
    if (!el.modal) return;
    open = false;
    el.modal.classList.add('hide');
  }

  /** 放置成功后清空选中态 */
  function clearSelection() { selected = null; removeMode = false; }

  function bind() {
    if (el.close) el.close.addEventListener('click', close);
    if (el.modal) {
      el.modal.addEventListener('click', (e) => { if (e.target === el.modal) close(); });
    }
    document.addEventListener('keydown', (e) => {
      if (open && e.key === 'Escape') close();
    });
  }

  function icon(id) {
    // 内联 SVG，沿用"字体无关"方案
    const c = '#9fd8ff';
    switch (id) {
      case 'coral':
        return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 21V11M12 13l-4-4M12 15l4-4M8 9V5M16 11V7" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
      case 'reef':
        return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 19l5-9 3 3 4-7 6 13z" fill="${c}" opacity="0.85"/></svg>`;
      case 'beacon':
        return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="8" r="3" fill="${c}"/><path d="M11 11h2l1 9h-4z" fill="${c}" opacity="0.8"/><path d="M12 3v-1M6 6L5 5M18 6l1-1" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
      case 'kelp':
        return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 21c0-6 2-8 0-13M12 21c1-6-1-9 1-14M15 21c0-5 2-7 0-11" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="#ff9a9a" stroke-width="2" stroke-linecap="round"/></svg>`;
    }
  }

  return {
    bind, show, close, toggle, render, clearSelection, onSelectModule,
    isOpen, get removeMode() { return removeMode; },
    exitRemove() { removeMode = false; },
  };
}
