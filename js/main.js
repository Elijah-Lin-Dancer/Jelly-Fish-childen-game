// ============================================================
//  入口：装配所有模块并启动主循环
// ============================================================

import { DPR, rand, isMobile } from './core/config.js';
import { view, pointer, theme, dayNight, app, perf, setTier, quality } from './core/state.js';
import { createScheduler } from './core/loop.js';
import { createResize } from './core/resize.js';
import { createAudio } from './core/audio.js';
import { createPerf } from './ui/perf.js';
import { initI18n, t, toggleLang, applyI18n } from './ui/i18n.js';
import { createHud } from './ui/hud.js';
import { createHome } from './ui/home.js';
import { createDex } from './ui/dex.js';
import { createInteract, drawHoldRing } from './ui/interact.js';
import { createBackground, createLightRays, createWaterSurface, createDepthHaze } from './systems/scenery.js';
import { createDayNight } from './systems/dayNight.js';
import { createFeeding } from './systems/feeding.js';
import { createCollection } from './gameplay/collection.js';
import { createSave } from './gameplay/save.js';
import { Jellyfish, JELLY_PALETTES } from './entities/jellyfish.js';
import { FishSchool } from './entities/fish.js';
import { Turtle } from './entities/turtle.js';
import { Whale } from './entities/whale.js';
import { Plankton, Bubble, Seaweed, Ripple, Bait } from './entities/env.js';

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

// ---------- 子系统 ----------
const audio = createAudio();
const perfMon = createPerf();
const collision = { spawned: 0 };

const collection = createCollection(
  (idx) => {
    hud.toast('dex.new');
    hud.refreshDex();
    // 新物种闪光
    for (const j of jellyfish) {
      if (j.paletteIndex === idx) j.flash = 1;
    }
  },
  () => {
    hud.toast('dex.complete');
    hud.refreshDex();
    spawnEggJelly();
  }
);

// 池塘存档：把当前水母落盘，重开即"你的池塘"
const save = createSave(() => jellyfish);

function spawnEggJelly() {
  const j = new Jellyfish(view.W / 2, view.H / 2, 0, {});
  j.r = 64; j.baseR = 64; j.scale = 1;
  j._buildTentacles();
  j.egg = true;
  jellyfish.push(j);
  for (let i = 0; i < 40; i++) {
    bubbles.push(new Bubble(view.W / 2 + rand(-60, 60), view.H / 2 + rand(-40, 40), true));
  }
  ripples.push(new Ripple(view.W / 2, view.H / 2));
}

const feeding = createFeeding(baits, (x, y) => {
  audio.bubble();
});

// ---------- 首页（欢迎 + 池塘命名） ----------
const home = createHome({
  onStart: () => {
    // 首次进入：借用户手势解锁音频（浏览器自动播放策略）
    audio.unlock();
  },
  onToast: (key) => hud.toast(key),
  onReset: () => {
    if (!window.confirm(t('pond.reset.confirm'))) return false;
    save.reset();
    collection.reset();
    clearWorld();
    seedWorld(null);
    save.markDirty();
    save.write();
    hud.refreshDex();
    dex.render();
    return true;
  },
});

// ---------- 图鉴面板 ----------
const dex = createDex();

// ---------- HUD ----------
const hud = createHud({
  toggleSound: () => {
    const on = audio.toggle();
    const btn = document.getElementById('sound-btn');
    if (btn) {
      btn.textContent = on ? '🔊' : '🔇';
      btn.classList.toggle('muted', !on);
    }
  },
  toggleLang: () => {
    toggleLang();
    hud.refreshLang();
    hud.refreshButtons();
    home.refreshLang();
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
});

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
}

function seedWorld(keepJelly) {
  clearWorld();
  save.markDirty();

  const jn = keepJelly && keepJelly.length ? 0 : quality.jellyfish;
  for (let i = 0; i < jn; i++) {
    jellyfish.push(new Jellyfish());
  }
  if (keepJelly) {
    for (const j of keepJelly) jellyfish.push(j);
  }

  for (let i = 0; i < quality.fishSchools; i++) {
    schools.push(new FishSchool(rand(view.W * 0.2, view.W * 0.8), rand(view.H * 0.25, view.H * 0.7), quality.fishPerSchool));
  }
  const tc = isMobile ? 1 : 2;
  for (let i = 0; i < tc; i++) turtles.push(new Turtle());

  for (let i = 0; i < quality.plankton; i++) plankton.push(new Plankton());
  for (let i = 0; i < quality.seaweed; i++) {
    seaweeds.push(new Seaweed((view.W / (quality.seaweed + 1)) * (i + 1) + rand(-30, 30)));
  }
  for (let i = 0; i < quality.bubbles; i++) {
    bubbles.push(new Bubble(rand(0, view.W), rand(0, view.H)));
  }
}

/** 软重建：保留全部现有水母，只重置环境 */
function softRebuild() {
  const kept = jellyfish.slice(0, quality.jellyfish * 1.5);
  const extra = jellyfish.slice(quality.jellyfish * 1.5);
  // 超出的水母重新撒到可见区域内（保留，不再丢弃）
  for (const j of extra) {
    j.x = rand(0, view.W);
    j.y = rand(0, view.H);
  }
  seedWorld(kept.concat(extra));
  save.markDirty();
}

