// ============================================================
//  远景鲸鱼（剪影 + 喷气泡）
// ============================================================

import { rand, TAU } from '../core/config.js';
import { WORLD } from '../systems/terrain.js';

// 鲸鱼是**远洋**生物：出现的地方必须水深足够。
// 否则它（半透明深色剪影）会直接压在浅色岛体上，看着像一块污渍。
// 用 depthAt 作判据 —— 这是地形的权威采样，陆地为负、浅滩接近 0。
const MIN_DEPTH = 260;

/** 由 main 注入地形采样（避免实体反向依赖 main 的单例） */
let depthAtFn = null;
export function setWhaleTerrain(tp) {
  depthAtFn = tp ? (x, y) => tp.depthAt(x, y) : null;
}

export class Whale {
  constructor(onBlow) {
    this.onBlow = onBlow;
    this.reset(true);
  }

  /** 在 [yMin, yMax] 里找一个水深够的位置（尝试若干次，失败就取最深的） */
  _deepY() {
    const y0 = WORLD.y0 + WORLD.h * 0.22;
    const y1 = WORLD.y0 + WORLD.h * 0.5;
    if (!depthAtFn) return rand(y0, y1);
    let best = null, bestD = -Infinity;
    for (let i = 0; i < 12; i++) {
      const y = rand(y0, y1);
      const d = depthAtFn(this.x, y);
      if (d >= MIN_DEPTH) return y;
      if (d > bestD) { bestD = d; best = y; }
    }
    return best === null ? rand(y0, y1) : best;
  }

  reset(initial) {
    // 阶段十一：鲸鱼横穿整个世界的远洋层
    this.x = initial ? rand(WORLD.x0, WORLD.x1) : WORLD.x0 - 260;
    this.y = this._deepY();
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

    // 若飘到浅水/陆地上（岛的外缘、岸边沙滩），往下潜回深水。
    // 用"向下推"而不是瞬移：鲸鱼的可爱之处就是慢慢游。
    if (depthAtFn) {
      const d = depthAtFn(this.x, this.y);
      if (d < MIN_DEPTH) this.y += 1.2 * dtScale;
    }

    this.blowTimer -= dtScale;
    if (this.blowTimer <= 0) {
      if (this.onBlow) this.onBlow(this.x + this.size * 0.4, this.y - 20);
      this.blowTimer = rand(400, 800);
    }
    if (this.x > WORLD.x1 + 300) this.reset(false);
    return true;
  }

  /** 当前位置是否在"水够深"的区域（渲染层用它决定要不要画） */
  _inWater() {
    if (!depthAtFn) return true;
    return depthAtFn(this.x, this.y) >= MIN_DEPTH * 0.6;
  }

  draw(ctx) {
    if (!this._inWater()) return;
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
