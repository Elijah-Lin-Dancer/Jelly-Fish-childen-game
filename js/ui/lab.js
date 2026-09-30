// ============================================================
//  繁育实验室面板（阶段六）
//  - 显示生物荧光余额 / 已繁育次数
//  - 三系专长：显示等级与下一级花费，点击购买
//  复用 dex-modal / seg 结构
// ============================================================

import { t } from './i18n.js';

export function createLab({ economy, specialize, getBreeds }) {
  const el = {
    overlay: document.getElementById('lab-modal'),
    close: document.getElementById('lab-close'),
    title: document.getElementById('lab-title'),
    bio: document.getElementById('lab-bio'),
    breeds: document.getElementById('lab-breeds'),
    specList: document.getElementById('lab-spec-list'),
  };

  let open = false;

  function render() {
    if (el.title) el.title.textContent = t('lab.title');
    if (el.bio) el.bio.textContent = t('lab.bio', { n: economy.bio, cap: economy.cap });
    if (el.breeds) el.breeds.textContent = t('lab.breeds', { n: getBreeds ? getBreeds() : 0 });

    if (!el.specList) return;
    el.specList.innerHTML = '';
    for (const s of specialize.list) {
      const lv = specialize.levelOf(s.id);
      const maxed = lv >= s.costs.length;
      const cost = maxed ? 0 : s.costs[lv];
      const affordable = !maxed && economy.bio >= cost;

      const row = document.createElement('div');
      row.className = 'lab-spec' + (maxed ? ' maxed' : '');

      const head = document.createElement('div');
      head.className = 'lab-spec-head';
      head.innerHTML =
        `<span class="lab-spec-icon">${s.icon}</span>` +
        `<span class="lab-spec-name">${t(s.label)}</span>` +
        `<span class="lab-spec-lv">${t('lab.lv', { n: lv, max: s.costs.length })}</span>`;
      row.appendChild(head);

      const desc = document.createElement('div');
      desc.className = 'lab-spec-desc';
      desc.textContent = t(s.desc);
      row.appendChild(desc);

      const btn = document.createElement('div');
      btn.className = 'lab-buy' + (maxed ? ' maxed' : (affordable ? '' : ' disabled'));
      btn.setAttribute('role', 'button');
      btn.tabIndex = maxed ? -1 : 0;
      btn.textContent = maxed ? t('lab.maxed') : t('lab.buy', { n: cost });
      if (!maxed) {
        const buy = () => {
          if (specialize.upgrade(s.id)) render();
        };
        btn.addEventListener('click', buy);
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buy(); }
        });
      }
      row.appendChild(btn);
      el.specList.appendChild(row);
    }
  }

  function show() { render(); if (el.overlay) el.overlay.classList.remove('hide'); open = true; }
  function hide() { if (el.overlay) el.overlay.classList.add('hide'); open = false; }
  function toggle() { if (open) hide(); else show(); }

  function bind() {
    if (el.close) el.close.addEventListener('click', hide);
    if (el.overlay) {
      el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) hide(); });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
  }

  return { bind, render, show, hide, toggle, get isOpen() { return open; } };
}