/** 恢复上次的池塘；若无可恢复数据则生成全新世界 */
function restorePond() {
  const params = save.restoreParams();
  if (!params || !params.length) {
    seedWorld(null);
    return;
  }
  clearWorld();
  for (const p of params) {
    const j = new Jellyfish(p.x, p.y, p.paletteIndex, { restore: p });
    jellyfish.push(j);
  }
  // 环境照常生成（鱼群 / 海龟 / 浮游 / 气泡）
  for (let i = 0; i < quality.fishSchools; i++) {
    schools.push(new FishSchool(rand(view.W * 0.2, view.W * 0.8), rand(view.H * 0.25, view.H * 0.7), quality.fishPerSchool));
  }
  const tc = isMobile ? 1 : 2;
  for (let i = 0; i < tc; i++) turtles.push(new Turtle());
  for (let i = 0; i < quality.plankton; i++) plankton.push(new Plankton());
  for (let i = 0; i < quality.seaweed; i++) {
    seaweeds.push(new Seaweed((view.W / (quality.seaweed + 1)) * (i + 1) + rand(-30, 30)));
  }
  for (let i = 0; i < quality.bubbles; i++) {
    bubbles.push(new Bubble(rand(0, view.W), rand(0, view.H)));
  }
}

// ---------- 生成 / 爆裂 ----------
function spawnJellyfish(x, y, juvenile) {
  const cap = quality.jellyfish * 2.5;
  if (jellyfish.length > cap) jellyfish.shift();
  const j = new Jellyfish(x, y, undefined, { juvenile });
  jellyfish.push(j);
  audio.bubble();
  save.markDirty();
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
  audio.bubble();
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

function unlockJelly(j) {
  if (!j || j.egg) return;
  const idx = j.paletteIndex;
  if (!collection.has(idx)) {
    // 首次接触即收录
    collection.unlock(idx);
    dex.render();
  }
}

// ---------- 交互 ----------
let lastPointerTrail = 0;

const interact = createInteract(canvas, {
  onMoveStart: () => {
    audio.unlock();
  },
  onTap: (x, y) => {
    if (feeding.mode) {
      feeding.drop(x, y);
      save.markDirty();
      return;
    }
    const j = hitJellyfish(x, y);
    if (j) {
      unlockJelly(j);
      const before = j.paletteIndex;
      const mutated = j.interact();
      if (mutated) {
        // 变异事件：醒目提示前后配色名
        hud.toastKey('jelly.mutated', {
          from: t('jelly.' + JELLY_PALETTES[before].key),
          to: t('jelly.' + j.palette.key),
        });
        collection.recordMutation(j.paletteIndex, before);
        dex.render();
      } else if (!j.egg) {
        collection.see(j.paletteIndex);
      }
      save.markDirty();
    }
    createBurst(x, y);
  },
  onHold: (x, y) => {
    spawnJellyfish(x, y, true);
  },
});

// 音频解锁：挂 window，任意首次交互都生效
const unlockOnce = () => { audio.unlock(); };
window.addEventListener('pointerdown', unlockOnce, { once: true, capture: true });
window.addEventListener('touchstart', unlockOnce, { once: true, capture: true, passive: true });

// ---------- 调度器 ----------
const scheduler = createScheduler();

scheduler.add(createDayNight());
scheduler.add(createBackground());
scheduler.add({
  id: 'whale', order: 1,
  update: (dt, t) => whale.update(dt),
  draw: (c) => whale.draw(c),
});
scheduler.add(createLightRays());
scheduler.add({
  id: 'seaweed', order: 3,
  entities: seaweeds,
});
scheduler.add({
  id: 'plankton', order: 4,
  entities: plankton,
});
scheduler.add({
  id: 'fish', order: 5,
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
  id: 'turtle', order: 6,
  entities: turtles,
});
scheduler.add(createDepthHaze());
scheduler.add({
  id: 'jellyfish', order: 7,
  update: () => {
    for (const j of jellyfish) {
      j.update(dtGlobal, tGlobal);
      // 靠近饵料时轻微聚集
      const b = feeding.nearest(j.x, j.y);
      if (b) {
        const dx = b.x - j.x, dy = b.y - j.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 300) {
          const f = (1 - d / 300) * 0.06 * (dtGlobal / 16.667);
          j.vx += (dx / d) * f;
          j.vy += (dy / d) * f;
        }
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
  id: 'bait', order: 8,
  entities: baits,
});
scheduler.add({
  id: 'bubble', order: 9,
  entities: bubbles,
  reconcile: () => {
    if (bubbles.length < quality.bubbles && Math.random() < 0.05) {
      bubbles.push(new Bubble());
    }
  },
});
scheduler.add({
  id: 'ripple', order: 10,
  entities: ripples,
});
scheduler.add(createWaterSurface());
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

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  scheduler.tick(ctx, dt, t);

  perfMon.sample(dt);

  // 音频昼夜调制 & HUD 节流刷新
  fpsThrottle += dt;
  if (fpsThrottle > 500) {
    fpsThrottle = 0;
    audio.modulate(dayNight.sun);
    hud.refreshPhase();
    hud.setFps(perf.fps);
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

  initI18n();
  applyI18n();
  bindVisibility();
  hud.bind();
  dex.bind();
  hud.refreshDex();
  hud.refreshPhase();
  hud.refreshTheme();
  hud.refreshButtons();

  // 优先恢复上次的池塘；无存档则生成新世界
  restorePond();
  // 注意：预置水母不自动收录 —— 玩家需主动点击接触才能发现物种

  save.start();

  // 首页：欢迎页 + 池塘命名
  home.bind();
  home.show();

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
