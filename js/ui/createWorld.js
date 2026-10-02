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
import { terrainTypes, createTerrain } from '../systems/terrain.js';
import { DENSITY_TIERS } from '../core/state.js';

/** 密度档的文案键（与设置面板共用 t('settings.density.*')） */
const DENSITY_KEYS = DENSITY_TIERS.map((d) => d.key);

/**
 * @param {object} opts
 *  - onConfirm({ name, mode, worldType, terrain, seed, companion, starter }) 创建
 *  - onPreview(worldType, seed, terrain)  实时预览回调（主流程可据此换背景）
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
    densityLabel: document.getElementById('cw-density-label'),
    density: document.getElementById('cw-density'),
    worldLabel: document.getElementById('cw-world-label'),
    worlds: document.getElementById('cw-worlds'),
    terrainLabel: document.getElementById('cw-terrain-label'),
    terrains: document.getElementById('cw-terrains'),
    seedLabel: document.getElementById('cw-seed-label'),
    seed: document.getElementById('cw-seed'),
    dice: document.getElementById('cw-dice'),
    compLabel: document.getElementById('cw-comp-label'),
    comps: document.getElementById('cw-comps'),
    chestLabel: document.getElementById('cw-chest-label'),
    chest: document.getElementById('cw-chest'),
    preview: document.getElementById('cw-preview'),
    previewLabel: document.getElementById('cw-preview-label'),
    previewRef: document.getElementById('cw-preview-ref'),
    hint: document.getElementById('cw-hint'),
    create: document.getElementById('cw-create'),
  };

  const state = {
    mode: 'peace',
    // 生物密度（0 稀疏 / 1 标准 / 2 热闹）—— 与设置面板共享同一档位语义，
    // 开局前就能定，开局后也能在设置里改。
    density: 1,
    worldType: 'coral',
    terrain: 'shore',
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

  /**
   * 沿海地形卡片（阶段十一）：shore / slope / island。
   * 缩略图不用 CSS 画，而是把该地形的**真实岸线**采样下来画成小图 ——
   * 这样玩家在创建面板里看到的形状，和进去之后走到的世界是同一套公式，
   * 不会出现「面板画了个直角岸，进去全是斜坡」的欺骗感。
   */
  function renderTerrains() {
    if (!el.terrains) return;
    el.terrains.innerHTML = '';
    for (const id of terrainTypes()) {
      const c = document.createElement('div');
      c.className = 'create-terrain-card' + (id === state.terrain ? ' sel' : '');
      c.dataset.id = id;

      const cv = document.createElement('canvas');
      cv.className = 'ctc-canvas';
      cv.width = 176;
      cv.height = 68;
      c.appendChild(cv);

      const nm = document.createElement('div');
      nm.className = 'ctc-name';
      nm.textContent = t('terrain.' + id);
      c.appendChild(nm);

      const ds = document.createElement('div');
      ds.className = 'ctc-desc';
      ds.textContent = t('terrain.' + id + '.desc');
      c.appendChild(ds);

      drawTerrainThumb(cv, id, currentSeedStr());

      c.addEventListener('click', () => {
        state.terrain = id;
        renderTerrains();
        preview();
      });
      el.terrains.appendChild(c);
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
          preview();   // 缩略图同步更新伴随水母配色
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

  /** 密度行的文案（三档循环） */
  function renderDensity() {
    if (!el.density) return;
    const key = DENSITY_KEYS[state.density] || DENSITY_KEYS[1];
    el.density.textContent = t('settings.density.' + key);
  }

  function renderChest() {
    if (el.chest) el.chest.classList.toggle('on', state.starter);
  }

  /** 右侧实时缩略图：按群系水色 + 标志结构 + 海岸地形 + 伴随水母绘制（对应 MC 世界缩略图） */
  function preview() {
    const canvas = el.preview;
    if (canvas && canvas.getContext) {
      const w = worldById(state.worldType);
      renderThumb(canvas, w, state.companion, state.terrain, currentSeedStr());
      if (el.previewLabel) el.previewLabel.textContent = t(w.label);
      if (el.previewRef) el.previewRef.textContent = w.mcRef || '';
    }
    if (onPreview) onPreview(state.worldType, currentSeedStr(), state.terrain);
  }

  function renderLabels() {
    if (el.title) el.title.textContent = t('create.title');
    if (el.nameLabel) el.nameLabel.textContent = t('create.name');
    if (el.modeLabel) el.modeLabel.textContent = t('create.mode');
    if (el.densityLabel) el.densityLabel.textContent = t('settings.density');
    renderDensity();
    if (el.worldLabel) el.worldLabel.textContent = t('create.world');
    if (el.terrainLabel) el.terrainLabel.textContent = t('create.terrain');
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
    // 重置为默认。密度带「上次选择」——玩家刚把世界调成稀疏，
    // 下次新建多半还是想稀疏，不该每次弹回标准。
    state.mode = 'peace';
    state.worldType = 'coral';
    state.terrain = 'shore';
    state.companion = 'lucy';
    state.starter = false;
    try {
      const saved = JSON.parse(localStorage.getItem('ocean.settings') || '{}');
      if (typeof saved.density === 'number') state.density = saved.density;
    } catch (e) { /* 忽略 */ }
    if (el.name) el.name.value = '';
    if (el.seed) el.seed.value = '';
    renderLabels();
    renderMode();
    renderDensity();
    renderChest();
    renderWorlds();
    renderTerrains();
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
        density: state.density,
        worldType: state.worldType,
        terrain: state.terrain,
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
    if (el.density) {
      el.density.addEventListener('click', () => {
        state.density = (state.density + 1) % DENSITY_KEYS.length;
        renderDensity();
        preview();
      });
      el.density.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          state.density = (state.density + 1) % DENSITY_KEYS.length;
          renderDensity();
          preview();
        }
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

/** 群系基色 -> 预览用 CSS 渐变（基色叠加在暗海底色上）—— 供卡片色块使用 */
function swatchCss([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const top = `rgb(${c(26 + r)},${c(96 + g)},${c(140 + b)})`;
  const mid = `rgb(${c(10 + r)},${c(50 + g)},${c(96 + b)})`;
  return `linear-gradient(180deg, ${top}, ${mid} 55%, rgb(2,10,24))`;
}

/* ============================================================
 *  地形缩略图（阶段十一）
 *  直接调用 createTerrain 采样**真实**地形，把水线 / 水深带画成小图。
 *  与游戏内用的是同一套公式，所以面板所见即所得。
 * ============================================================ */

/** 水深带配色（浅 -> 深），与游戏内 scenery 的带色保持同族色相 */
const THUMB_BAND_COLORS = {
  land: '#4d5a3c',
  beach: '#c9b485',
  shallow: '#4fb8cf',
  nearshore: '#2f8fb8',
  midsea: '#1d6690',
  deepsea: '#123f63',
};

/**
 * 在 canvas 上画一张「该地形长什么样」的小图。
 * 做法：把 canvas 的每一列映射到世界的一段 X，逐列采样水线高度，
 * 水线以上填陆地/沙滩色，以下按 6 档水深带依次填色。
 */
function drawTerrainThumb(canvas, type, seedStr) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  let terrain = null;
  try {
    terrain = createTerrain({ type, seed: seedStr || 'preview' });
  } catch (e) {
    terrain = null;
  }

  // 采样失败时退化为纯水色，避免面板出现空白/异常
  if (!terrain || !terrain.shoreLineAt) {
    ctx.fillStyle = THUMB_BAND_COLORS.midsea;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  const WX0 = -180;
  const WX1 = 3200 + 180;
  const WY0 = -180;
  const WY1 = 1220;
  const dy = H / (WY1 - WY0);
  const bandColor = (d) => {
    const id = bandIdOf(d);
    return THUMB_BAND_COLORS[id] || THUMB_BAND_COLORS.midsea;
  };

  const COL = 3;   // 每 3px 一列，足够看清岸线形状又不费时
  for (let px = 0; px < W; px += COL) {
    const wx = WX0 + ((px + COL * 0.5) / W) * (WX1 - WX0);
    const sl = terrain.shoreLineAt(wx);
    const slY = (sl - WY0) * dy;

    // 水线以上：陆地色（近水线一段染成沙滩色）
    ctx.fillStyle = THUMB_BAND_COLORS.land;
    ctx.fillRect(px, 0, COL, Math.max(0, slY));
    ctx.fillStyle = THUMB_BAND_COLORS.beach;
    ctx.fillRect(px, Math.max(0, slY - 5), COL, Math.min(5, slY));

    // 水线以下：按水深分档填色（每 4px 一步，避免逐像素调用 depthAt）
    for (let py = Math.max(0, slY); py < H; py += 4) {
      const wy = WY0 + (py / H) * (WY1 - WY0);
      const d = terrain.depthAt ? terrain.depthAt(wx, wy) : 0;
      const col = d < 0 ? THUMB_BAND_COLORS.land : bandColor(d);
      ctx.fillStyle = col;
      ctx.fillRect(px, py, COL, 4.6);
    }
    // 水线本身highlight（白浪）
    ctx.fillStyle = 'rgba(240, 252, 255, 0.75)';
    ctx.fillRect(px, Math.max(0, slY - 1.4), COL, 1.8);
  }

  // 海面光泽
  const gloss = ctx.createLinearGradient(0, 0, 0, H);
  gloss.addColorStop(0, 'rgba(190, 240, 255, 0.14)');
  gloss.addColorStop(0.45, 'rgba(0,0,0,0)');
  gloss.addColorStop(1, 'rgba(0, 10, 26, 0.35)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, W, H);
}

/** 与 terrain.BANDS 阈值同步的轻量版（避免缩略图模块 import 整套地形常量） */
function bandIdOf(d) {
  if (d < 0) return 'land';
  if (d < 150) return 'beach';
  if (d < 380) return 'shallow';
  if (d < 700) return 'nearshore';
  if (d < 1030) return 'midsea';
  return 'deepsea';
}

/**
 * 在 canvas 上绘制"世界缩略图"：群系水色渐变 + 标志结构剪影 + 海岸地形 + 伴随水母。
 * 对应 MC Bedrock 创建界面的世界缩略图预览。
 */
function renderThumb(canvas, world, companionId, terrainType, seedStr) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const [r, g, b] = world.baseTint;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));

  // 1) 水色渐变（群系基色）
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `rgb(${cl(30 + r)},${cl(110 + g)},${cl(160 + b)})`);
  grad.addColorStop(0.5, `rgb(${cl(12 + r)},${cl(58 + g)},${cl(104 + b)})`);
  grad.addColorStop(1, `rgb(${cl(2 + r * 0.3)},${cl(9 + g * 0.3)},${cl(22 + b * 0.3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2) 光柱
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = (W / 5) * (i + 1);
    const rg = ctx.createLinearGradient(x, 0, x + 20, H);
    const a = 0.07 * world.rays;
    rg.addColorStop(0, `rgba(190, 240, 255, ${a})`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x - 10, 0);
    ctx.lineTo(x + 10, 0);
    ctx.lineTo(x + 28, H);
    ctx.lineTo(x + 4, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3) 群系标志结构剪影
  drawThumbFeature(ctx, world, W, H);

  // 3.5) 海岸地形带（阶段十一）：在左右两侧叠一条「横切面」示意，
  //      让玩家在预览里就看出所选岸线是平岸 / 斜岸 / 孤岛。
  drawThumbCoast(ctx, terrainType, W, H);

  // 4) 伴随水母（选中配色）
  const v = COMPANION_VARIANTS.find((x) => x.id === companionId) || COMPANION_VARIANTS[0];
  drawThumbJelly(ctx, v, W * 0.5, H * 0.44);

  // 5) 底部渐暗，便于叠加文字
  const ve = ctx.createLinearGradient(0, H * 0.6, 0, H);
  ve.addColorStop(0, 'rgba(0,0,0,0)');
  ve.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = ve;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);
}

function drawThumbFeature(ctx, world, W, H) {
  const feat = world.feature;
  switch (feat) {
    case 'coral': {
      const cols = ['#ff8fb0', '#ffb26b', '#8affc0', '#8fd0ff'];
      for (let k = 0; k < 5; k++) {
        const x = (W / 6) * (k + 1);
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = hexA(cols[(i + k) % 4], 0.55);
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x + (i - 1) * 6, H);
          ctx.quadraticCurveTo(x + (i - 1) * 8, H - 26, x + (i - 1) * 10, H - 44);
          ctx.stroke();
        }
      }
      break;
    }
    case 'ice': {
      for (let k = 0; k < 3; k++) {
        const x = W * (0.2 + k * 0.3);
        const y = H * (0.72 + (k % 2) * 0.06);
        ctx.fillStyle = 'rgba(190, 225, 255, 0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y, 34, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230, 245, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      break;
    }
    case 'vent': {
      const x = W * 0.5, y = H * 0.95;
      const rg = ctx.createRadialGradient(x, y, 2, x, y, 90);
      rg.addColorStop(0, 'rgba(255, 90, 60, 0.4)');
      rg.addColorStop(1, 'rgba(255, 60, 40, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(80, 26, 22, 0.6)';
      ctx.beginPath();
      ctx.moveTo(x - 26, H);
      ctx.lineTo(x, H - 46);
      ctx.lineTo(x + 26, H);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'neon': {
      for (let i = 0; i < 14; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W;
        const y = (Math.sin(i * 78.233) * 12345.6789 % 1 + 1) % 1 * H;
        ctx.fillStyle = hexA(['#8affd0', '#8fd0ff', '#d08fff'][i % 3], 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'mycelium': {
      for (let k = 0; k < 4; k++) {
        const x = W * (0.18 + k * 0.22);
        const rg = ctx.createRadialGradient(x, H * 0.8, 2, x, H * 0.8, 40);
        rg.addColorStop(0, 'rgba(230, 200, 255, 0.35)');
        rg.addColorStop(1, 'rgba(200, 170, 240, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, H * 0.8, 40, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default: break;
  }
}

/**
 * 在主预览缩略图里叠一层「岸线示意」：
 * 不重画整张地形（预览要保留群系水色），只在左上角用一个小剖面图标
 * 表达三种岸线的形状差异 —— 平岸 / 斜岸 / 孤岛。
 */
function drawThumbCoast(ctx, type, W, H) {
  if (!type) return;
  const bw = 96, bh = 46;
  const bx = 8, by = H - bh - 8;

  ctx.save();
  // 底板
  ctx.fillStyle = 'rgba(4, 16, 32, 0.55)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx - 4, by - 4, bw + 8, bh + 8, 6) : ctx.rect(bx - 4, by - 4, bw + 8, bh + 8);
  ctx.fill();

  // 海面
  ctx.fillStyle = 'rgba(40, 120, 170, 0.5)';
  ctx.fillRect(bx, by, bw, bh);

  const n = 32;
  ctx.beginPath();
  ctx.moveTo(bx, by + bh);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    let h;   // 0 = 顶（陆地），1 = 底（深水）
    if (type === 'slope') h = Math.min(0.98, u * 0.88 + 0.06);
    else if (type === 'island') h = Math.abs(u - 0.5) * 1.9;
    else h = 0.26 + Math.sin(u * 9) * 0.035;      // shore：基本水平，微起伏
    ctx.lineTo(bx + u * bw, by + Math.max(0, Math.min(1, h)) * bh);
  }
  ctx.lineTo(bx + bw, by + bh);
  ctx.closePath();
  const lg = ctx.createLinearGradient(0, by, 0, by + bh);
  lg.addColorStop(0, '#c9b485');
  lg.addColorStop(0.28, '#43503a');
  lg.addColorStop(1, 'rgba(10, 40, 70, 0.1)');
  ctx.fillStyle = lg;
  ctx.fill();

  // 岸线高光
  ctx.strokeStyle = 'rgba(240, 252, 255, 0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = 'rgba(220, 242, 255, 0.85)';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(t('terrain.' + type), bx + 3, by + 10);
  ctx.restore();
}

function drawThumbJelly(ctx, v, cx, cy) {
  const r = 22;
  // 光晕
  const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
  halo.addColorStop(0, hexA(v.glow, 0.4));
  halo.addColorStop(1, hexA(v.glow, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  // 触须
  ctx.strokeStyle = hexA(v.tent, 0.75);
  ctx.lineWidth = 1.4;
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * r * 0.34;
    ctx.beginPath();
    ctx.moveTo(x, cy + r * 0.5);
    ctx.quadraticCurveTo(x + i * 2, cy + r * 1.4, x + i * 3, cy + r * 2);
    ctx.stroke();
  }
  // 伞盖
  const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  body.addColorStop(0, v.accent);
  body.addColorStop(0.5, v.core);
  body.addColorStop(1, v.glow);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.82, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
