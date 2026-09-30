// ============================================================
//  入口：装配所有模块并启动主循环
// ============================================================

import { DPR, rand, isMobile, TAU } from './core/config.js';
import { view, pointer, theme, dayNight, app, perf, setTier, quality, camera, camInput } from './core/state.js';
import { createScheduler } from './core/loop.js';
import { createResize } from './core/resize.js';
import { createAudio } from './core/audio.js';
import { createPerf } from './ui/perf.js';
import { initI18n, t, toggleLang, applyI18n } from './ui/i18n.js';
import { createHud } from './ui/hud.js';
import { createHome } from './ui/home.js';
import { createDex } from './ui/dex.js';
import { createShare } from './ui/share.js';
import { createSettings } from './ui/settings.js';
import { createCoach } from './ui/coach.js';
import { createInteract, drawHoldRing } from './ui/interact.js';
import { createBackground, createLightRays, createWaterSurface, createDepthHaze, createTerrainLayer, setZoneProvider, setTerrainProvider } from './systems/scenery.js';
import { createDayNight } from './systems/dayNight.js';
import { createFeeding } from './systems/feeding.js';
import { createActivity } from './systems/activity.js';
import { createCurrent } from './systems/current.js';
import { createEcosystem } from './systems/ecosystem.js';
import { createMode } from './systems/mode.js';
import { createBuild } from './systems/build.js';
import { createWorld, worldById } from './systems/worlds.js';
import { createTerrain, WORLD, isTerrainType, terrainTypes, bandAt as bandOf, BANDS } from './systems/terrain.js';
import { createCamera } from './systems/camera.js';
import { rareCompanionUnlocked } from './core/seed.js';
import { Companion, COMPANION_VARIANTS } from './entities/companion.js';
import { createCollection } from './gameplay/collection.js';
import { createSave } from './gameplay/save.js';
import { createAchievements } from './gameplay/achievements.js';
import { createEconomy } from './gameplay/economy.js';
import { createSpecialize } from './gameplay/specialize.js';
import { createBreeding } from './gameplay/breeding.js';
import { createLab } from './ui/lab.js';
import { createExplore } from './gameplay/explore.js';
import { createStory } from './gameplay/story.js';
import { createZones } from './systems/zones.js';
import { createQuests } from './systems/quests.js';
import { createAtlas } from './ui/atlas.js';
import { Secret, seedSecrets } from './entities/secret.js';
import { createMemory } from './gameplay/memory.js';
import { createMemoryPad } from './ui/memoryPad.js';
import { createBuildPad } from './ui/buildPad.js';
import { createWorldPanel } from './ui/createWorld.js';
import { Bogyo } from './entities/bogyo.js';
import { dailyRareIndex } from './gameplay/daily.js';
import { Jellyfish, JELLY_PALETTES, weightedPaletteIndex } from './entities/jellyfish.js';
import { FishSchool } from './entities/fish.js';
import { Turtle } from './entities/turtle.js';
import { Whale } from './entities/whale.js';
import { Plankton, Bubble, Seaweed, Ripple, Bait, Celebrate } from './entities/env.js';
import { createLife, pickLife } from './entities/life.js';

// ---------- 画布 ----------
const canvas = document.getElementById('ocean-canvas');
const ctx = canvas.getContext('2d');
const loaderEl = document.getElementById('loader');

// ---------- 对象池 ----------
const jellyfish = [];
const schools = [];
const turtles = [];
const plankton = [];
const bubbles = [];
const seaweeds = [];
const ripples = [];
const baits = [];
const secrets = [];
// 阶段十一 B：人类与生活元素（游泳者/船/灯塔/海鸥/贝壳…）
const life = [];
// 本局已经「看见过」的元素类别（内存态）。explore.discover 已经会跨存档去重，
// 这个表只是为了省掉每帧一次 String 拼接 + Set 查询。
const sightedKinds = {};

// 水深带跟踪（探索发现用）。声明必须在这里 —— setTerrain / refreshDepthBand
// 都会写它，而 setTerrain 在启动早期就会被调用；若声明留在文件下方的
// `let lastBandId = null`，赋值会撞上 TDZ 直接抛 ReferenceError。
let lastBandId = null;
const BAND_ORDER = BANDS.map((x) => x.id);
const BAND_INDEX = {};
BAND_ORDER.forEach((id, i) => { BAND_INDEX[id] = i; });
// 每个带的代表深度：跨档补记时用它反查 band 对象（bandAt 需要 depth 参数）
const BAND_MID = {
  land: -50, beach: 75, shallow: 265, nearshore: 540, midsea: 865, deepsea: 1200,
};

// ---------- 子系统 ----------
const audio = createAudio();
const perfMon = createPerf();
const collision = { spawned: 0 };

// ---------- 统计（成就判定用） ----------
const stats = {
  summoned: 0,   // 召唤的水母数
  fed: 0,        // 投喂次数
  mutations: 0,  // 变异次数
  breeds: 0,     // 繁育次数（阶段六）
  get speciesFound() { return collection ? collection.size : 0; },
  get speciesTotal() { return collection ? collection.total : 6; },
};

const collection = createCollection(
  (idx) => {
    hud.toast('dex.new');
    hud.refreshDex();
    // 新物种闪光
    for (const j of jellyfish) {
      if (j.paletteIndex === idx) j.flash = 1;
    }
    // 午夜邂逅新种 -> 成就
    achievements.check(stats, { type: 'unlock', phase: dayNight.sun < 0.4 ? 'night' : 'day' });
  },
  () => {
    hud.toast('dex.complete');
    hud.refreshDex();
    spawnEggJelly();
    achievements.check(stats, { type: 'dex' });
  }
);

// 池塘存档：把当前水母落盘，重开即"你的池塘"
// 阶段八：存档元数据（mode / buildings）由 getMeta 注入
// 阶段十：加入 worldType / seed / companion
const save = createSave(() => jellyfish, () => ({
  mode: mode.serialize(),
  worldType: world.id,
  // 阶段十一：地形 + 相机也要落盘，否则重进游戏会「换了片海」
  terrain: terrainRef.current.type,
  seed: world.seedStr,
  companion: companionVariantId,
  starter: starterKit ? 1 : 0,
  camera: { x: Math.round(camera.x), y: Math.round(camera.y) },
  buildings: build.serialize(),
}));

// 成就系统：解锁时弹 toast + 更新 HUD 星标
const achievements = createAchievements((a) => {
  hud.toastKey('ach.unlocked', { name: t(a.label) });
  hud.refreshAch(achievements.count);
});

// ---------- 阶段六：生物荧光经济 + 专长 + 繁育 ----------
const economy = createEconomy({
  getMultiplier: () => specialize.multiplier() * build.yieldMultiplier(),
  onGain: () => { if (hud.refreshBio) hud.refreshBio(economy.bio); },
});
const specialize = createSpecialize(economy, (id, lv) => {
  hud.toastKey('lab.specUp', { name: t('spec.' + id), lv });
  if (hud.refreshBio) hud.refreshBio(economy.bio);
  if (lab.isOpen) lab.render();
});

// ---------- 阶段八：模式 + 建造 ----------
const mode = createMode({
  onMode: () => { save.markDirty(); },
});
const build = createBuild({
  economy,
  onPlaced: (mod, b) => {
    hud.toastKey('build.placed', { name: t(mod.label) });
    if (hud.refreshBio) hud.refreshBio(economy.bio);
    save.markDirty();
    void b;
  },
  onRemove: (b) => {
    // 返还一半荧光
    const mod = build.moduleOf(b.id);
    if (mod) economy.gain(Math.round(mod.cost * 0.5));
    hud.toastKey('build.removed', { name: t(mod ? mod.label : 'build.remove') });
    save.markDirty();
  },
  onError: (k) => hud.toast(k),
});

// ---------- 阶段十：世界（群系）+ 伴随水母 ----------
const worldRef = { current: createWorld({ type: 'coral', seed: '' }) };
const world = {
  get id() { return worldRef.current.id; },
  get seedStr() { return worldRef.current.seedStr; },
  get baseTint() { return worldRef.current.baseTint; },
  get haze() { return worldRef.current.haze; },
  get rays() { return worldRef.current.rays; },
  get feature() { return worldRef.current.feature; },
  get predatorSafe() { return worldRef.current.predatorSafe; },
  get mechanics() { return worldRef.current.mechanics; },
  get decor() { return worldRef.current.decor; },
  speciesWeight(i) { return worldRef.current.speciesWeight(i); },
  get forcedMushroom() { return worldRef.current.forcedMushroom; },
};

// ---------- 阶段十一：地形 + 相机（开放世界） ----------
const cam = createCamera();
const terrainRef = { current: createTerrain({ type: 'shore', seed: '' }) };
// 对外只暴露只读的采样接口，避免别处直接改 terrain 内部状态
const terrain = {
  get type() { return terrainRef.current.type; },
  get params() { return terrainRef.current.params; },
  depthAt(x, y) { return terrainRef.current.depthAt(x, y); },
  zoneAt(x, y) { return terrainRef.current.zoneAt(x, y); },
  shoreLineAt(x) { return terrainRef.current.shoreLineAt(x); },
  surfaceAt(x) { return terrainRef.current.surfaceAt(x); },
  landHeightAt(x, y) { return terrainRef.current.landHeightAt(x, y); },
  temperatureAt(x) { return terrainRef.current.temperatureAt(x); },
  isLand(x, y) { return terrainRef.current.isLand(x, y); },
  samplePoint(b, r) { return terrainRef.current.samplePoint(b, r); },
  homePoint() { return terrainRef.current.homePoint(); },
};

