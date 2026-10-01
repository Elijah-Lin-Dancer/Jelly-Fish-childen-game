// ============================================================
//  阶段十一 B：人类与生活元素
//  - 游泳者 / 戏水小孩 / 救生圈 / 小船 / 栈桥 / 灯塔 / 遮阳伞 /
//    棕榈 / 海鸥 / 贝壳
//  - 全部「清淡剪影感」纯程序化 Canvas 绘制，不抢水母的戏
//  - 全部可点击轻互动（挥手 / 蹦跳 / 鸣笛 / 惊飞 / 拾起…）
//
//  设计约定：
//   1. 元素只按「世界坐标」生成，绘制前由调度器统一 translate 到屏幕。
//   2. 布点必须确定性 —— 同一个 (terrain, seed) 每次进游戏布点完全一致，
//      否则「回到上次的位置」会看到一群人瞬移。
//   3. 每个元素自带 ttl / 冷却，互动是「一次性小动画」，不改变世界状态。
//   4. 元素不进对象池也不删除：世界是固定存在的，你只是走过去。
// ============================================================

import { TAU, rand, clamp } from '../core/config.js';
import { WORLD } from '../systems/terrain.js';
import { makeRng, rangeFrom } from '../core/seed.js';

// ---------- 通用：一次性互动动画的计时器 ----------
// 点一下播一段，播完自己归零。所有元素共用，逻辑只有一处。
function makeReaction(dur) {
  return { t: 0, dur, on: false };
}
function fire(r) {
  r.on = true;
  r.t = 0;
}
function stepReaction(r, dt) {
  if (!r.on) return 0;
  r.t += dt;
  if (r.t >= r.dur) {
    r.on = false;
    r.t = 0;
    return 0;
  }
  return r.t / r.dur; // 0..1 进度
}

// ============================================================
//  游泳者：浅滩里一个划水的人，点一下会挥手
// ============================================================
export class Swimmer {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':sw' + x.toFixed(0) + ',' + y.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.hue = rangeFrom(r, 0, 360);
    this.scale = rangeFrom(r, 0.9, 1.15);
    this.drift = rangeFrom(r, -0.16, 0.16);   // 缓慢横向漂
    this.phase = rangeFrom(r, 0, TAU);
    this.react = makeReaction(1400);
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.05 * k;
    this.x += this.drift * k;
    // 漂出世界就折回，避免边界外堆积
    if (this.x < WORLD.x0) this.x = WORLD.x0 + 4;
    if (this.x > WORLD.x1) this.x = WORLD.x1 - 4;
    stepReaction(this.react, dt);
    return true;
  }

  draw(ctx) {
    const s = 15 * this.scale;
    const bob = Math.sin(this.phase) * 2.2;
    // 挥手：把手臂快速上下摆 3 次
    const wave = this.react.on ? Math.sin(this.react.t * 0.028) : 0;

    ctx.save();
    ctx.translate(this.x, this.y + bob);

    // 水下身体（半透明，制造"浸在水里"的感觉）
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = 'hsl(' + this.hue + ', 55%, 62%)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.55, s * 0.42, s * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 头
    ctx.fillStyle = 'rgba(244, 214, 186, 0.96)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.34, 0, TAU);
    ctx.fill();
    // 泳帽
    ctx.fillStyle = 'hsl(' + this.hue + ', 62%, 58%)';
    ctx.beginPath();
    ctx.arc(0, -s * 0.05, s * 0.34, Math.PI, TAU);
    ctx.fill();

    // 划水的手臂
    ctx.strokeStyle = 'rgba(244, 214, 186, 0.9)';
    ctx.lineWidth = Math.max(1.6, s * 0.16);
    ctx.lineCap = 'round';
    if (this.react.on) {
      // 挥手：一只手举高左右摆
      ctx.beginPath();
      ctx.moveTo(s * 0.22, -s * 0.1);
      ctx.lineTo(s * 0.5 + wave * s * 0.34, -s * 0.75);
      ctx.stroke();
    } else {
      // 常态划水：双手交替划水
      const a = Math.sin(this.phase * 1.3) * s * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.12);
      ctx.lineTo(-s * 0.56, a);
      ctx.moveTo(0, s * 0.12);
      ctx.lineTo(s * 0.56, -a);
      ctx.stroke();
    }
    ctx.restore();
  }

  hitTest(wx, wy) {
    const s = 15 * this.scale;
    const dx = wx - this.x, dy = wy - (this.y + 2);
    return dx * dx + dy * dy < (s * 1.5) * (s * 1.5);
  }

  onTap() {
    fire(this.react);
    return { sfx: 'nuzzle', ripple: { x: this.x, y: this.y, r: 46 }, toast: null };
  }
}

