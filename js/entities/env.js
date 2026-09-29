// ============================================================
//  浮游生物 / 气泡 / 海草 / 波纹
// ============================================================

import { rand, TAU } from '../core/config.js';
import { view } from '../core/state.js';

/* ---------------- 浮游生物 ---------------- */
export class Plankton {
  constructor() { this.reset(true); }

  reset(initial) {
    this.x = rand(0, view.W);
    this.y = initial ? rand(0, view.H) : view.H + 10;
    this.r = rand(0.6, 2.2);
    this.vy = -rand(0.1, 0.4);
    this.vx = rand(-0.1, 0.1);
    this.hue = rand(180, 280);
    this.life = rand(0, TAU);
    this.twinkle = rand(0.02, 0.06);
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.y += this.vy * dtScale;
    this.x += (this.vx + Math.sin(this.life) * 0.2) * dtScale;
    this.life += this.twinkle * dtScale;
    if (this.y < -10) this.reset(false);
    return true;
  }

  draw(ctx) {
    const a = 0.45 + Math.sin(this.life) * 0.4;
    ctx.fillStyle = `hsla(${this.hue}, 85%, 85%, ${a})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fill();
  }
}

/* ---------------- 气泡 ---------------- */
export class Bubble {
  constructor(x, y, fast) {
    this.x = x ?? rand(0, view.W);
    this.y = y ?? view.H + 10;
    this.r = rand(2, 7);
    this.vy = -(fast ? rand(1.5, 3) : rand(0.3, 0.9));
    this.wob = rand(0, TAU);
    this.wobSpeed = rand(0.02, 0.05);
    this.life = 1;
    this.fast = fast;
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.y += this.vy * dtScale;
    this.wob += this.wobSpeed * dtScale;
    this.x += Math.sin(this.wob) * 0.5 * dtScale;
    if (this.fast) this.life -= 0.008 * dtScale;
    return this.y > -20 && this.life > 0;
  }

  draw(ctx) {
    ctx.strokeStyle = `rgba(200, 235, 255, ${0.35 * this.life})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.15 * this.life})`;
    ctx.beginPath();
    ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.3, 0, TAU);
    ctx.fill();
  }
}

/* ---------------- 海草（无 update，靠 t 驱动） ---------------- */
export class Seaweed {
  constructor(x) {
    this.x = x;
    this.h = rand(80, 180);
    this.segs = 10;
    this.phase = rand(0, TAU);
    this.speed = rand(0.01, 0.025);
    this.hue = rand(120, 170);
    this.width = rand(4, 9);
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, view.H);
    ctx.strokeStyle = `hsla(${this.hue}, 60%, 30%, 0.6)`;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 1; i <= this.segs; i++) {
      const f = i / this.segs;
      const sway = Math.sin(t * this.speed + this.phase + f * 3) * 15 * f;
      ctx.lineTo(sway, -this.h * f);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------------- 波纹 ---------------- */
export class Ripple {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 4; this.maxR = 90;
    this.life = 1;
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.r += 2.2 * dtScale;
    this.life = 1 - this.r / this.maxR;
    return this.life > 0;
  }

  draw(ctx) {
    ctx.strokeStyle = `rgba(160, 220, 255, ${this.life * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.stroke();
  }
}

/* ---------------- 饵料（新增） ---------------- */
export class Bait {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 6;
    this.vy = 0.05;
    this.life = 1;
    this.wob = rand(0, TAU);
    this.consumed = 0;
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.y += this.vy * dtScale;
    this.wob += 0.06 * dtScale;
    this.x += Math.sin(this.wob) * 0.3 * dtScale;
    this.life -= dt / 6000;              // 约 6 秒
    if (this.consumed > 0) this.life -= this.consumed;
    return this.life > 0;
  }

  draw(ctx) {
    const a = Math.min(1, this.life * 1.5);
    const r = this.r * (0.8 + Math.sin(this.wob * 3) * 0.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 3.5);
    g.addColorStop(0, `rgba(255, 245, 200, ${0.85 * a})`);
    g.addColorStop(0.35, `rgba(255, 220, 130, ${0.4 * a})`);
    g.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 3.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
