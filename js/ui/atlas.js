// ============================================================
//  探索图鉴（阶段七）
//  - 海域解锁进度 / 已发现秘密 / 故事碎片 / 当前目标
//  复用 dex-modal 结构
// ============================================================

import { t } from './i18n.js';

export function createAtlas({ explore, zones, story, quests }) {
  const el = {
    overlay: document.getElementById('atlas-modal'),
    close: document.getElementById('atlas-close'),
    title: document.getElementById('atlas-title'),
    zones: document.getElementById('atlas-zones'),
    stats: document.getElementById('atlas-stats'),
    storyList: document.getElementById('atlas-story'),
    questList: document.getElementById('atlas-quests'),
  };

  let open = false;

  function render() {
    if (el.title) el.title.textContent = t('atlas.title');
    if (el.stats) {
      el.stats.textContent = t('atlas.stats', {
        s: explore.count,
        st: story.readCount,
        qt: quests.count,
        qn: quests.total,
      });
    }

    // 海域列表
    if (el.zones) {
      el.zones.innerHTML = '';
      for (const z of zones.list) {
        const unlocked = explore.hasZone(z.id);
        const active = zones.current === z.id;
        const row = document.createElement('div');
        row.className = 'atlas-zone' + (unlocked ? ' unlocked' : ' locked') + (active ? ' active' : '');
        row.innerHTML =
          `<span class="atlas-zone-dot">${unlocked ? '●' : '○'}</span>` +
          `<span class="atlas-zone-name">${unlocked ? t(z.label) : t('zone.locked')}</span>`;
        el.zones.appendChild(row);
      }
    }

    // 故事碎片
    if (el.storyList) {
      el.storyList.innerHTML = '';
      for (const f of story.list) {
        const read = explore.hasStory(f.id);
        const row = document.createElement('div');
        row.className = 'atlas-story-row' + (read ? '' : ' locked');
        row.textContent = read ? t(f.key) : t('atlas.storyLocked');
        el.storyList.appendChild(row);
      }
    }

    // 目标
    if (el.questList) {
      el.questList.innerHTML = '';
      for (const q of quests.list) {
        const done = quests.has(q.id);
        const row = document.createElement('div');
        row.className = 'atlas-quest' + (done ? ' done' : '');
        row.innerHTML =
          `<span class="atlas-quest-mark">${done ? '[x]' : '[ ]'}</span>` +
          `<span>${t(q.label)}</span>`;
        el.questList.appendChild(row);
      }
    }
  }

  function show() { render(); if (el.overlay) el.overlay.classList.remove('hide'); open = true; }
  function hide() { if (el.overlay) el.overlay.classList.add('hide'); open = false; }
  function toggle() { if (open) hide(); else show(); }

  function bind() {
    if (el.close) el.close.addEventListener('click', hide);
    if (el.overlay) el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) hide(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
  }

  return { bind, render, show, hide, toggle, get isOpen() { return open; } };
}