// ============================================================
//  戏水小孩：比游泳者小，点一下会蹦跳 + 溅水
// ============================================================
export class PlayingChild {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':ch' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.hue = rangeFrom(r, 0, 360);
    this.scale = rangeFrom(r, 0.68, 0.86);
    this.phase = rangeFrom(r, 0, TAU);
    this.react = makeReaction(1200);
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.09 * k;
    stepReaction(this.react, dt);
    return true;
  }

  draw(ctx) {
    const s = 15 * this.scale;
    // 常态是轻轻上下浮；点了之后变成连续蹦跳
    const hop = this.react.on
      ? Math.abs(Math.sin(this.react.t * 0.02)) * 13
      : Math.abs(Math.sin(this.phase)) * 2.4;
    const splash = this.react.on ? Math.max(0, 1 - this.react.t / 1200) : 0;

    ctx.save();
    ctx.translate(this.x, this.y - hop);

    if (splash > 0.05) {
      ctx.strokeStyle = 'rgba(220, 245, 255, ' + (0.55 * splash).toFixed(3) + ')';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.85 + (i / 4) * Math.PI * 0.7;
        const rr = s * (0.8 + splash * 1.5);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4 + s * 0.4);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + s * 0.4);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = 'hsl(' + this.hue + ', 70%, 66%)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.5, s * 0.38, s * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(248, 220, 192, 0.97)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.36, 0, TAU);
    ctx.fill();
    // 两只小辫子
    ctx.fillStyle = 'hsl(' + ((this.hue + 40) % 360) + ', 60%, 52%)';
    ctx.beginPath();
    ctx.arc(-s * 0.34, -s * 0.12, s * 0.16, 0, TAU);
    ctx.arc(s * 0.34, -s * 0.12, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  hitTest(wx, wy) {
    const s = 15 * this.scale;
    const dx = wx - this.x, dy = wy - this.y;
    return dx * dx + dy * dy < (s * 1.6) * (s * 1.6);
  }

  onTap() {
    fire(this.react);
    return { sfx: 'splash', ripple: { x: this.x, y: this.y, r: 34 }, toast: null };
  }
}