// 调试 / 自动化测试探针。
//
// 为什么需要它：相机与地形都是纯数据驱动，无头浏览器里没法靠肉眼看画面
// 判断「视角到底走没走动」「地形到底切没切换」。挂一个显式入口后，
// 自动化测试就能断言 camera.x 是否推进、depthAt 是否随种子变化 ——
// 11A 期间正是靠它发现 camera.x 静默变成 NaN（画面正常但世界锁死）。
//
// 只读 + 一个切地形入口，生产运行时它就是个普通对象，不参与任何游戏逻辑。
if (typeof window !== 'undefined') {
  window.__ocean = {
    get camera() {
      // 注意：cam 是「相机实例」，它的 getter 只暴露 scale/vw/vh；
      // x/y/tx/ty 存在 state 的 camera 数据对象上，必须从这里读。
      return { x: camera.x, y: camera.y, tx: camera.tx, ty: camera.ty, scale: cam.scale, vw: cam.vw, vh: cam.vh };
    },
    get terrain() { return terrainRef.current.type; },
    get terrainSeed() { return terrainRef.current.seedStr; },
    bandAt(x, y) { const b = bandOf(terrainRef.current.depthAt(x, y)); return { id: b.id, key: b.key }; },
    depthAt(x, y) { return terrainRef.current.depthAt(x, y); },
    get home() { return terrainRef.current.homePoint(); },
    /** 生命元素：数量 / 类型分布 / 世界坐标（测试与调试用） */
    get life() {
      return life.map((it) => ({ kind: it.constructor.name, x: Math.round(it.x), y: Math.round(it.y) }));
    },
    /** 命中测试：给定世界坐标是否点中某个生命元素 */
    lifeHit(x, y) {
      const hit = pickLife(life, x, y);
      return hit ? hit.constructor.name : null;
    },
    /** 切地形并回到该地形的家。11B 的「新建世界」面板会走同一条路径。 */
    setTerrain(type, seed) {
      setTerrain(type, seed);
      goHome(true);
      return terrainRef.current.type;
    },
  };
}

// 地形重建钩子：相机重算边界、场景重算岸线缓存等都在这里挂载
const terrainRebuildHooks = [];

/** 换地形：重建 terrain + 通知所有关心地形的系统 */
function setTerrain(type, seed, { announce = false } = {}) {
  const ty = isTerrainType(type) ? type : 'shore';
  terrainRef.current = createTerrain({ type: ty, seed: seed || '' });
  for (const fn of terrainRebuildHooks) fn(terrainRef.current);
  if (announce) hud.toastKey('terrain.changed', { name: t('terrain.' + ty) });
  // 换地形后水深带必然变化：把上一次的带清掉，否则新地形若恰好落在同一个带，
  // HUD 不会刷新（`b.id === lastBandId` 提前 return），玩家会看到旧标签。
  lastBandId = null;
  // 岸线本身也算一次发现 —— 三种地形各自望见一次
  if (explore) {
    // 放到下一个宏任务里：setTerrain 在启动早期就会被调用（此时 explore 可能
    // 尚未构造完成），而发现播报要等 HUD 就绪才好看。
    setTimeout(() => {
      if (explore.discover('terrain:' + ty)) {
        hud.toastKey('discover.terrain', { name: t('terrain.' + ty) });
      }
    }, 0);
  }
  return terrainRef.current;
}

/**
 * 把玩家 + 相机放到该地形的「家」。
 *
 * 目标构图：**水线落在可见区上方约 1/4 处**（0.26），上方是沙滩/陆地，
 * 下方是逐级变深的海。三种地形、所有视口都一样。
 *
 * 地形层的 homePoint() 只返回「水线在世界里的 y」；偏移量必须在这里算，
 * 因为「水线该出现在屏幕哪个高度」是视口相关的事，地形不知道 vh。
 *
 * 【为什么要夹住偏移量】
 *   理想位置是 cy = waterline + vh*0.26。但相机有世界边界（见 camera.bounds），
 *   当视口很高（手机竖屏 vh 能到 2160）时，cy + vh 会超出世界水底 y1，
 *   相机被夹回 y1-vh，于是水线被推到屏幕很下面 —— 实测竖屏水线落在 0.62，
 *   玩家看到的是「一片海，岸在屏幕中间偏下」，构图和桌面完全不一致。
 *
 *   不能靠「把世界做大」解决：世界变高 → 竖屏的 vh 同比变大 → 需求同比变大，
 *   这是个追不上的循环（实测不动点要求 h≈7400，世界会变成一条细长海沟，
 *   桌面缩放直接崩掉）。
 *
 *   正确做法是承认「高视口放不下理想构图」，改为**退让**：
 *   把偏移量压到相机容许的最大值，让水线尽量靠上，而不是硬顶在边界。
 *   竖屏下最终水线约在 0.35~0.45，比桌面略低但仍是「上陆下海」的构图；
 *   桌面/横屏不受影响，依然精确命中 0.26。
 */
function goHome(snap) {
  const h = terrain.homePoint();
  // 偏移量取「景物尺度」和「视口尺度」的较大者：
  //   span*0.5 —— 让景物（尤其孤岛）完整入画，不被偏出屏幕
  //   vh*0.26  —— 让水线落在可见区上方 1/4 处（shore / slope 的常规构图）
  // 二者取 max 而不是分地形写分支，是为了让新增地形自动获得合理构图。
  const off = Math.max((h.span || 0) * 0.5, cam.vh * 0.26);
  let cy = h.y + off;
  // 相机 y 的合法区间（与 camera.bounds 保持一致）。
  // 高视口（竖屏 vh 能到 2100+）下 cy + vh 会超出世界水底 y1，
  // 此时只能退让、把景物放到屏幕更下方 —— 靠放大世界解决不了，
  // 因为世界变高时 vh 同比变大，需求会一起涨（实测不动点要 h≈7400）。
  const minY = WORLD.y0;
  const maxY = Math.max(WORLD.y0, WORLD.y1 - cam.vh);
  cy = Math.max(minY, Math.min(maxY, cy));
  cam.centerOn(h.x, cy, snap !== false);
}

let companionVariantId = 'lucy';
let companion = null;
let starterKit = false;

/**
 * 阶段十：按当前群系的物种权重随机挑一个配色下标。
 * 各群系偏好不同水母（如珊瑚礁偏暖、极地冰海偏蓝）。
 */
function pickPalette(exclude) {
  return weightedPaletteIndex((i) => world.speciesWeight(i), exclude);
}

/** 生成/替换伴随水母（玩家身份标识，跟随光标） */
function spawnCompanion(variant) {
  companionVariantId = variant || companionVariantId;
  // 阶段十一：伴随水母用世界坐标，出生在相机视口中心偏右
  companion = new Companion(cam.toWorldX(view.W * 0.5 + 120), cam.toWorldY(view.H * 0.5), {
    variant: companionVariantId,
  });
  updateCompanionPortrait();
}

/** 把伴随水母配色画到 HUD 小头像 */
function updateCompanionPortrait() {
  const c = document.getElementById('companion-portrait');
  if (!c || !companion) return;
  c.classList.remove('hide');
  const ctx2 = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx2.clearRect(0, 0, W, H);
  const v = companion.variant;
  // 底晕
  const g = ctx2.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W / 2);
  g.addColorStop(0, hexA(v.glow, 0.5));
  g.addColorStop(1, hexA(v.glow, 0));
  ctx2.fillStyle = g;
  ctx2.fillRect(0, 0, W, H);
  // 伞盖
  const r = W * 0.32;
  const body = ctx2.createRadialGradient(W / 2 - r * 0.3, H / 2 - r * 0.3, r * 0.1, W / 2, H / 2, r);
  body.addColorStop(0, v.accent);
  body.addColorStop(0.55, v.core);
  body.addColorStop(1, v.glow);
  ctx2.fillStyle = body;
  ctx2.beginPath();
  ctx2.ellipse(W / 2, H / 2 + 2, r, r * 0.82, 0, Math.PI, 0);
  ctx2.closePath();
  ctx2.fill();
  // 触须
  ctx2.strokeStyle = hexA(v.tent, 0.8);
  ctx2.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) {
    ctx2.beginPath();
    ctx2.moveTo(W / 2 + i * r * 0.5, H / 2 + 2);
    ctx2.lineTo(W / 2 + i * r * 0.7, H / 2 + r * 1.4);
    ctx2.stroke();
  }
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * 绘制当前群系的标志结构（由 world.decor 派生位置，同种子同布局）。
 * coral 珊瑚丛 / ice 浮冰 / vent 火山微光 / neon 荧光粒子 / mycelium 菌丝微光
 */
