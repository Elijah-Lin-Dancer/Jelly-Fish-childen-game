// ============================================================
//  新建世界面板（阶段十）
//  - 对齐 MC "Create New World"：世界名 / 游戏模式(循环) / 群系(卡片)
//    / 种子(留空随机·可抄写) / 你的水母(外观 5 选) / 起始礼包(开关)
//  - 右侧实时预览：选群系即时换水色/氛围（对应 Bedrock 缩略图预览）
//  参考：https://minecraft.wiki/w/Create_New_World
// ============================================================

import { t } from './i18n.js';
import { PICKABLE_WORLDS, worldById } from '../systems/worlds.js';
import { COMPANION_VARIANTS } from '../entities/companion.js';
import { rareCompanionUnlocked, makeRng } from '../core/seed.js';

/**
 * @param {object} opts
 *  - onConfirm({ name, mode, worldType, seed, companion, starter }) 创建
 *  - onPreview(worldType, seed)  实时预览回调（主流程可据此换背景）
 *  - onToast(key)
 */
export function createWorldPanel({ onConfirm, onPreview, onToast } = {}) {
  const el = {
    modal: document.getElementById('create-modal'),
    title: document.getElementById('create-title'),
    close: document.getElementById('create-close'),
    nameLabel: document.getElementById('cw-name-label'),
    name: document.getElementById('cw-name'),
    modeLabel: document.getElementById('cw-mode-label'),
    mode: document.getElementById('cw-mode'),
    worldLabel: document.getElementById('cw-world-label'),
    worlds: document.getElementById('cw-worlds'),
    seedLabel: document.getElementById('cw-seed-label'),
    seed: document.getElementById('cw-seed'),
    dice: document.getElementById('cw-dice'),
    compLabel: document.getElementById('cw-comp-label'),
    comps: document.getElementById('cw-comps'),
    chestLabel: document.getElementById('cw-chest-label'),
    chest: document.getElementById('cw-chest'),
    preview: document.getElementById('cw-preview'),
    hint: document.getElementById('cw-hint'),
    create: document.getElementById('cw-create'),
  };

  const state = {
    mode: 'peace',
    worldType: 'coral',
    companion: 'lucy',
    starter: false,
  };
  let rareUnlocked = false;

  /** 世界名默认值（MC 同款"新的世界"） */
  function defaultName() {
    try {
      const n = (parseInt(localStorage.getItem('ocean.worldNo') || '0', 10) || 0) + 1;
      return t('create.nameDefault', { n });
    } catch (e) {
      return t('create.nameDefault', { n: 1 });
    }
  }

  function currentSeedStr() {
    return el.seed ? el.seed.value.trim() : '';
  }

  /** 种子变化时刷新幻紫是否可选 */
  function refreshRare() {
    rareUnlocked = rareCompanionUnlocked(currentSeedStr());
    renderComps();
  }

  function renderWorlds() {
    if (!el.worlds) return;
    el.worlds.innerHTML = '';
    for (const w of PICKABLE_WORLDS) {
      const c = document.createElement('div');
      c.className = 'create-world-card' + (w.id === state.worldType ? ' sel' : '');
      c.dataset.id = w.id;
      const swatch = `linear-gradient(180deg, ${swatchCss(w.baseTint)}, rgba(2,10,24,0.9))`;
      c.innerHTML = `<div class="cwc-swatch" style="background:${swatch}"></div>
        <div class="cwc-name">${t(w.label)}</div>
        <div class="cwc-desc">${t(w.desc)}</div>`;
      c.addEventListener('click', () => {
        state.worldType = w.id;
        renderWorlds();
        preview();
      });
      el.worlds.appendChild(c);
    }
  }

  function renderComps() {
    if (!el.comps) return;
    el.comps.innerHTML = '';
    for (const v of COMPANION_VARIANTS) {
      const locked = v.rare && !rareUnlocked;
      const c = document.createElement('div');
      c.className = 'create-comp' + (v.id === state.companion ? ' sel' : '') + (locked ? ' locked' : '');
      c.title = locked ? t('create.rareLocked') : t(v.label);
      c.innerHTML = `<div class="comp-dot" style="background:${v.core}"></div>
        <div class="comp-name">${locked ? '???' : t(v.label)}</div>`;
      if (!locked) {
        c.addEventListener('click', () => {
          state.companion = v.id;
          renderComps();
        });
      } else {
        // 若当前已选中稀有但被锁，退回默认
        if (state.companion === v.id) state.companion = 'lucy';
      }
      el.comps.appendChild(c);
    }
  }

  function renderMode() {
    if (el.mode) el.mode.textContent = state.mode === 'peace' ? t('mode.peace') : t('mode.adventure');
  }

  function renderChest() {
    if (el.chest) el.chest.classList.toggle('on', state.starter);
  }

  /** 右侧实时预览：小画布按群系基色铺渐变 + 群系名 */
  function preview() {
    if (el.preview) {
      const w = worldById(state.worldType);
      el.preview.style.background = swatchCss(w.baseTint);
      el.preview.innerHTML = `<div class="preview-label">${t(w.label)}</div>
        <div class="preview-ref">${w.mcRef || ''}</div>`;
    }
    if (onPreview) onPreview(state.worldType, currentSeedStr());
  }

  function renderLabels() {
    if (el.title) el.title.textContent = t('create.title');
    if (el.nameLabel) el.nameLabel.textContent = t('create.name');
    if (el.modeLabel) el.modeLabel.textContent = t('create.mode');
    if (el.worldLabel) el.worldLabel.textContent = t('create.world');
    if (el.seedLabel) el.seedLabel.textContent = t('create.seed');
    if (el.compLabel) el.compLabel.textContent = t('create.companion');
    if (el.chestLabel) el.chestLabel.textContent = t('create.starter');
    if (el.create) el.create.textContent = t('create.go');
    if (el.hint) el.hint.textContent = t('create.hint');
    if (el.seed) el.seed.placeholder = t('create.seedPlaceholder');
    if (el.name) el.name.placeholder = t('create.namePlaceholder');
  }

  function show() {
    if (!el.modal) return;
    // 重置为默认
    state.mode = 'peace';
    state.worldType = 'coral';
    state.companion = 'lucy';
    state.starter = false;
    if (el.name) el.name.value = '';
    if (el.seed) el.seed.value = '';
    renderLabels();
    renderMode();
    renderChest();
    renderWorlds();
    refreshRare();
    preview();
    el.modal.classList.remove('hide');
  }

  function hide() {
    if (el.modal) el.modal.classList.add('hide');
  }

  function confirm() {
    const name = (el.name && el.name.value.trim()) || defaultName();
    // 种子：留空 -> 随机生成并采用（可复现）
    let seedStr = currentSeedStr();
    if (!seedStr) {
      const r = makeRng('');
      seedStr = r.seedStr;
      if (el.seed) el.seed.value = seedStr;
    }
    hide();
    if (onConfirm) {
      onConfirm({
        name,
        mode: state.mode,
        worldType: state.worldType,
        seed: seedStr,
        companion: state.companion,
        starter: state.starter,
      });
    }
  }

  function bind() {
    if (el.close) el.close.addEventListener('click', hide);
    if (el.mode) {
      el.mode.addEventListener('click', () => {
        state.mode = state.mode === 'peace' ? 'adventure' : 'peace';
        renderMode();
      });
    }
    if (el.dice) {
      el.dice.addEventListener('click', () => {
        if (el.seed) el.seed.value = '';
        refreshRare();
        preview();
      });
    }
    if (el.seed) {
      el.seed.addEventListener('input', () => { refreshRare(); preview(); });
      el.seed.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    if (el.name) {
      el.name.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    if (el.chest) {
      el.chest.addEventListener('click', () => {
        state.starter = !state.starter;
        renderChest();
      });
    }
    if (el.create) el.create.addEventListener('click', confirm);
  }

  return { show, hide, bind, renderLabels };
}

/** 群系基色 -> 预览用 CSS 渐变（基色叠加在暗海底色上） */
function swatchCss([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const top = `rgb(${c(26 + r)},${c(96 + g)},${c(140 + b)})`;
  const mid = `rgb(${c(10 + r)},${c(50 + g)},${c(96 + b)})`;
  return `linear-gradient(180deg, ${top}, ${mid} 55%, rgb(2,10,24))`;
}