// ============================================================
//  救生圈：漂浮的红白圈，点一下晃荡
// ============================================================
export class Lifebuoy {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':lb' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.scale = rangeFrom(r, 0.85, 1.15);
    this.phase = rangeFrom(r, 0, TAU);
    this.drift = rangeFrom(r, -0.1, 0.1);
    this.react = makeReaction(1000);
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.035 * k;
    this.x += this.drift * k;
    stepReaction(this.react, dt);
    return true;
  }

  draw(ctx) {
    const R = 13 * this.scale;
    const tilt = Math.sin(this.phase) * 0.16 + (this.react.on ? Math.sin(this.react.t * 0.03) * 0.4 : 0);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(tilt);

    ctx.lineWidth = R * 0.42;
    // 红白四段
    const cols = ['rgba(232, 90, 78, 0.95)', 'rgba(246, 246, 242, 0.95)'];
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = cols[i % 2];
      ctx.beginPath();
      ctx.arc(0, 0, R, (i / 4) * TAU - Math.PI / 2, ((i + 1) / 4) * TAU - Math.PI / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  hitTest(wx, wy) {
    const R = 13 * this.scale;
    const dx = wx - this.x, dy = wy - this.y;
    return dx * dx + dy * dy < (R * 1.7) * (R * 1.7);
  }

  onTap() {
    fire(this.react);
    return { sfx: 'tap', ripple: { x: this.x, y: this.y, r: 40 }, toast: null };
  }
}

// ============================================================
//  小船 / 帆船：水面上，点一下鸣笛（气泡 + 音效）
// ============================================================
export class Boat {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':bt' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.scale = rangeFrom(r, 0.95, 1.3);
    this.sailHue = rangeFrom(r, 0, 360);
    this.drift = rangeFrom(r, -0.2, 0.2) || 0.1;
    this.phase = rangeFrom(r, 0, TAU);
    this.react = makeReaction(1500);
    this.dir = this.drift >= 0 ? 1 : -1;
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.03 * k;
    this.x += this.drift * k;
    if (this.x < WORLD.x0 - 60) { this.x = WORLD.x1 + 60; }
    if (this.x > WORLD.x1 + 60) { this.x = WORLD.x0 - 60; }
    stepReaction(this.react, dt);
    return true;
  }

  draw(ctx) {
    const s = 16 * this.scale;
    const bob = Math.sin(this.phase) * 2.6;
    const tilt = Math.sin(this.phase * 0.8) * 0.045 + (this.react.on ? Math.sin(this.react.t * 0.02) * 0.05 : 0);

    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(tilt);
    ctx.scale(this.dir, 1);

    // 鸣笛：从船顶升起的三个圆环
    if (this.react.on) {
      const t = this.react.t / 1500;
      for (let i = 0; i < 3; i++) {
        const tt = clamp(t * 1.4 - i * 0.22, 0, 1);
        if (tt <= 0 || tt >= 1) continue;
        ctx.strokeStyle = 'rgba(230, 248, 255, ' + (0.5 * (1 - tt)).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -s * 1.5, s * (0.4 + tt * 1.3), 0, TAU);
        ctx.stroke();
      }
    }

    // 船体
    ctx.fillStyle = 'rgba(122, 86, 62, 0.94)';
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.12);
    ctx.lineTo(s, -s * 0.12);
    ctx.lineTo(s * 0.66, s * 0.5);
    ctx.lineTo(-s * 0.66, s * 0.5);
    ctx.closePath();
    ctx.fill();

    // 桅杆
    ctx.strokeStyle = 'rgba(95, 70, 52, 0.9)';
    ctx.lineWidth = Math.max(1.4, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.12);
    ctx.lineTo(0, -s * 1.5);
    ctx.stroke();

    // 帆（受风鼓起，随时间轻微变形）
    const bulge = Math.sin(this.phase * 1.4) * s * 0.1;
    ctx.fillStyle = 'hsla(' + this.sailHue + ', 48%, 88%, 0.92)';
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.72 + bulge, -s * 0.8, 0, -s * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  hitTest(wx, wy) {
    const s = 16 * this.scale;
    const dx = wx - this.x, dy = wy - this.y;
    return dx * dx + dy * dy < (s * 1.4) * (s * 1.4);
  }

  onTap() {
    fire(this.react);
    return { sfx: 'horn', ripple: { x: this.x, y: this.y, r: 56 }, toast: null };
  }
}

