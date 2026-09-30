// ============================================================
//  温和大鱼（阶段五 · 4.2） / 饥饿大鱼（阶段八 8B 冒险模式）
//  - 和平模式：非捕食者，缓慢好奇，靠近水母群时令其温和散开（复用 scare）
//  - 冒险模式：掠食者，加速逼近，接触时叼走一只水母（中档失败）
//  - 读取 current.sample() 施加到自身速度 → 玩家洋流可把它推开
//  - 状态机：wander（漂移/趋向水母群中心） → approach（靠近并轻散水母）
// ============================================================

import { rand, TAU } from '../core/config.js';
import { view } from '../core/state.js';

export class BigFish {
  constructor(mode = 'peace') {
    this.x = rand(0, view.W);
    this.y = rand(view.H * 0.2, view.H * 0.8);
    this.vx = rand(-0.4, 0.4);
    this.vy = rand(-0.2, 0.2);
    this.size = rand(34, 46);
    this.hue = rand(200, 260);
    this.state = 'wander';
    this.wob = rand(0, TAU);
    this.flash = 0;          // 靠近水母时的微光
    this.nearJellies = false; // 供 ecosystem 检测上升沿
    this.mode = mode;         // 'peace' | 'adventure'
    this.snatchCooldown = 0;  // 叼走后冷却，避免连吃
    this.hunting = 0;         // 冒险模式下捕捉时的高亮
  }

  setMode(m) { this.mode = m; }
  get isPredator() { return this.mode === 'adventure'; }

  update(dt, t, jellyArray, current, opts = {}) {
    const dtScale = dt / 16.667;
    const predator = this.mode === 'adventure';
    // 冒险模式更凶：加速上限与逼近力度都提高
    const max = predator ? 2.6 : 1.6;
    const onSnatch = opts.onSnatch;      // 回调：(jelly) => void

    if (this.snatchCooldown > 0) this.snatchCooldown = Math.max(0, this.snatchCooldown - dt);

    // 玩家洋流对大鱼生效（技巧落点：用洋流把它引开）
    if (current) {
      const c = current.sample(this.x, this.y, t);
      this.vx += c.vx * 0.5 * dtScale;
      this.vy += c.vy * 0.5 * dtScale;
    }

    // 水母群中心 & 最近个体
    let cx = 0, cy = 0, n = 0, nearest = Infinity, nx = 0, ny = 0, nearJ = null;
    for (const j of jellyArray) {
      cx += j.x; cy += j.y; n++;
      const d = Math.hypot(j.x - this.x, j.y - this.y);
      if (d < nearest) { nearest = d; nx = j.x; ny = j.y; nearJ = j; }
    }
    if (n > 0) { cx /= n; cy /= n; }

    const approachR = predator ? 300 : 320;

    if (nearest < approachR) {
      this.state = 'approach';
      this.nearJellies = true;
      const dx = nx - this.x, dy = ny - this.y, d = Math.hypot(dx, dy) || 1;
      // 冒险模式逼近更猛
      const push = predator ? 0.16 : 0.06;
      this.vx += (dx / d) * push * dtScale;
      this.vy += (dy / d) * push * dtScale;

      if (predator) {
        this.hunting = Math.min(1, this.hunting + 0.05 * dtScale);
        // 接触 → 叼走一只（若目标不在礁石庇护内、且未被玩家"抱住"）
        const dist = Math.hypot(nearJ.x - this.x, nearJ.y - this.y);
        const sheltered = opts.isSheltered ? opts.isSheltered(nearJ.x, nearJ.y) : false;
        if (dist < this.size * 1.1 && !sheltered && this.snatchCooldown <= 0 && onSnatch) {
          const taken = onSnatch(nearJ);
          if (taken) {
            this.snatchCooldown = 2600;
            this.flash = 1;
          }
        }
      } else {
        // 和平模式：温和令附近水母散开（非暴力）
        for (const j of jellyArray) {
          if (Math.hypot(j.x - this.x, j.y - this.y) < 150 && j.scare) j.scare();
        }
      }
      this.flash = Math.min(1, this.flash + 0.04 * dtScale);
    } else {
      this.state = 'wander';
      this.nearJellies = false;
      this.hunting = Math.max(0, this.hunting - 0.02 * dtScale);
      if (n > 0) {
        const dx = cx - this.x, dy = cy - this.y, d = Math.hypot(dx, dy) || 1;
        this.vx += (dx / d) * 0.012 * dtScale;
        this.vy += (dy / d) * 0.012 * dtScale;
      }
      // 缓慢环绕漂移
      this.vx += Math.cos(t * 0.0003 + this.wob) * 0.01 * dtScale;
      this.vy += Math.sin(t * 0.0003 + this.wob) * 0.01 * dtScale;
      this.flash *= Math.pow(0.95, dtScale);
    }

    this.vx *= Math.pow(0.97, dtScale);
    this.vy *= Math.pow(0.98, dtScale);
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > max) { this.vx = (this.vx / sp) * max; this.vy = (this.vy / sp) * max; }

    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;

    const m = this.size;
    if (this.x < -m) this.x = view.W + m;
    if (this.x > view.W + m) this.x = -m;
    if (this.y < -m) this.y = view.H + m;
    if (this.y > view.H + m) this.y = -m;

    this.wob += 0.02 * dtScale;
    return true;
  }

  draw(ctx) {
    const ang = Math.atan2(this.vy, this.vx);
    const predator = this.mode === 'adventure';
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(ang);

    // 身体（冒险模式偏暗红，一眼看出是掠食者）
    ctx.fillStyle = predator
      ? `hsla(${this.hue - 180}, 60%, 52%, 0.9)`
      : `hsla(${this.hue}, 55%, 62%, 0.85)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.55, 0, 0, TAU);
    ctx.fill();
    // 尾鳍
    ctx.beginPath();
    ctx.moveTo(-this.size, 0);
    ctx.lineTo(-this.size * 1.5, -this.size * 0.4);
    ctx.lineTo(-this.size * 1.5, this.size * 0.4);
    ctx.closePath();
    ctx.fill();
    // 靠近水母时的柔光 / 捕捉时的红光
    const glow = predator ? Math.max(this.flash, this.hunting) : this.flash;
    if (glow > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = predator
        ? `rgba(255, 90, 90, ${glow * 0.6})`
        : `rgba(255, 180, 140, ${glow * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 1.3, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // 眼睛
    ctx.fillStyle = 'rgba(20, 30, 50, 0.8)';
    ctx.beginPath();
    ctx.arc(this.size * 0.55, -this.size * 0.12, this.size * 0.1, 0, TAU);
    ctx.fill();
    // 牙齿（仅冒险模式，强化"掠食"感）
    if (predator) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.moveTo(this.size * 0.62, this.size * 0.16);
      ctx.lineTo(this.size * 0.78, this.size * 0.34);
      ctx.lineTo(this.size * 0.86, this.size * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