function drawWorldDecor(c, t) {
  const feat = world.feature;
  const decor = world.decor || [];
  if (!decor.length) return;
  c.save();
  // 阶段十一：decor 的 x/y 是「相对可见范围的 0..1」，映射到相机可视矩形上，
  // 于是无论镜头移到世界哪里，装饰密度看起来都一样。
  const vr = cam.visibleRect(0);
  const vw = vr.x1 - vr.x0;
  const vh = vr.y1 - vr.y0;
  for (const d of decor) {
    const x = vr.x0 + d.x * vw;
    const y = vr.y0 + d.y * vh;
    const s = d.s;
    const ph = d.ph;
    switch (feat) {
      case 'coral': {
        // 多色扇珊瑚
        const cols = ['#ff8fb0', '#ffb26b', '#8affc0', '#8fd0ff'];
        for (let i = 0; i < 4; i++) {
          const col = cols[i % cols.length];
          const bx = x + (i - 1.5) * 14 * s;
          c.strokeStyle = hexA(col, 0.5);
          c.lineWidth = 3 * s;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(bx, y + 30 * s);
          c.quadraticCurveTo(bx + Math.sin(t * 0.0008 + ph + i) * 6, y + 6 * s, bx, y - 10 * s);
          c.stroke();
        }
        break;
      }
      case 'ice': {
        // 浮冰（蓝冰反光）
        const a = 0.18 + Math.sin(t * 0.0004 + ph) * 0.05;
        c.fillStyle = `rgba(180, 220, 255, ${a})`;
        c.beginPath();
        c.ellipse(x, y, 34 * s, 18 * s, ph, 0, TAU);
        c.fill();
        c.strokeStyle = 'rgba(220, 240, 255, 0.25)';
        c.lineWidth = 1.2;
        c.stroke();
        break;
      }
      case 'vent': {
        // 火山口 + 暗红脉动光
        const pulse = 0.4 + Math.sin(t * 0.002 + ph) * 0.25;
        const g = c.createRadialGradient(x, y, 2, x, y, 60 * s);
        g.addColorStop(0, `rgba(255, 90, 60, ${pulse * 0.5})`);
        g.addColorStop(1, 'rgba(255, 60, 40, 0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, 60 * s, 0, TAU);
        c.fill();
        c.fillStyle = `rgba(90, 30, 25, ${0.5})`;
        c.beginPath();
        c.moveTo(x - 18 * s, y + 14 * s);
        c.lineTo(x, y - 16 * s);
        c.lineTo(x + 18 * s, y + 14 * s);
        c.closePath();
        c.fill();
        break;
      }
      case 'neon': {
        // 悬浮荧光粒子
        for (let i = 0; i < 6; i++) {
          const px = x + Math.sin(t * 0.0006 + ph + i * 1.7) * 30 * s;
          const py = y + Math.cos(t * 0.0007 + ph + i * 2.1) * 30 * s;
          const a = 0.3 + Math.sin(t * 0.003 + i + ph) * 0.25;
          c.fillStyle = hexA(['#8affd0', '#8fd0ff', '#d08fff'][i % 3], a);
          c.beginPath();
          c.arc(px, py, 3 * s, 0, TAU);
          c.fill();
        }
        break;
      }
      case 'mycelium': {
        // 菌丝微光（粉彩圆点 + 柔光）
        const a = 0.2 + Math.sin(t * 0.0015 + ph) * 0.1;
        const g = c.createRadialGradient(x, y, 2, x, y, 44 * s);
        g.addColorStop(0, `rgba(230, 200, 255, ${a})`);
        g.addColorStop(1, 'rgba(200, 170, 240, 0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, 44 * s, 0, TAU);
        c.fill();
        break;
      }
      default: break;
    }
  }
  c.restore();
}

function spawnEggJelly() {
  // 阶段十一：出现在相机视口中心（世界坐标）
  const ex = cam.toWorldX(view.W / 2);
  const ey = cam.toWorldY(view.H / 2);
  const j = new Jellyfish(ex, ey, 0, {});
  j.r = 64; j.baseR = 64; j.scale = 1;
  j._buildTentacles();
  j.egg = true;
  jellyfish.push(j);
  for (let i = 0; i < 40; i++) {
    bubbles.push(new Bubble(ex + rand(-60, 60), ey + rand(-40, 40), true));
  }
  ripples.push(new Ripple(ex, ey));
}

const feeding = createFeeding(baits, (x, y) => {
  audio.sfx('tap');
  stats.fed++;
  economy.gain(2);   // 投喂产出生物荧光
  achievements.check(stats, { type: 'feed' });
});

// ---------- 标题屏（MC 式菜单） ----------
const home = createHome({
  onStart: () => {
    // 首次进入：借用户手势解锁音频（浏览器自动播放策略）
    audio.unlock();
  },
  onToast: (key) => hud.toast(key),
  hasSave: () => save.hasSave(),
  onContinue: () => {
    // 继续：直接恢复上次池塘（存档已在启动时恢复）
    audio.unlock();
    hud.refreshZone && hud.refreshZone(zones.label);
    coach.start();
    maybeAnnounceRare();
  },
  onNewWorld: () => { createPanel.show(); },
  onOpenSettings: () => { settings.toggle(); },
  onReset: () => {
    if (!window.confirm(t('pond.reset.confirm'))) return false;
    save.reset();
    collection.reset();
    achievements.reset();
    economy.reset();
    specialize.reset();
    explore.reset();
    quests.reset();
    zones.setZone('shallow', true);
    // 阶段八：重置模式与建造
    build.reset();
    mode.restore('peace');
    // 阶段十：重置世界与伴随水母
    companion = null;
    companionVariantId = 'lucy';
    starterKit = false;
    const portrait = document.getElementById('companion-portrait');
    if (portrait) portrait.classList.add('hide');
    // 隐藏纪念内容一并清除（避免从重置状态反推）
    if (memory) memory.reset();
    bogyo = null;
    stats.summoned = 0;
    stats.fed = 0;
    stats.mutations = 0;
    stats.breeds = 0;
    if (hud.refreshBio) hud.refreshBio(economy.bio);
    clearWorld();
    seedWorld(null);
    save.markDirty();
    save.write();
    hud.refreshDex();
    hud.refreshAch(0);
    dex.render();
    return true;
  },
});

// ---------- 图鉴面板 ----------
const dex = createDex();

// ---------- 明信片分享 ----------
const share = createShare(
  () => canvas,
  () => home.name,
  (key) => hud.toast(key)
);

// ---------- 轻量玩法：引水母归巢 ----------
const activity = createActivity(() => jellyfish, {
  onSuccess: () => {
    hud.toast('activity.success');
    ripples.push(new Celebrate(cam.toWorldX(view.W / 2), cam.toWorldY(view.H / 2), '160, 255, 200', 320));
    // 达成也计入一个小统计（可选）
    stats.summoned += 0;
  },
  onStateChange: (s) => hud.refreshActivity(s === 'active'),
});

// ---------- 洋流系统（阶段五 · 4.1） ----------
const current = createCurrent();

// ---------- HUD ----------
/** 统一的声音开关（HUD 按钮与设置面板共用），返回最新状态 */
function toggleSound() {
  const on = audio.toggle();
  const btn = document.getElementById('sound-btn');
  if (btn) {
    btn.textContent = on ? '🔊' : '🔇';
    btn.classList.toggle('muted', !on);
  }
  return on;
}

const hud = createHud({
  toggleSound,
  toggleLang: () => {
    toggleLang();
    hud.refreshLang();
    hud.refreshButtons();
    home.refreshLang();
    if (settings.isOpen) settings.render();
  },
  toggleTheme: () => {
    theme.toggle();
    hud.refreshTheme();
  },
  toggleFeed: () => {
    const on = feeding.toggle();
    hud.refreshButtons();
  },
  toggleDayNight: () => {
    dayNight.enabled = !dayNight.enabled;
    hud.refreshButtons();
    hud.refreshPhase();
  },
  isFeedMode: () => feeding.mode,
  openDex: () => dex.toggle(),
  share: () => share.capture(),
  toggleActivity: () => {
    activity.toggle();
    hud.refreshButtons();
  },
  toggleCurrent: () => {
    const on = current.toggle();
    document.body.classList.toggle('current-mode', on);
    if (on) hud.toast('btn.current');
    hud.refreshButtons();
    return on;
  },
  isCurrentMode: () => current.mode,
  openLab: () => lab.toggle(),
  openAtlas: () => atlas.toggle(),
  openBuild: () => buildPad.toggle(),
  openSettings: () => settings.toggle(),
});

// ---------- 生态系统 / 温和大鱼（阶段五 · 4.2；阶段八 8B 冒险掠食） ----------
const ecosystem = createEcosystem({
  plankton, schools, jellyfish, current,
  onEvent: (k) => hud.toast(k),
  getMode: () => mode.current,
  // 阶段十：蘑菇海（mycelium）无掠食者 —— 对应 MC 蘑菇岛无敌对生物
  predatorSafe: () => world.predatorSafe,
  // 冒险模式中档失败：叼走一只（优先保护特殊个体）
  onSnatch: (j) => {
    if (!mode.isAdventure() || !j || j.isMemory) return false;
    // 保护：稀有 / 杂交 / 已被玩家点过多次的个体不放第一个牺牲
    let victim = j;
    if (j.rare || j.hybrid) {
      victim = jellyfish.find((x) => !x.rare && !x.hybrid && !x.isMemory && x !== j) || null;
      if (!victim) return false;    // 全是特殊个体 → 这次不叼
    }
    const i = jellyfish.indexOf(victim);
    if (i < 0) return false;
    jellyfish.splice(i, 1);
    stats.snatched = (stats.snatched || 0) + 1;
    hud.toastKey('adventure.snatch', { name: t('jelly.' + JELLY_PALETTES[victim.paletteIndex].key) });
    audio.sfx('snatch');
    ripples.push(new Celebrate(victim.x, victim.y, '255, 120, 120', 180));
    for (let k = 0; k < 14; k++) bubbles.push(new Bubble(victim.x + rand(-26, 26), victim.y + rand(-18, 18), true));
    save.markDirty();
    return true;
  },
  isSheltered: (x, y) => build.isSheltered(x, y),
});

// ---------- 阶段六：繁育 + 繁育/专长面板 ----------
const breeding = createBreeding({
  jellyfish,
  cap: () => Math.round(quality.jellyfish * 2.5),
  getMutateBonus: () => specialize.mutateBonus(),
  onBreed: (child, info) => {
    stats.breeds++;
    economy.gain(10 + (info.hybrid ? 8 : 0) + info.mutated.length * 4);
    hud.toastKey('lab.bred', {
      name: t('jelly.' + JELLY_PALETTES[child.paletteIndex].key),
      tag: info.hybrid ? t('lab.hybrid') : (info.mutated.length ? t('lab.mutatedTrait') : ''),
    });
    ripples.push(new Celebrate(child.x, child.y, '180, 235, 255', 200));
    collection.see(child.paletteIndex, child.traits);
    if (hud.refreshBio) hud.refreshBio(economy.bio);
    if (lab.isOpen) lab.render();
    audio.sfx('breed');
  },
});

const lab = createLab({ economy, specialize, getBreeds: () => stats.breeds });

// ---------- 阶段七：海域 / 探索 / 叙事 / 目标 ----------
const explore = createExplore(
  (id, n) => {
    hud.toastKey('explore.found', { n });
    economy.gain(6);
    quests.check(questCtx());
    if (hud.refreshBio) hud.refreshBio(economy.bio);
  },
  (id) => {
    hud.toastKey('zone.unlocked', { name: t('zone.' + id) });
    // 解锁后立即布置该海域的秘密 + 推进故事
    setupZoneContent(id);
  },
);
const story = createStory(explore, (f) => {
  hud.toastKey('story.reveal', { text: t(f.key) });
});
const zones = createZones(explore, stats);

const quests = createQuests({
  onComplete: (q) => {
    hud.toastKey('quest.done', { name: t(q.label) });
    economy.gain(q.reward);
    if (hud.refreshBio) hud.refreshBio(economy.bio);
  },
});

const atlas = createAtlas({ explore, zones, story, quests });
setZoneProvider(zones);   // 背景 / 景深读取海域色调

// ---------- 阶段八：建造面板 + 选模式 ----------
const buildPad = createBuildPad({
  build, economy,
  onToast: (k) => hud.toast(k),
});
// 建造"放置"流程：面板里选好模块后，进入放置模式，下一次点击海域即落位
const buildPlace = { active: false, id: null, remove: false };

// ---------- 阶段十：新建世界面板（MC 式） ----------
/** 应用一份世界配置：世界名 / 模式 / 群系 / 种子 / 伴随水母 / 起始礼包 */
function applyWorldConfig(cfg, { announce = true } = {}) {
  mode.set(cfg.mode);
  const w = createWorld({ type: cfg.worldType, seed: cfg.seed });
  worldRef.current = w;              // 用同一实例更新内部群系与种子
  zones.setWorldProvider(w);
  // 阶段十一：地形也随世界配置切换（拖动/方向键能走到的地形）
  const ty = isTerrainType(cfg.terrain) ? cfg.terrain : 'shore';
  setTerrain(ty, cfg.seed || '');
  // 相机回到该地形的家；如果是读档，稍后会被 restoreParams 覆盖
  if (cfg.camera && typeof cfg.camera.x === 'number') {
    cam.jumpTo(cfg.camera.x, cfg.camera.y);
  } else {
    goHome(true);
  }
  if (cfg.name) home.setName(cfg.name);
  spawnCompanion(cfg.companion);
  starterKit = !!cfg.starter;
  if (hud.refreshZone) hud.refreshZone(zones.label);
  hud.refreshWorld && hud.refreshWorld(w.id, w.seedStr, w.forcedMushroom);
  if (starterKit) {
    economy.gain(40);
    if (hud.refreshBio) hud.refreshBio(economy.bio);
  }
  save.markDirty();
  save.write();
  if (announce) {
    hud.toastKey('create.ready', { world: t(worldById(w.id).label) });
  }
}

const createPanel = createWorldPanel({
  onConfirm: (cfg) => {
    audio.sfx('mode');
    // 全新世界：清空并重新播种
    clearWorld();
    applyWorldConfig(cfg, { announce: false });
    seedWorld(null);
    if (memory.unlocked) spawnBogyo(false);
    if (cfg.starter) {
      // 起始礼包：送一小片珊瑚丛
      setTimeout(() => { economy.gain(20); if (hud.refreshBio) hud.refreshBio(economy.bio); }, 0);
    }
    coach.start();
    maybeAnnounceRare();
    hud.toastKey('create.started', { world: t(worldById(worldRef.current.id).label) });
    // 关键：新建世界就等于「进入游戏」。必须收掉标题屏，
    // 否则它会一直盖在 canvas 上面，玩家看不见（也玩不到）刚生成的世界。
    home.enter();
  },
  onPreview: (worldType, seed, terrainType) => {
    // 实时预览：按群系更新背景叠加色（不落盘、不重建世界）
    zones.setWorldProvider(createWorld({ type: worldType, seed }));
    // 地形预览：把面板选中的岸线也切过去，方便玩家临场对比
    const ty = isTerrainType(terrainType) ? terrainType : 'shore';
    if (terrainRef.current.type !== ty) {
      setTerrain(ty, seed || '');
      goHome(true);
    }
  },
  onToast: (k) => hud.toast(k),
});

buildPad.onSelectModule((id) => {
  if (id) {
    buildPlace.active = true;
    buildPlace.id = id;
    buildPlace.remove = false;
    document.body.classList.add('build-mode');
  } else {
    // null = 进入移除模式
    buildPlace.active = true;
    buildPlace.id = null;
    buildPlace.remove = true;
    document.body.classList.add('build-mode');
  }
});

// ---------- 隐藏纪念内容（Bogyó） ----------
// 他不是水母：独立实体 + 独立调度条目，不进入 jellyfish 数组，
// 因而不参与洋流 / 繁育 / 图鉴 / 存档。
let bogyo = null;

/** 把 Bogyó 放进海洋（已存在则不重复添加） */
function spawnBogyo(announce = true) {
  if (bogyo) return bogyo;
  // 阶段八（决策 4）：冒险模式不出现 —— 他只在和平的家里安睡
  if (mode.isAdventure()) return bogyo;
  const c = memory.content;
  const bvr = cam.visibleRect(0);
  bogyo = new Bogyo(rand(bvr.x0 + (bvr.x1 - bvr.x0) * 0.25, bvr.x0 + (bvr.x1 - bvr.x0) * 0.75),
    rand(bvr.y0 + (bvr.y1 - bvr.y0) * 0.3, bvr.y0 + (bvr.y1 - bvr.y0) * 0.6), {
    palette: c.palette,
    name: c.name,
  });
  if (announce) {
    ripples.push(new Celebrate(bogyo.x, bogyo.y, '255, 214, 150', 260));
    for (let i = 0; i < 24; i++) {
      bubbles.push(new Bubble(bogyo.x + rand(-40, 40), bogyo.y + rand(-30, 30), true));
    }
  }
  return bogyo;
}

const memory = createMemory(() => {
  spawnBogyo(true);
  hud.toastText(memory.content.greeting);
  audio.sfx('unlock');
});

const memoryPad = createMemoryPad(memory, {
  onUnlock: () => { save.markDirty(); },
});

/** 目标判定上下文 */
function questCtx() {
  let shrines = 0;
  for (const s of secrets) if (s.found && s.kind === 'shrine') shrines++;
  return {
    secrets: explore ? explore.count : 0,
    shrines,
    storyRead: story ? story.readCount : 0,
    zone: zones ? zones.current : 'shallow',
  };
}

/** 按海域布置秘密（清掉旧的未发现者，保留已发现的记录在 explore 中） */
function setupZoneContent(zoneId) {
  secrets.length = 0;
  for (const s of seedSecrets(zoneId)) {
    if (!explore.hasSecret(s.id)) secrets.push(s);
  }
  story.advance(zoneId);
  quests.check(questCtx());
}

// ---------- 设置面板 ----------
const settings = createSettings({
  toggleSound,
  // 用户手动选画质后关闭自动降级；选"自动"时重新开启
  onAutoQuality: (auto) => {
    if (auto) perfMon.enable && perfMon.enable();
    else perfMon.disable && perfMon.disable();
  },
});

// ---------- 首次进入引导 ----------
const coach = createCoach();

// ---------- 世界生成 ----------
const whale = new Whale((x, y) => {
  for (let i = 0; i < 12; i++) {
    bubbles.push(new Bubble(x + rand(-16, 16), y + rand(-8, 8), true));
  }
});

function clearWorld() {
  jellyfish.length = 0;
  schools.length = 0;
  turtles.length = 0;
  plankton.length = 0;
  seaweeds.length = 0;
  bubbles.length = 0;   // 修复原版内存累积
  ripples.length = 0;
  baits.length = 0;
  life.length = 0;
  // 清空「本局已看见」缓存：换世界后重新播报一次，玩家才知道新岸线上有什么
  for (const k of Object.keys(sightedKinds)) delete sightedKinds[k];
}

function seedWorld(keepJelly) {
  clearWorld();
  save.markDirty();

  // 阶段十一：出生 / 环境散布全部改用世界坐标，并避开陆地和极浅水。
  // spawnSpot 会在指定水深带里找点，找不到就退化为可见范围内的水域点。
  const vr = cam.visibleRect(120);

  // 第一屏的内容密度：实体不能均匀撒满整个可见区。
  // 竖屏的可见高度 1217 已经覆盖世界全高，均匀撒点会把水母摊薄到看不见 ——
  // 玩家进场看到空海会以为游戏坏了。这里给纵向加一个向中心收拢的权重，
  // 让出生点集中在「相机中心附近」的一带（占可见高约 62%），横向仍铺满。
  const spawnH = vr.h * 0.62;
  const spawnY0 = vr.y0 + (vr.h - spawnH) * 0.5;

  function spawnSpot(bandId, pad) {
    // 优先在可见范围内生成，保证一进场就能看到内容
    for (let i = 0; i < 24; i++) {
      const pd = pad || 0;
      const x = rand(vr.x0 - pd, vr.x1 + pd);
      const y = rand(spawnY0 - pd * 0.4, spawnY0 + spawnH + pd * 0.4);
      if (terrain.depthAt(x, y) > 20) return { x, y };
    }
    // 兜底：用采样器在整个世界里找该水深带
    const p = terrain.samplePoint(bandId || 'nearshore');
    return { x: p.x, y: p.y };
  }

  const jn = keepJelly && keepJelly.length ? 0 : quality.jellyfish;
  for (let i = 0; i < jn; i++) {
    // 阶段十：按群系权重选色，让每个世界的水母构成不同
    const s = spawnSpot('nearshore');
    jellyfish.push(new Jellyfish(s.x, s.y, pickPalette()));
  }
  if (keepJelly) {
    for (const j of keepJelly) jellyfish.push(j);
  }

  for (let i = 0; i < quality.fishSchools; i++) {
    const s = spawnSpot('midsea');
    schools.push(new FishSchool(s.x, s.y, quality.fishPerSchool));
  }
  const tc = isMobile ? 1 : 2;
  for (let i = 0; i < tc; i++) {
    const s = spawnSpot('shallow');
    turtles.push(new Turtle(s.x, s.y));
  }

  for (let i = 0; i < quality.plankton; i++) {
    const s = spawnSpot('nearshore');
    plankton.push(new Plankton(s.x, s.y));
  }
  // 海草长在浅水带（海底），沿可见范围横向铺开
  for (let i = 0; i < quality.seaweed; i++) {
    const fx = vr.x0 + ((vr.x1 - vr.x0) / (quality.seaweed + 1)) * (i + 1) + rand(-40, 40);
    // 往下找到该 x 处足够浅的水底
    let sy = terrain.shoreLineAt(fx) + 60;
    for (let k = 0; k < 12; k++) {
      if (terrain.depthAt(fx, sy) > 40) break;
      sy += 40;
    }
    seaweeds.push(new Seaweed(fx, sy));
  }
  for (let i = 0; i < quality.bubbles; i++) {
    const s = spawnSpot('shallow');
    bubbles.push(new Bubble(s.x, rand(s.y, vr.y1)));
  }
  // 阶段十一 B：人类与生活元素（按地形 + 种子确定性布点）
  seedLife();
}

/** 软重建：保留全部现有水母，只重置环境 */
function softRebuild() {
  // 尺寸变了 → 相机缩放和可见世界范围都要重算
  cam.resize();
  const kept = jellyfish.slice(0, quality.jellyfish * 1.5);
  const extra = jellyfish.slice(quality.jellyfish * 1.5);
  // 超出的水母重新撒到「当前可见的世界范围」内（保留，不再丢弃）
  const vr = cam.visibleRect(60);
  for (const j of extra) {
    j.x = rand(vr.x0, vr.x1);
    j.y = rand(vr.y0, vr.y1);
  }
  seedWorld(kept.concat(extra));
  save.markDirty();
}

/** 恢复上次的池塘；若无可恢复数据则生成全新世界 */
function restorePond() {
  // 阶段八：先恢复存档元数据（模式 / 建筑）
  // 阶段十：一并恢复世界（群系 / 种子）与伴随水母
  // 阶段十一：再加地形（岸线类型）与相机位置
  const meta = save.readMeta && save.readMeta();
  if (meta) {
    mode.restore(meta.mode);
    build.restore(meta.buildings);
    const w = createWorld({ type: meta.worldType || 'coral', seed: meta.seed || '' });
    worldRef.current = w;
    zones.setWorldProvider(w);
    // 旧档（v1/v2/v3）没有 terrain 字段 → 自动落到默认的 'shore'（经典海湾）
    const ty = isTerrainType(meta.terrain) ? meta.terrain : 'shore';
    setTerrain(ty, meta.seed || '');
    starterKit = !!meta.starter;
    spawnCompanion(meta.companion || 'lucy');
    hud.refreshWorld && hud.refreshWorld(w.id, w.seedStr, w.forcedMushroom);
  }
  // 相机：有存档坐标就恢复，否则回到家（出生点）
  if (meta && meta.camera && typeof meta.camera.x === 'number') {
    cam.jumpTo(meta.camera.x, meta.camera.y);
  } else {
    goHome(true);
  }
  // 同步「上次落盘位置」基准：否则恢复后的第一帧就会判定成「移动了」，
  // 立刻把同一个坐标再写一遍（无害但白费一次 localStorage 写入）。
  lastSavedCamX = camera.x;
  lastSavedCamY = camera.y;
  const params = save.restoreParams();
  if (!params || !params.length) {
    seedWorld(null);
    ensureDailyRare();
    return;
  }
  clearWorld();
  for (const p of params) {
    // 存档坐标在 v4 起就是世界坐标；v3 及以前是屏幕坐标，
    // save.restoreParams() 里已经做过迁移（往可见世界范围里摆放）。
    const j = new Jellyfish(p.x, p.y, p.paletteIndex, { restore: p });
    jellyfish.push(j);
  }
  // 环境照常生成（鱼群 / 海龟 / 浮游 / 气泡 / 海草）
  seedEnvironment();
  // 阶段十一 B：人类与生活元素
  seedLife();
  ensureDailyRare();
}

/**
 * 阶段十一 B：生成人类与生活元素。
 * 布点由 (地形, 种子) 决定 —— 同种子同布点，回到上次的位置会看到同一群人。
 * 密度随 quality 分级缩水（低配少一些，保住帧率）。
 */
function seedLife() {
  life.length = 0;
  // 世界种子：优先用群系种子，保证「抄同一个种子码 = 同一片海 + 同一批人」
  const seed = (worldRef.current && worldRef.current.seedStr) || terrainRef.current.seedStr || '';
  // 密度直接读 quality 档位的 life 键（见 config.QUALITY_TIERS）。
  // 早先这里是一段内联启发式（`isMobile ? 0.7 : 1.0` × 按 jellyfish 猜档位），
  // 问题是它把「生活元素密度」和「水母数量」耦合成同一个判断 ——
  // 以后只要有人调水母档位，岸上元素会莫名其妙跟着变。现在分开了。
  const dens = typeof quality.life === 'number' ? quality.life : (isMobile ? 0.7 : 1.0);
  const items = createLife(terrainRef.current, seed, dens);
  for (const it of items) life.push(it);
}

/**
 * 点击生命元素：播放其互动并从返回值里取出副作用
 * （音效 / 涟漪 / 提示 / 收集计数）。
 */
let shellsFound = 0;

function tapLife(wx, wy) {
  const hit = pickLife(life, wx, wy);
  if (!hit) return false;
  const r = hit.onTap && hit.onTap();
  if (!r) return true;          // 命中了但这次不产生副作用（如已拾起的贝壳）
  if (r.sfx) audio.sfx(r.sfx);
  if (r.ripple) ripples.push(new Ripple(r.ripple.x, r.ripple.y, r.ripple.r));
  if (r.toast) {
    // 贝壳这类可拾取物：toast 里带上累计数量，玩家能感到「在收集」。
    // 不新开 HUD 槽位 —— 拾取是低频动作，常驻一个计数反而挤占画面。
    if (r.collect) {
      shellsFound += r.collect;
      hud.toastKey('life.shells', { n: shellsFound });
    } else {
      hud.toast(r.toast);
    }
  }
  return true;
}

/** 只生成环境实体（鱼群 / 海龟 / 浮游 / 气泡 / 海草），不动水母 */
function seedEnvironment() {
  const vr = cam.visibleRect(120);
  function spot(pad) {
    for (let i = 0; i < 24; i++) {
      const x = rand(vr.x0 - (pad || 0), vr.x1 + (pad || 0));
      const y = rand(vr.y0 - (pad || 0), vr.y1 + (pad || 0));
      if (terrain.depthAt(x, y) > 20) return { x, y };
    }
    const p = terrain.samplePoint('nearshore');
    return { x: p.x, y: p.y };
  }
  for (let i = 0; i < quality.fishSchools; i++) {
    const s = spot(0);
    schools.push(new FishSchool(s.x, s.y, quality.fishPerSchool));
  }
  const tc = isMobile ? 1 : 2;
  for (let i = 0; i < tc; i++) {
    const s = spot(0);
    turtles.push(new Turtle(s.x, s.y));
  }
  for (let i = 0; i < quality.plankton; i++) {
    const s = spot(0);
    plankton.push(new Plankton(s.x, s.y));
  }
  for (let i = 0; i < quality.seaweed; i++) {
    const fx = vr.x0 + ((vr.x1 - vr.x0) / (quality.seaweed + 1)) * (i + 1) + rand(-40, 40);
    let sy = terrain.shoreLineAt(fx) + 60;
    for (let k = 0; k < 12; k++) {
      if (terrain.depthAt(fx, sy) > 40) break;
      sy += 40;
    }
    seaweeds.push(new Seaweed(fx, sy));
  }
  for (let i = 0; i < quality.bubbles; i++) {
    const s = spot(0);
    bubbles.push(new Bubble(s.x, rand(s.y, vr.y1)));
  }
}

/** 确保今日稀有客在池塘中存在一只（确定性，不重复添加） */
function ensureDailyRare() {
  const idx = dailyRareIndex();
  if (jellyfish.some((j) => j.rare)) return;
  // 若已存在同色普通个体，将其升级为稀有客，避免外形重复
  let host = jellyfish.find((j) => j.paletteIndex === idx && !j.mutated);
  if (host) {
    host.rare = true;
  } else {
    const j = new Jellyfish(undefined, undefined, idx, { rare: true });
    jellyfish.push(j);
  }
  save.markDirty();
}

/** 进入池塘时若今日尚未见过稀有客，提示一次 */
function maybeAnnounceRare() {
  try {
    const k = 'ocean.rareDay';
    const today = String(dailyRareIndex()) + '-' + new Date().toDateString();
    if (localStorage.getItem(k) !== today) {
      localStorage.setItem(k, today);
      setTimeout(() => hud.toast('daily.rare'), 1600);
    }
  } catch (e) { /* 忽略 */ }
}

// ---------- 生成 / 爆裂 ----------
function spawnJellyfish(x, y, juvenile) {
  const cap = quality.jellyfish * 2.5;
  if (jellyfish.length > cap) jellyfish.shift();
  const j = new Jellyfish(x, y, pickPalette(), {
    juvenile,
    // 冒险模式：水母可通过进食长得更大
    growthCap: mode.isAdventure() ? 2.0 : 1.0,
  });
  jellyfish.push(j);
  audio.sfx('tap');
  save.markDirty();
  // 召唤统计 + 成就（breeder=30 / summoner=25 都靠它）
  stats.summoned++;
  achievements.check(stats, { type: 'summon' });
  return j;
}

function createBurst(x, y) {
  ripples.push(new Ripple(x, y));
  for (let i = 0; i < 14; i++) {
    bubbles.push(new Bubble(x + rand(-20, 20), y + rand(-10, 10), true));
  }
  for (const j of jellyfish) {
    const dx = j.x - x, dy = j.y - y;
    if (dx * dx + dy * dy < 150 * 150) j.scare();
  }
  audio.sfx('tap');
}

/** 点击命中水母则计一次互动 */
/** 最近浮游（冒险进食用） */
function nearestPlankton(x, y) {
  let best = null, bestD = Infinity;
  for (const p of plankton) {
    const dx = p.x - x, dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = p; }
  }
  return best;
}

/** 点击命中水母则计一次互动 */
function hitJellyfish(x, y) {
  let hit = null, bestD = Infinity;
  for (const j of jellyfish) {
    const dx = j.x - x, dy = j.y - y;
    const d2 = dx * dx + dy * dy;
    const rr = j.baseR * j.scale * 1.6;
    if (d2 < rr * rr && d2 < bestD) { bestD = d2; hit = j; }
  }
  return hit;
}

/** 命中 Bogyó（猫：用他的身高而不是伞盖半径判定） */
function hitBogyo(x, y) {
  if (!bogyo) return false;
  const dx = x - bogyo.x;
  const dy = y - bogyo.y;
  const rr = bogyo.r * bogyo.scale * 1.8;
  return dx * dx + dy * dy < rr * rr;
}

function unlockJelly(j) {
  if (!j || j.egg || j.isMemory) return;   // 隐藏纪念水母不收录图鉴
  const idx = j.paletteIndex;
  if (!collection.has(idx)) {
    // 首次接触即收录
    collection.unlock(idx);
    dex.render();
  }
}

// ---------- 交互 ----------
let lastPointerTrail = 0;
// 拖动累计位移：超过阈值才认定是「拖视角」，否则仍当点击
let dragAccum = 0;
const DRAG_PAN_THRESHOLD = 8;

const interact = createInteract(canvas, {
  onMoveStart: () => {
    audio.unlock();
    dragAccum = 0; // 每次新手势重置，避免上次残留让轻点被当成拖动
  },
  onMoveEnd: () => {
    // 手势结束：解除「拖视角」状态，让水母重新回到光标吸引状态
    cam.setDragging(false);
  },
  onTap: (sx, sy) => {
    // 阶段十一：所有命中判定都在世界坐标系里做，所以入口一次性转换。
    // x / y 之后全部是「世界坐标」。
    const wx = cam.toWorldX(sx);
    const wy = cam.toWorldY(sy);
    const x = wx, y = wy;
    // 阶段十一 B：生命元素优先于其他命中。
    // 理由：它们是「实体物件」，而水面点击是「环境操作」——
    // 点在贝壳上应该拾贝壳，不是激涟漪。只在非建造模式下才让它们抢焦点，
    // 否则建造时想在水里放构件会被浅滩的游泳者挡住。
    if (!buildPlace.active && tapLife(x, y)) return;
    // 建造模式优先：点海域落位 / 点已放置构件移除
    if (buildPlace.active) {
      if (buildPlace.remove) {
        // 找到最近的可移除构件（命中半径内）
        let bi = -1, bd = Infinity;
        build.list.forEach((b, i) => {
          const d = Math.hypot(b.x - x, b.y - y);
          if (d < 60 && d < bd) { bd = d; bi = i; }
        });
        if (bi >= 0) {
          build.remove(bi);
          audio.sfx('remove');
        } else {
          buildPad.exitRemove();
          buildPlace.active = false; buildPlace.remove = false;
          document.body.classList.remove('build-mode');
          hud.toast('build.empty');
        }
      } else if (buildPlace.id) {
        if (build.place(buildPlace.id, x, y)) {
          audio.sfx('build');
          ripples.push(new Ripple(x, y));
          for (let i = 0; i < 10; i++) bubbles.push(new Bubble(x + rand(-24, 24), y + rand(-16, 16), true));
        }
        // 一次放置后退出建造模式，避免连续误放
        buildPad.clearSelection();
        buildPlace.active = false; buildPlace.id = null;
        document.body.classList.remove('build-mode');
      }
      save.markDirty();
      return;
    }
    if (feeding.mode) {
      feeding.drop(x, y);
      save.markDirty();
      return;
    }
    const j = hitJellyfish(x, y);
    // Bogyó 优先级最高：他是一只小猫，点他应该有回应
    if (hitBogyo(x, y)) {
      bogyo.tap();
      hud.toastText(bogyo.name);
      audio.sfx('tap');
      createBurst(x, y);
      return;
    }
    // 优先检测秘密（贝壳 / 冥想点）
    let hitSecret = null;
    for (const s of secrets) {
      if (!s.found && s.hit(x, y)) { hitSecret = s; break; }
    }
    if (hitSecret) {
      hitSecret.found = true;
      explore.discover(hitSecret.id);
      ripples.push(new Celebrate(hitSecret.x, hitSecret.y, '255, 236, 170', 200));
      audio.sfx('tap');
      save.markDirty();
      return;
    }
    if (j) {
      if (j.isMemory) {
        // 隐藏纪念水母：回应触摸，但不变异、不收录
        j.flash = 1;
        ripples.push(new Ripple(j.x, j.y));
        audio.sfx('tap');
        createBurst(x, y);
        return;
      }
      unlockJelly(j);
      const before = j.paletteIndex;
      // 阶段十：变异也遵循群系权重（更容易变成该群系偏好的物种）
      const mutated = j.interact((i) => world.speciesWeight(i));
      if (mutated) {
        // 变异事件：醒目提示前后配色名 + 扩散光环
        stats.mutations++;
        economy.gain(6);
        hud.toastKey('jelly.mutated', {
          from: t('jelly.' + JELLY_PALETTES[before].key),
          to: t('jelly.' + j.palette.key),
        });
        ripples.push(new Celebrate(j.x, j.y, '255, 216, 77', 240));
        collection.recordMutation(j.paletteIndex, before);
        dex.render();
        achievements.check(stats, { type: 'mutation' });
      } else if (!j.egg) {
        collection.see(j.paletteIndex, j.traits);
      }
      save.markDirty();
    }
    createBurst(x, y);
  },
  onHold: (sx, sy) => {
    // 与 onTap 一致：转成世界坐标再做命中
    const x = cam.toWorldX(sx);
    const y = cam.toWorldY(sy);
    // 长按 Bogyó：他会撒娇蹭一蹭（不召唤新水母）
    if (hitBogyo(x, y)) {
      bogyo.nuzzleMe();
      audio.sfx('nuzzle');
      ripples.push(new Ripple(bogyo.x, bogyo.y));
      return;
    }
    spawnJellyfish(x, y, true);
  },
  onDrag: (x, y, dx, dy) => {
    // 阶段十一：拖动主职责改成「平移视角」。小的抖动仍按点击处理
    // （interact.js 内部用 moved 标志区分，这里只负责把位移喂给相机）。
    cam.panBy(dx, dy);
    dragAccum += Math.abs(dx) + Math.abs(dy);
    if (dragAccum > DRAG_PAN_THRESHOLD) cam.setDragging(true);
    // 只有明确拖动之后才继续喂洋流，避免手指轻抖把整片水搅乱
    if (dragAccum > DRAG_PAN_THRESHOLD && current.mode) {
      const w = cam.toWorld(x, y);
      current.push(w.x, w.y, dx / cam.scale, dy / cam.scale);
    }
  },
});

// 音频解锁：挂 window，任意首次交互都生效
const unlockOnce = () => { audio.unlock(); };
window.addEventListener('pointerdown', unlockOnce, { once: true, capture: true });
window.addEventListener('touchstart', unlockOnce, { once: true, capture: true, passive: true });

// ---------- 键盘移动（WASD / 方向键平移视角）----------
// 只在没有输入焦点（非输入框）时生效，避免打字时视角乱跑。
const KEY_DIRS = {
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
};

function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

const heldKeys = new Set();

function refreshKeyAxis() {
  let ax = 0, ay = 0;
  for (const code of heldKeys) {
    const d = KEY_DIRS[code];
    if (d) { ax += d[0]; ay += d[1]; }
  }
  camInput.x = Math.max(-1, Math.min(1, ax));
  camInput.y = Math.max(-1, Math.min(1, ay));
}

function onKeyDown(e) {
  if (isTypingTarget(e.target)) return;
  // 只拦截我们真正处理的键，别抢走浏览器快捷键（如 F5 / Cmd+R）
  if (!KEY_DIRS[e.key]) return;
  heldKeys.add(e.key);
  refreshKeyAxis();
  // 方向键会滚动页面，需要阻止
  if (e.key.startsWith('Arrow')) e.preventDefault();
}

function onKeyUp(e) {
  if (!heldKeys.has(e.key)) return;
  heldKeys.delete(e.key);
  refreshKeyAxis();
}

function onKeyBlur() {
  heldKeys.clear();
  refreshKeyAxis();
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', onKeyBlur);

// 把地形交给场景层（岸线 / 海床 / 深度雾 / 光束衰减都依赖它）
setTerrainProvider(terrain);

// ---------- 调度器 ----------
const scheduler = createScheduler();

scheduler.add(createDayNight());
scheduler.add(createBackground());
// 阶段十一：岸线 + 海床，画在背景之上、光束之下
scheduler.add(createTerrainLayer());
// 阶段十：群系标志结构（珊瑚/浮冰/热泉/荧光/菌丝），画在背景之上、光束之下
scheduler.add({
  id: 'worldDecor', space: 'world', order: 1,
  draw: (c, t) => drawWorldDecor(c, t),
});
scheduler.add({
  id: 'build', space: 'world', order: 6,
  draw: (c, t) => build.draw(c, t),
});
scheduler.add({
  id: 'whale', space: 'world', order: 1,
  update: (dt, t) => whale.update(dt),
  draw: (c) => whale.draw(c),
});
scheduler.add(createLightRays());
// 阶段十一 B：人类与生活元素。
// order 3 —— 画在光束之上、水母之下：它们是「远景人事」，
// 不该盖住作为主角的水母，但要盖住背景与光束。
scheduler.add({
  id: 'life', space: 'world', order: 3,
  update: (dt) => {
    const vr = cam.visibleRect(160);
    for (const it of life) {
      // 视口裁剪：只有可见（含一屏缓冲）的元素才更新，省掉大量无用计算
      if (it.x < vr.x0 || it.x > vr.x1 || it.y < vr.y0 || it.y > vr.y1) continue;
      it.update(dt);
      // 发现机制：某类元素第一次进入视野时播报一次（explore 内部去重，
      // 所以这里每帧调用也不会重复弹）。
      if (it.kind && !sightedKinds[it.kind]) {
        sightedKinds[it.kind] = true;
        if (explore.discover('life:' + it.kind)) {
          hud.toastKey('discover.life', { name: t('life.name.' + it.kind) });
        }
      }
    }
  },
  draw: (c) => {
    const vr = cam.visibleRect(160);
    for (const it of life) {
      if (it.x < vr.x0 || it.x > vr.x1 || it.y < vr.y0 || it.y > vr.y1) continue;
      it.draw(c);
    }
  },
});
scheduler.add({
  id: 'seaweed', space: 'world', order: 3,
  entities: seaweeds,
});
scheduler.add({
  id: 'plankton', space: 'world', order: 4,
  entities: plankton,
});
scheduler.add({
  id: 'fish', space: 'world', order: 5,
  update: () => {
    for (const sc of schools) {
      const b = feeding.nearest(sc.cx, sc.cy);
      sc.update(dtGlobal, tGlobal, b);
      if (b) {
        // 距离中心近则消耗
        const dx = b.x - sc.cx, dy = b.y - sc.cy;
        if (dx * dx + dy * dy < 90 * 90) feeding.consume(b, 0.0015);
      }
    }
  },
  draw: (c) => { for (const sc of schools) sc.draw(c); },
});
scheduler.add({
  id: 'turtle', space: 'world', order: 6,
  entities: turtles,
});
scheduler.add(createDepthHaze());
scheduler.add({
  id: 'jellyfish', space: 'world', order: 7,
  update: () => {
    // 阶段十：群系节奏（极地冰海更慢）
    const mech = world.mechanics;
    const dtScale = (dtGlobal / 16.667) * (mech.dtScale || 1);
    const adventure = mode.isAdventure();
    // 当前海域的氧况：越深缺氧越快（约：深渊 12s、微光 22s 耗尽；浅海约 9s 回满）
    const zid = zones.current;
    let oxRate = zid === 'abyss' ? -0.0014 : zid === 'midnight' ? -0.00075 : 0.0018; // <0 缺氧 / >0 复氧
    oxRate += (mech.oxBonus || 0);   // 群系修正（vent 更快见底 / mycelium 稍缓）

    for (const j of jellyfish) {
      j.update(dtGlobal, tGlobal);
      // 阶段五：洋流对水母施加力（浮力 / 惯性手感）
      const cur = current.sample(j.x, j.y, tGlobal);
      // 阶段八：海草带削弱局部洋流；阶段十：群系平静度
      const calm = Math.max(0, 1 - build.effectOf('calm', j.x, j.y) - (mech.calm || 0));
      j.vx += cur.vx * calm * 0.8 * dtScale;
      j.vy += cur.vy * calm * 0.8 * dtScale;
      // 靠近饵料时轻微聚集
      const b = feeding.nearest(j.x, j.y);
      if (b) {
        const dx = b.x - j.x, dy = b.y - j.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 300) {
          const f = (1 - d / 300) * 0.06 * dtScale;
          j.vx += (dx / d) * f;
          j.vy += (dy / d) * f;
        }
      }
      // 阶段八 8B（冒险）：靠近浮游时进食长大
      if (adventure && !j.egg && !j.dormant) {
        const pk = nearestPlankton(j.x, j.y);
        if (pk) {
          const d = Math.hypot(pk.x - j.x, pk.y - j.y);
          if (d < j.r * 2.4) j.feed(1);
        }
        // 缺氧/复氧（深海）
        j.oxygenate(oxRate, dtScale);
      }
    }
  },
  draw: (c) => {
    // 供 Jellyfish 做发光密度自适应
    Jellyfish.__count = jellyfish.length;
    for (const j of jellyfish) j.draw(c);
  },
});
scheduler.add({
  id: 'bait', space: 'world', order: 8,
  entities: baits,
});
scheduler.add({
  id: 'bubble', space: 'world', order: 9,
  entities: bubbles,
  reconcile: () => {
    if (bubbles.length < quality.bubbles && Math.random() < 0.05) {
      bubbles.push(new Bubble());
    }
  },
});
scheduler.add({
  id: 'ripple', space: 'world', order: 10,
  entities: ripples,
});
scheduler.add(createWaterSurface());
scheduler.add({
  id: 'activity', order: 90,
  update: () => activity.update(dtGlobal),
  draw: (c) => activity.draw(c),
});

// ---------- 阶段五：洋流 + 生态系统 ----------
scheduler.add({
  id: 'current', space: 'world', order: 6,
  update: () => current.update(dtGlobal),
  draw: (c) => current.draw(c),
});
scheduler.add({
  id: 'ecosystem', space: 'world', order: 12,
  update: () => ecosystem.update(dtGlobal, tGlobal),
  draw: (c) => ecosystem.draw(c),
});

// ---------- 阶段六：繁育检测 ----------
scheduler.add({
  id: 'breeding', space: 'world', order: 13,
  update: () => breeding.update(dtGlobal),
});

// ---------- 隐藏纪念内容：Bogyó（独立于水母系统） ----------
scheduler.add({
  id: 'bogyo', space: 'world', order: 14,
  update: () => { if (bogyo) bogyo.update(dtGlobal, tGlobal); },
  draw: (c) => { if (bogyo) bogyo.draw(c); },
});

// ---------- 阶段十：伴随水母（跟随光标） ----------
scheduler.add({
  id: 'companion', space: 'world', order: 15,
  update: () => {
    if (!companion) return;
    // 跟随光标 / 触摸点；无交互时缓慢漂向当前视口中心。
    // 阶段十一：companion 现在生活/world 坐标里，所以指针要先转过去。
    const tx = pointer.active && !camera.dragging ? cam.toWorldX(pointer.x) : cam.x + cam.vw * 0.5;
    const ty = pointer.active && !camera.dragging ? cam.toWorldY(pointer.y) : cam.y + cam.vh * 0.42;
    companion.update(dtGlobal, { x: tx, y: ty });
  },
  draw: (c) => { if (companion) companion.draw(c); },
});

// ---------- 阶段七：秘密 / 海域 / 目标 / 叙事 ----------
scheduler.add({
  id: 'secrets', space: 'world', order: 4,
  entities: secrets,
});
scheduler.add({
  id: 'zones', space: 'world', order: 100,
  update: () => {
    zones.update(dtGlobal);
    // 每帧评估解锁（轻量：仅比较阈值）
    const best = zones.evaluate();
    if (best !== zones.current) {
      zones.setZone(best);
      if (hud.refreshZone) hud.refreshZone(zones.label);
    }
  },
});
scheduler.add({
  id: 'holdring', order: 100,
  draw: (c) => {
    const p = interact.holdProgress();
    if (p > 0) {
      const pos = interact.holdPos;
      drawHoldRing(c, pos.x, pos.y, p);
    }
  },
});

// ---------- 水深带 HUD ----------
// 显示的是「相机中心所处的水深带」，也就是玩家眼下看到的这片水有多深。
// 只在文案真正变化时才碰 DOM，避免每 500ms 触发重排。
// （lastBandId / BAND_* 的声明在文件上方 —— setTerrain 也会用到它们。）
//
// 相机中心所在的水深带变化时刷新 HUD，并把它当成一次「发现」。
//
// 注意时序：这个函数由 500ms 的节流器驱动，不是每帧。相机快速拖动时
// 中间会跨过好几个带，我们只记录「停下来时所在的那个带」——这是有意的，
// 因为玩家真正「抵达」的是一个停留点，而不是一个过路点。
// 但**发现**必须逐个补记：否则从浅水直接冲到深海，中间三档就永久错过了。
// 这里用一趟补齐遍历，代价是几毫秒，换来的是「探索记录不会漏档」。
function refreshDepthBand() {
  const cxw = camera.x + cam.vw * 0.5;
  const cyw = camera.y + cam.vh * 0.5;
  const depth = terrain.depthAt(cxw, cyw);
  const b = bandOf(depth);
  if (!b) return;
  // lastBandId 可能是 null（换地形后被主动清空过），此时必须继续往下走：
  // 若直接返回，玩家换到另一个地形后 HUD 会一直停在旧标签上。
  if (b.id === lastBandId) return;

  const prevIdx = BAND_INDEX[lastBandId] != null ? BAND_INDEX[lastBandId] : -1;
  const nowIdx = BAND_INDEX[b.id] != null ? BAND_INDEX[b.id] : 0;
  lastBandId = b.id;
  hud.refreshZone(b.key);

  // 首次抵达某个水深带 -> 播报 + 记入探索
  if (explore.discover('band:' + b.id)) {
    hud.toastKey('discover.band', { name: t(b.key) });
  }
  // 跨档时把沿途跳过的带也一起记上（顺序：由浅到深或由深到浅）。
  // prevIdx === -1 表示「刚换过地形、没有已知起点」，此时只有目标带值得记，
  // 不做补记 —— 否则从 shore 换到 island 会瞬间把六个带全部判为已发现。
  if (prevIdx >= 0 && Math.abs(nowIdx - prevIdx) > 1) {
    const step = nowIdx > prevIdx ? 1 : -1;
    for (let i = prevIdx + step; i !== nowIdx; i += step) {
      const id = BAND_ORDER[i];
      if (id && explore.discover('band:' + id)) {
        hud.toastKey('discover.band', { name: t(bandOf(BAND_MID[id]).key) });
      }
    }
  }
}

// ---------- 相机位置落盘（节流） ----------
// 相机移动本身不改变游戏状态，所以历史上没有触发存档 —— 后果是「走了一段路、
// 刷新页面又回到出生点」，玩家会以为进度丢了。这里按位移阈值 + 时间节流补上：
//   · 位移 < 24 世界单位：不动。抖动级别的位置变化不值得写盘。
//   · 距上次写盘 < 1500ms：不动。避免拖动时每帧一次 localStorage 写入。
// 用「阈值 + 节流」而不是每帧 markDirty，是因为 markDirty 只置一个布尔位，
// 真正的写入由 3s 定时器做 —— 但若一直不置位，定时器就永远什么都不写。
let lastSavedCamX = null;
let lastSavedCamY = null;
let camSaveAt = 0;
function saveCameraIfMoved(t) {
  const dx = Math.abs(camera.x - lastSavedCamX);
  const dy = Math.abs(camera.y - lastSavedCamY);
  if (dx < 24 && dy < 24) return;
  if (t - camSaveAt < 1500) return;
  lastSavedCamX = camera.x;
  lastSavedCamY = camera.y;
  camSaveAt = t;
  save.markDirty();
}

// ---------- 计时 ----------
let lastT = 0;
let dtGlobal = 16.667;
let tGlobal = 0;
let fpsThrottle = 0;
let running = true;

// ---------- 主循环 ----------
function loop(t) {
  if (!running) return;
  if (!lastT) lastT = t;
  let dt = t - lastT;
  lastT = t;
  // 钳制：切后台回来避免跳帧
  if (dt > 33) dt = 33;
  if (dt < 0) dt = 0;
  dtGlobal = dt;
  tGlobal = t;

  // 相机先更新（缓动 + 键盘推进），随后所有世界层绘制都用世界坐标
  cam.update(dt);
  // 走远之后把新位置记进存档（内部有位移阈值 + 时间节流）
  saveCameraIfMoved(t);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  scheduler.tick(ctx, dt, t, camera);

  perfMon.sample(dt);

  // 音频昼夜调制 & HUD 节流刷新
  fpsThrottle += dt;
  if (fpsThrottle > 500) {
    fpsThrottle = 0;
    audio.modulate(dayNight.sun, mode.current);
    hud.refreshPhase();
    hud.setFps(perf.fps);
    refreshDepthBand();
  }

  requestAnimationFrame(loop);
}

// ---------- 页面可见性：切后台暂停，切回重置时间基准 ----------
// 否则昼夜相位会按真实流逝时间突跳（例如从天亮瞬间跳到天黑）
function bindVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      audio.suspend();
    } else {
      if (!running) {
        running = true;
        lastT = 0;        // 重置基准，下一帧 dt 归零，避免相位突跳
        fpsThrottle = 0;
        requestAnimationFrame(loop);
      }
      audio.resume();
    }
  });
}

