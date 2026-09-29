// ============================================================
//  远景鲸鱼（剪影 + 喷气泡）
// ============================================================

import { rand, TAU } from '../core/config.js';
import { view } from '../core/state.js';

export class Whale {
  constructor(onBlow) {
    this.onBlow = onBlow;
    this.reset(true);
  }

  reset(initial) {
    this.x = initial ? rand(-view.W, view.W) : -200;
    this.y = rand(view.H * 0.3, view.H * 0.7);
    this.vx = rand(0.3, 0.6);
    this.size = rand(140, 220);
    this.blowTimer = rand(200, 500);
    this.drift = rand(0, TAU);
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.x += this.vx * dtScale;
    this.drift += 0.0003 * dt;
    this.y += Math.sin(this.drift) * 0.15 * dtScale;
    this.blowTimer -= dtScale;
    if (this.blowTimer <= 0) {
      if (this.onBlow) this.onBlow(this.x + this.size * 0.4, this.y - 20);
      this.blowTimer = rand(400, 800);
    }
    if (this.x > view.W + 300) this.reset(false);
    return true;
  }

  draw(ctx) {
    const s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#0a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s * 1.4, -s * 0.3);
    ctx.lineTo(-s * 1.3, 0);
    ctx.lineTo(-s * 1.4, s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