// ============================================================
//  灯塔：岸上的结构，点一下闪一次光束
// ============================================================
export class Lighthouse {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':lh' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.scale = rangeFrom(r, 1.05, 1.3);
    this.phase = rangeFrom(r, 0, TAU);
    this.react = makeReaction(1800);
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.02 * k;
    stepReaction(this.react, dt);
    return true;
  }

  draw(ctx) {
    const s = 30 * this.scale;
    ctx.save();
    ctx.translate(this.x, this.y);

    // 塔身（下宽上窄）
    ctx.fillStyle = 'rgba(238, 238, 232, 0.95)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, 0);
    ctx.lineTo(-s * 0.2, -s * 1.5);
    ctx.lineTo(s * 0.2, -s * 1.5);
    ctx.lineTo(s * 0.32, 0);
    ctx.closePath();
    ctx.fill();

    // 红色环带
    ctx.fillStyle = 'rgba(214, 76, 66, 0.95)';
    for (let i = 0; i < 2; i++) {
      const yy = -s * (0.45 + i * 0.62);
      ctx.fillRect(-s * 0.28 + i * s * 0.03, yy, s * 0.56 - i * s * 0.06, s * 0.19);
    }

    // 灯室
    ctx.fillStyle = 'rgba(60, 74, 86, 0.95)';
    ctx.fillRect(-s * 0.18, -s * 1.72, s * 0.36, s * 0.24);
    ctx.fillStyle = 'rgba(255, 240, 190, 0.98)';
    ctx.fillRect(-s * 0.12, -s * 1.68, s * 0.24, s * 0.16);

    // 顶部
    ctx.fillStyle = 'rgba(60, 74, 86, 0.95)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 1.72);
    ctx.lineTo(0, -s * 1.98);
    ctx.lineTo(s * 0.22, -s * 1.72);
    ctx.closePath();
    ctx.fill();

    // 光束：常态是缓慢旋转的暗光，点击后爆闪一次并扫过
    const baseRot = this.phase * 0.5;
    const flash = this.react.on ? Math.max(0, 1 - this.react.t / 900) : 0.14;
    const rot = this.react.on ? baseRot + (this.react.t / 1800) * TAU : baseRot;
    ctx.save();
    ctx.translate(0, -s * 1.6);
    ctx.rotate(rot);
    const grad = ctx.createLinearGradient(0, 0, s * 5.5, 0);
    grad.addColorStop(0, 'rgba(255, 244, 200, ' + (0.42 * flash).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(255, 244, 200, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.06);
    ctx.lineTo(s * 5.5, -s * 0.62);
    ctx.lineTo(s * 5.5, s * 0.62);
    ctx.lineTo(0, s * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  hitTest(wx, wy) {
    const s = 30 * this.scale;
    const dx = wx - this.x, dy = wy - (this.y - s * 0.9);
    return dx * dx + dy * dy < (s * 0.85) * (s * 0.85);
  }

  onTap() {
    fire(this.react);
    return { sfx: 'unlock', ripple: null, toast: null };
  }
}

// ============================================================
//  遮阳伞：沙滩上，点一下轻轻摆动
// ============================================================
export class BeachUmbrella {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':um' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.hue = rangeFrom(r, 0, 360);
    this.scale = rangeFrom(r, 0.95, 1.25);
    this.phase = rangeFrom(r, 0, TAU);
    this.react = makeReaction(1100);
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.026 * k;
    stepReaction(this.react, dt);
    return true;
  }

  draw(ctx) {
    const s = 22 * this.scale;
    const sway = Math.sin(this.phase) * 0.045 + (this.react.on ? Math.sin(this.react.t * 0.03) * 0.16 : 0);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(sway);

    // 伞杆
    ctx.strokeStyle = 'rgba(120, 98, 78, 0.9)';
    ctx.lineWidth = Math.max(1.4, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s * 1.15);
    ctx.stroke();

    // 伞面：四片扇形交替深浅
    const R = s * 0.95;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0
        ? 'hsl(' + this.hue + ', 68%, 70%)'
        : 'hsl(' + this.hue + ', 68%, 88%)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.1);
      ctx.arc(0, -s * 1.1, R, Math.PI + (i / 6) * Math.PI, Math.PI + ((i + 1) / 6) * Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  hitTest(wx, wy) {
    const s = 22 * this.scale;
    const dx = wx - this.x, dy = wy - (this.y - s * 0.9);
    return dx * dx + dy * dy < (s * 1.0) * (s * 1.0);
  }

  onTap() {
    fire(this.react);
    return { sfx: 'tap', ripple: null, toast: null };
  }
}

// ============================================================
//  棕榈：岸边高一点的树，点一下叶子摆动
// ============================================================
export class Palm {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':pm' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.scale = rangeFrom(r, 1.0, 1.45);
    this.lean = rangeFrom(r, -0.14, 0.14);
    this.phase = rangeFrom(r, 0, TAU);
    this.fronds = Math.round(rangeFrom(r, 6, 8));
    this.react = makeReaction(1500);
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.022 * k;
    stepReaction(this.react, dt);
    return true;
  }

  draw(ctx) {
    const s = 34 * this.scale;
    const sway = Math.sin(this.phase) * 0.05 + (this.react.on ? Math.sin(this.react.t * 0.024) * 0.18 : 0);
    ctx.save();
    ctx.translate(this.x, this.y);

    // 树干：轻微弯曲
    ctx.strokeStyle = 'rgba(126, 100, 74, 0.95)';
    ctx.lineWidth = Math.max(2.4, s * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(this.lean * s * 0.6, -s * 0.7, this.lean * s * 1.2, -s * 1.3);
    ctx.stroke();

    // 树冠
    ctx.save();
    ctx.translate(this.lean * s * 1.2, -s * 1.3);
    ctx.rotate(sway);
    ctx.strokeStyle = 'rgba(84, 140, 92, 0.92)';
    ctx.lineWidth = Math.max(2.2, s * 0.12);
    for (let i = 0; i < this.fronds; i++) {
      const a = -Math.PI + (i / (this.fronds - 1)) * Math.PI;
      const droop = Math.abs(Math.cos(a)) * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.42 - s * 0.14,
                           Math.cos(a) * s * 1.05, Math.sin(a) * s * 0.42 + s * droop * 0.5);
      ctx.stroke();
    }
    // 椰子
    ctx.fillStyle = 'rgba(110, 84, 60, 0.95)';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc((i - 0.5) * s * 0.18, s * 0.08, s * 0.1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  hitTest(wx, wy) {
    const s = 34 * this.scale;
    const dx = wx - (this.x + this.lean * s * 1.2), dy = wy - (this.y - s * 1.3);
    return dx * dx + dy * dy < (s * 0.8) * (s * 0.8);
  }

  onTap() {
    fire(this.react);
    return { sfx: 'tap', ripple: null, toast: null };
  }
}

// ============================================================
//  海鸥：掠过水面，点一下惊飞（加速升高 + 飞远）
// ============================================================
export class Seagull {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':sg' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.homeX = x;                      // 巡航锚点（见 update 里的往返约束）
    this.scale = rangeFrom(r, 0.85, 1.2);
    this.vx = rangeFrom(r, 0.5, 1.1) * (r() < 0.5 ? 1 : -1);
    this.dir = this.vx > 0 ? 1 : -1;
    this.phase = rangeFrom(r, 0, TAU);
    this.flee = makeReaction(1600);
    this.vy = 0;
    // 往返半径：海鸥绕着投放点来回飞，而不是永远朝一个方向漂。
    // 不设这个约束的话，它会在几十秒内飘出上千单位，横越岸线的弯曲处 ——
    // 于是原本站在沙滩上的海鸥会「飘」到开阔水面上方（实测 x 从 1497
    // 漂到 1277，depth 由 -20 变 +38）。鸟绕着自己的领地打转也更像真的。
    this.range = rangeFrom(r, 260, 520);
  }

  update(dt) {
    const k = dt / 16.667;
    this.phase += 0.22 * k;
    if (this.flee.on) {
      // 惊飞：横速翻倍、持续抬升，动画结束后缓慢落回
      this.x += this.vx * 2.4 * k * this.dir;
      this.vy = Math.min(this.vy - 0.09 * k, -0.5);
      this.y += this.vy * k;
    } else {
      this.x += this.vx * k;
      if (this.y > WORLD.y0 + 60) this.y -= 0.06 * k;  // 缓缓回到水面附近
      this.vy *= 0.92;
      // 到达巡航半径就掉头，保证始终在投放点附近的岸线上方
      const dx = this.x - this.homeX;
      if (dx > this.range) { this.vx = -Math.abs(this.vx); this.dir = -1; }
      else if (dx < -this.range) { this.vx = Math.abs(this.vx); this.dir = 1; }
    }
    if (this.x < WORLD.x0 - 80) this.x = WORLD.x1 + 80;
    if (this.x > WORLD.x1 + 80) this.x = WORLD.x0 - 80;
    stepReaction(this.flee, dt);
    return true;
  }

  draw(ctx) {
    const s = 11 * this.scale;
    const flap = Math.sin(this.phase);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);

    ctx.strokeStyle = 'rgba(250, 252, 255, 0.94)';
    ctx.lineWidth = Math.max(1.6, s * 0.16);
    ctx.lineCap = 'round';
    // 双翼：一上一下，构成"V"形振翅
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.7, -s * (0.3 + flap * 0.7), s * 1.5, -s * (0.1 + flap * 0.4));
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.7, -s * (0.3 - flap * 0.7), -s * 1.5, -s * (0.1 - flap * 0.4));
    ctx.stroke();

    // 身体
    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.52, s * 0.3, 0, 0, TAU);
    ctx.fill();
    // 喙
    ctx.fillStyle = 'rgba(240, 180, 70, 0.95)';
    ctx.beginPath();
    ctx.moveTo(s * 0.45, -s * 0.04);
    ctx.lineTo(s * 0.82, s * 0.06);
    ctx.lineTo(s * 0.45, s * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  hitTest(wx, wy) {
    const s = 11 * this.scale;
    const dx = wx - this.x, dy = wy - this.y;
    return dx * dx + dy * dy < (s * 1.7) * (s * 1.7);
  }

  onTap() {
    fire(this.flee);
    return { sfx: 'seagull', ripple: null, toast: null };
  }
}

// ============================================================
//  贝壳：沙滩上的小物件，点一下「拾起」（+1 收集计数）
// ============================================================
export class Shell {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':sh' + x.toFixed(0) + ',' + y.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.hue = rangeFrom(r, 20, 60);
    this.scale = rangeFrom(r, 0.75, 1.2);
    this.rot = rangeFrom(r, -0.5, 0.5);
    this.taken = false;
    this.lift = makeReaction(900);
  }

  update(dt) {
    stepReaction(this.lift, dt);
    return true;
  }

  draw(ctx) {
    if (this.taken && !this.lift.on) return;   // 拾起后不再绘制
    // 拾起动画：向上飘 + 淡出
    const p = this.lift.on ? this.lift.t / 900 : 0;
    const s = 8 * this.scale;
    ctx.save();
    ctx.translate(this.x, this.y - p * 42);
    ctx.globalAlpha = this.taken ? Math.max(0, 1 - p * 1.25) : 1;
    ctx.rotate(this.rot + p * 1.2);

    // 扇形壳
    ctx.fillStyle = 'hsl(' + this.hue + ', 46%, 84%)';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.5);
    ctx.arc(0, s * 0.5, s, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    // 放射纹
    ctx.strokeStyle = 'hsla(' + this.hue + ', 40%, 62%, 0.7)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.5);
      ctx.lineTo(Math.cos(a) * s, s * 0.5 + Math.sin(a) * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  hitTest(wx, wy) {
    if (this.taken) return false;
    const s = 8 * this.scale;
    const dx = wx - this.x, dy = wy - this.y;
    return dx * dx + dy * dy < (s * 1.9) * (s * 1.9);
  }

  onTap() {
    if (this.taken) return null;
    this.taken = true;
    fire(this.lift);
    return { sfx: 'snatch', ripple: null, toast: null, collect: 1 };
  }
}

// ============================================================
//  栈桥：岸带上的静态结构（不可点击，纯装饰）
// ============================================================
export class Pier {
  constructor(x, y, seed) {
    const r = makeRng((seed || '') + ':pr' + x.toFixed(0)).rng;
    this.x = x;
    this.y = y;
    this.len = rangeFrom(r, 150, 240);
    this.scale = rangeFrom(r, 0.95, 1.15);
    this.phase = rangeFrom(r, 0, TAU);
  }

  update(dt) {
    this.phase += 0.012 * (dt / 16.667);
    return true;
  }

  draw(ctx) {
    const s = 15 * this.scale;
    const L = this.len;
    ctx.save();
    ctx.translate(this.x, this.y);

    // 桥面：从岸边（上方 y 负方向）向水里（下方）延伸
    ctx.fillStyle = 'rgba(122, 100, 80, 0.92)';
    ctx.fillRect(-s * 0.42, -L * 0.1, s * 0.84, L);
    // 木板缝
    ctx.strokeStyle = 'rgba(92, 74, 58, 0.85)';
    ctx.lineWidth = 1;
    for (let i = 0; i < L / (s * 0.55); i++) {
      const yy = -L * 0.1 + i * s * 0.55;
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, yy);
      ctx.lineTo(s * 0.42, yy);
      ctx.stroke();
    }
    // 桥桩：成对，钉进水里；水下部分半透明
    ctx.strokeStyle = 'rgba(92, 74, 58, 0.85)';
    ctx.lineWidth = Math.max(1.6, s * 0.11);
    for (let i = 0; i * s * 1.5 < L; i++) {
      const yy = -L * 0.1 + i * s * 1.5;
      const wob = Math.sin(this.phase + i) * 0.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.34 + wob, yy);
      ctx.lineTo(-s * 0.34, yy + s * 1.1);
      ctx.moveTo(s * 0.34 + wob, yy);
      ctx.lineTo(s * 0.34, yy + s * 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 栈桥不可点击 —— 命中测试恒为 false，调用方据此跳过
  hitTest() { return false; }
  onTap() { return null; }
}

// ============================================================
//  布点：按地形与种子确定性地在世界里放置生命元素
// ============================================================

// 每类元素的「带偏好」与数量。数量会按 quality 分级缩水。
//  land:true 表示「岸上元素」—— 采样后要站在近景陆地区域内（见
//  terrain.sampleLandPoint），而不是水面里。
//  fromWater 决定它离水线的层次：值越大越靠内陆。
//  层次保持：shell(贴水边) < pier/seagull < umbrella < palm < lighthouse(最内陆)。
const PLAN = {
  swimmer:   { band: 'shallow',   n: 5,  land: false },
  child:     { band: 'shallow',   n: 3,  land: false },
  lifebuoy:  { band: 'shallow',   n: 3,  land: false },
  boat:      { band: 'nearshore', n: 3,  land: false },
  // 【陆地区域模型】fromWater = 元素脚底离水线的最小距离（世界单位）。
  //   shore / slope 都走 terrain.sampleLandPoint(x, fromWater, spread) ——
  //   在陆地带内采样，天然站在实体陆地上；island 走岛型特例分支。
  //   上限由 landDepth(650~850) 约束，这些值都远小于它，不会推出区域。
  seagull:   { band: 'beach',     n: 4,  land: true,  fromWater: 45 },
  shell:     { band: 'beach',     n: 6,  land: true,  fromWater: 30 },
  pier:      { band: 'beach',     n: 2,  land: true,  fromWater: 35 },
  umbrella:  { band: 'beach',     n: 4,  land: true,  fromWater: 120 },
  palm:      { band: 'land',      n: 4,  land: true,  fromWater: 170 },
  lighthouse:{ band: 'land',      n: 2,  land: true,  fromWater: 215 },
};

const CTORS = {
  swimmer: Swimmer, child: PlayingChild, lifebuoy: Lifebuoy, boat: Boat,
  seagull: Seagull, shell: Shell, umbrella: BeachUmbrella, palm: Palm,
  lighthouse: Lighthouse, pier: Pier,
};

/**
 * 把点收进世界矩形。
 *
 * 为什么必须收：岸上元素是按「朝远离水线方向推 ahead」吸附的，shore 地形的
 * 水线本身可以很靠近 y0，再往上推 ahead（棕榈 200）就会越出世界顶边 ——
 * 实测 16 种子 × 3 地形里有 9 个元素落到了 y < y0。
 * 越界本身不会崩，但相机的 visibleRect 永远不会覆盖到它们，
 * 于是「这个元素存在却永远看不见」——发现机制里就永远少一条。
 * 收进边界后它们会贴在顶边内侧，仍在视野可达范围内。
 */
function clampToWorld(x, y) {
  return {
    x: clamp(x, WORLD.x0 + 8, WORLD.x1 - 8),
    y: clamp(y, WORLD.y0 + 8, WORLD.y1 - 8),
  };
}

/**
 * 生成生命元素列表。
 * @param {object} terrain 地形实例（同时用作带内采样器与陆地吸附）
 * @param {string} seed 世界种子（保证同种子同布点）
 * @param {number} density 0..1 密度系数（quality 分级联动）
 */
export function createLife(terrain, seed, density = 1) {
  const rng = makeRng('life:' + (seed || '')).rng;
  const items = [];
  const dens = clamp(density, 0.2, 1.4);

  for (const kind of Object.keys(PLAN)) {
    const cfg = PLAN[kind];
    const Ctor = CTORS[kind];
    const n = Math.max(1, Math.round(cfg.n * dens));
    for (let i = 0; i < n; i++) {
      let x, y;
      if (cfg.land && terrain.type === 'island') {
        // 岛型地形特例：直接绕岛心取点，保证岸上元素一定落在岛内。
        // 若先采 beach 带再往外推，采样点可能落在岛外几百单位的远海，
        // 12 步推不回岸上。
        //
        // ⚠ 半径不能用 params.islR —— 岛不是正圆，islandEdge 有 ±26% 的角度
        // 扰动，按「半径的 0.72 倍」取点会在扰动收缩的方向上掉进海里。
        // 正确做法：取点后用 isLand() 实测，不行就把半径收缩重试。
        // ⚠ 不能用 homePoint() —— island 的 home 已经被改成「岛缘外侧」
        // （出生点要站在岛边看环带），拿它当岛心会让取点大面积落进海里。
        // 真正的岛心是 params.islX / params.islY。
        const p = terrain.params || {};
        const cx = p.islX, cy = p.islY;
        const R = p.islR || 300;
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
        let got = null;
        for (let k = 0; k < 16; k++) {
          const ang = rangeFrom(rng, 0, TAU);
          // 从岛心（0.06R）向外试到 0.55R；k 越大越靠内，保证收敛
          const rr = rangeFrom(rng, 0.06, Math.max(0.08, 0.55 - k * 0.035));
          const px = cx + Math.cos(ang) * R * rr;
          const py = cy + Math.sin(ang) * R * rr;
          if (terrain.isLand(px, py)) { got = { x: px, y: py }; break; }
        }
        // 岛心必定是陆地（dome 最高处），最后的兜底
        if (!got) got = { x: cx, y: cy };
        x = got.x;
        y = got.y;      } else if (cfg.land) {
        // 【陆地区域模型】shore / slope 的岸上元素直接在近景陆地带内采样。
        // 不再「先采浅水带、再往内陆推」——那样依赖水线法向，岸线一弯就
        // 失真，元素会掉进海里。区域内采样让元素天然站在实体陆地上，
        // 与相机移动、岸线弯曲完全无关。slope 的岸线虽是斜的，但
        // landRearAt 平行跟随水线，所以同一套 y 区间判据对 slope 也成立。
        const lp = terrain.sampleLandPoint(rng, cfg.fromWater, 70);
        if (lp && Number.isFinite(lp.x) && Number.isFinite(lp.y)) {
          x = lp.x;
          y = lp.y;
        } else {
          continue;
        }
      } else {
        // 水上元素（游泳者 / 儿童 / 救生圈 / 船）：按水深带采样
        const p = terrain.samplePoint(cfg.band, rng);
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        // 同一带内多个元素容易叠在一起，加一点确定性抖动错开
        x = p.x + rangeFrom(rng, -60, 60);
        y = p.y + rangeFrom(rng, -26, 26);
      }
      // 统一收边：不管是采样抖动、岛内取点还是岸上吸附产生的坐标，
      // 都要保证落在世界矩形内，否则相机裁剪会让它「永远看不见」。
      const cw = clampToWorld(x, y);
      x = cw.x;
      y = cw.y;
      const it = new Ctor(x, y, (seed || '') + ':' + kind + ':' + i);
      // 记下 PLAN 里的 kind —— 构造函数签名是 (x, y, seed)，塞不进类别信息。
      // 发现机制要靠它区分「看见一群海鸥」和「看见一座灯塔」，
      // 而靠 constructor.name 做映射太脆（改类名就静默失效）。
      it.kind = kind;
      items.push(it);
    }
  }
  return items;
}

/** 命中测试：返回最上面（数组末尾）被点中的元素 */
export function pickLife(items, wx, wy) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.hitTest && it.hitTest(wx, wy)) return it;
  }
  return null;
}

export { PLAN as LIFE_PLAN };