// ---------- 启动 ----------
function start() {
  // 必须先确定画布尺寸，否则 view.W/H 为 0，所有实体都会堆在原点
  createResize(canvas, ctx, () => {
    softRebuild();
  });
  // 相机缩放依赖 view 尺寸，必须在 createResize 之后初始化
  cam.resize();
  terrainRebuildHooks.push(() => cam.resize());

  initI18n();
  applyI18n();
  bindVisibility();
  hud.bind();
  hud.bindAch(() => {
    // 点击星标显示成就列表（用 toast 依次提示已解锁项）
    const list = achievements.list.filter((a) => achievements.has(a.id));
    if (!list.length) {
      hud.toast('ach.none');
      return;
    }
    hud.toastKey('ach.summary', {
      n: achievements.count,
      total: achievements.total,
      names: list.map((a) => t(a.label)).join(' · '),
    });
  });
  dex.bind();
  settings.bind();
  settings.init();
  hud.refreshDex();
  hud.refreshPhase();
  hud.refreshTheme();
  hud.refreshAch(achievements.count);
  hud.refreshButtons();
  if (hud.refreshBio) hud.refreshBio(economy.bio);
  lab.bind();
  atlas.bind();
  memoryPad.bind();
  buildPad.bind();
  createPanel.bind();
  if (hud.refreshZone) hud.refreshZone(zones.label);
  setupZoneContent(zones.current);
  if (hud.refreshActivity) hud.refreshActivity(false);

  // 恢复存档后立即评估一次（例如 déjà 满足的成就）
  achievements.check(stats, { type: 'init' });

  // 优先恢复上次的池塘；无存档则生成新世界
  restorePond();
  // 注意：预置水母不自动收录 —— 玩家需主动点击接触才能发现物种

  // 隐藏纪念内容：已解锁则让他常驻海洋
  // （必须在 restorePond 之后：clearWorld 会清空数组）
  if (memory.unlocked) spawnBogyo(false);

  // 阶段十：若无存档，先给一个默认伴随水母（进入新建世界后可换）
  if (!companion) spawnCompanion(companionVariantId);

  save.start();

  // 标题屏：MC 式菜单（继续 / 新建世界 / 设置 / 语言）
  home.bind();
  home.onLang(() => {
    toggleLang();
    hud.refreshLang();
    hud.refreshButtons();
    home.refreshLang();
    if (settings.isOpen) settings.render();
  });
  home.show();

  // 首次进入（点"继续"）后的引导 / 提示
  home.onEnter(() => {
    coach.start();
    maybeAnnounceRare();
  });

  requestAnimationFrame((t) => {
    if (loaderEl) {
      loaderEl.classList.add('hide');
      setTimeout(() => { if (loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl); }, 900);
    }
    lastT = t;
    loop(t);
  });
}

start();
