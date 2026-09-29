// ============================================================
//  海龟
// ============================================================

import { rand, TAU } from '../core/config.js';
import { view } from '../core/state.js';

export class Turtle {
  constructor() {
    this.x = rand(0, view.W);
    this.y = rand(view.H * 0.2, view.H * 0.7);
    this.vx = rand(0.4, 0.9) * (Math.random() < 0.5 ? 1 : -1);
    this.dir = this.vx > 0 ? 1 : -1;
    this.flap = 0;
    this.size = rand(30, 46);
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.flap += 0.06 * dtScale;
    this.x += this.vx * dtScale;
    this.y += Math.sin(this.flap * 0.5) * 0.2 * dtScale;
    if (this.x < -80) { this.x = view.W + 80; this.dir = 1; this.vx = Math.abs(this.vx); }
    if (this.x > view.W + 80) { this.x = -80; this.dir = -1; this.vx = -Math.abs(this.vx); }
    return true;
  }

  draw(ctx) {
    const s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);

    ctx.fillStyle = 'rgba(60, 90, 110, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.6, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 170, 190, 0.5)';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * s * 0.25, 0, s * 0.18, s * 0.45, 0, 0, TAU);
      ctx.stroke();
    }

    const flap = Math.sin(this.flap) * 0.5;
    ctx.fillStyle = 'rgba(90, 130, 150, 0.7)';
    ctx.save();
    ctx.translate(s * 0.5, 0);
    ctx.rotate(flap);
    ctx.beginPath();
    ctx.ellipse(s * 0.4, 0, s * 0.4, s * 0.18, 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(-s * 0.5, 0);
    ctx.rotate(-flap);
    ctx.beginPath();
    ctx.ellipse(-s * 0.4, 0, s * 0.4, s * 0.18, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(80, 120, 140, 0.8)';
    ctx.beginPath();
    ctx.ellipse(s * 0.85, -s * 0.05, s * 0.22, s * 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
