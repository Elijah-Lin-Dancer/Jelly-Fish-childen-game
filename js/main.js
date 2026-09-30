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
import { createShare } from './ui/share.js';
import { createSettings } from './ui/settings.js';
import { createCoach } from './ui/coach.js';
import { createInteract, drawHoldRing } from './ui/interact.js';
import { createBackground, createLightRays, createWaterSurface, createDepthHaze, setZoneProvider } from './systems/scenery.js';
import { createDayNight } from './systems/dayNight.js';
import { createFeeding } from './systems/feeding.js';
import { createActivity } from './systems/activity.js';
import { createCurrent } from './systems/current.js';
import { createEcosystem } from './systems/ecosystem.js';
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
import { Bogyo } from './entities/bogyo.js';
import { dailyRareIndex } from './gameplay/daily.js';
import { Jellyfish, JELLY_PALETTES } from './entities/jellyfish.js';
import { FishSchool } from './entities/fish.js';
import { Turtle } from './entities/turtle.js';
import { Whale } from './entities/whale.js';
import { Plankton, Bubble, Seaweed, Ripple, Bait, Celebrate } from './entities/env.js';

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
const save = createSave(() => jellyfish);

// 成就系统：解锁时弹 toast + 更新 HUD 星标
const achievements = createAchievements((a) => {
  hud.toastKey('ach.unlocked', { name: t(a.label) });
  hud.refreshAch(achievements.count);
});

// ---------- 阶段六：生物荧光经济 + 专长 + 繁育 ----------
const economy = createEconomy({
  getMultiplier: () => specialize.multiplier(),
  onGain: () => { if (hud.refreshBio) hud.refreshBio(economy.bio); },
});
const specialize = createSpecialize(economy, (id, lv) => {
  hud.toastKey('lab.specUp', { name: t('spec.' + id), lv });
  if (hud.refreshBio) hud.refreshBio(economy.bio);
  if (lab.isOpen) lab.render();
});

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
  stats.fed++;
  economy.gain(2);   // 投喂产出生物荧光
  achievements.check(stats, { type: 'feed' });
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
    achievements.reset();
    economy.reset();
    specialize.reset();
    explore.reset();
    quests.reset();
    zones.setZone('shallow', true);
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
    ripples.push(new Celebrate(view.W / 2, view.H / 2, '160, 255, 200', 320));
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
  openSettings: () => settings.toggle(),
});

// ---------- 生态系统 / 温和大鱼（阶段五 · 4.2） ----------
const ecosystem = createEcosystem({
  plankton, schools, jellyfish, current,
  onEvent: (k) => hud.toast(k),
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

// ---------- 隐藏纪念内容（Bogyó） ----------
// 他不是水母：独立实体 + 独立调度条目，不进入 jellyfish 数组，
// 因而不参与洋流 / 繁育 / 图鉴 / 存档。
let bogyo = null;

/** 把 Bogyó 放进海洋（已存在则不重复添加） */
function spawnBogyo(announce = true) {
  if (bogyo) return bogyo;
  const c = memory.content;
  bogyo = new Bogyo(rand(view.W * 0.25, view.W * 0.75), rand(view.H * 0.3, view.H * 0.6), {
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
    ensureDailyRare();
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
  ensureDailyRare();
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
  const j = new Jellyfish(x, y, undefined, { juvenile });
  jellyfish.push(j);
  audio.bubble();
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
    // Bogyó 优先级最高：他是一只小猫，点他应该有回应
    if (hitBogyo(x, y)) {
      bogyo.tap();
      hud.toastText(bogyo.name);
      audio.bubble();
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
      audio.bubble();
      save.markDirty();
      return;
    }
    if (j) {
      if (j.isMemory) {
        // 隐藏纪念水母：回应触摸，但不变异、不收录
        j.flash = 1;
        ripples.push(new Ripple(j.x, j.y));
        audio.bubble();
        createBurst(x, y);
        return;
      }
      unlockJelly(j);
      const before = j.paletteIndex;
      const mutated = j.interact();
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
  onHold: (x, y) => {
    // 长按 Bogyó：他会撒娇蹭一蹭（不召唤新水母）
    if (hitBogyo(x, y)) {
      bogyo.nuzzleMe();
      audio.bubble();
      ripples.push(new Ripple(bogyo.x, bogyo.y));
      return;
    }
    spawnJellyfish(x, y, true);
  },
  onDrag: (x, y, dx, dy) => {
    if (current.mode) current.push(x, y, dx, dy);
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
      // 阶段五：洋流对水母施加力（浮力 / 惯性手感）
      const cur = current.sample(j.x, j.y, tGlobal);
      j.vx += cur.vx * 0.8 * (dtGlobal / 16.667);
      j.vy += cur.vy * 0.8 * (dtGlobal / 16.667);
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
  id: 'activity', order: 90,
  update: () => activity.update(dtGlobal),
  draw: (c) => activity.draw(c),
});

// ---------- 阶段五：洋流 + 生态系统 ----------
scheduler.add({
  id: 'current', order: 6,
  update: () => current.update(dtGlobal),
  draw: (c) => current.draw(c),
});
scheduler.add({
  id: 'ecosystem', order: 12,
  update: () => ecosystem.update(dtGlobal, tGlobal),
  draw: (c) => ecosystem.draw(c),
});

// ---------- 阶段六：繁育检测 ----------
scheduler.add({
  id: 'breeding', order: 13,
  update: () => breeding.update(dtGlobal),
});

// ---------- 隐藏纪念内容：Bogyó（独立于水母系统） ----------
scheduler.add({
  id: 'bogyo', order: 14,
  update: () => { if (bogyo) bogyo.update(dtGlobal, tGlobal); },
  draw: (c) => { if (bogyo) bogyo.draw(c); },
});

// ---------- 阶段七：秘密 / 海域 / 目标 / 叙事 ----------
scheduler.add({
  id: 'secrets', order: 4,
  entities: secrets,
});
scheduler.add({
  id: 'zones', order: 100,
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

  save.start();

  // 首页：欢迎页 + 池塘命名
  home.bind();
  home.show();

  // 首次进入引导（只显示一次），在进入池塘后弹出
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
