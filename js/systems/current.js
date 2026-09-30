// ============================================================
//  洋流系统（阶段五 · 4.1）
//  - 玩家在「洋流模式」下拖拽，向局部注入水流矢量（puff）
//  - 全局叠加极轻的环境流，让海洋始终"呼吸"
//  - 水母 / 大鱼 通过 sample() 读取流速，获得浮力与惯性手感
// ============================================================

import { TAU, clamp } from '../core/config.js';
import { view } from '../core/state.js';

const MAX_PUFFS = 24;

export function createCurrent() {
  let mode = false;
  const puffs = []; // { x, y, vx, vy, r, life, maxLife }

  /** 拖拽时注入局部洋流；dx/dy 为拖拽位移（屏幕像素） */
  function push(x, y, dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const nx = dx / len, ny = dy / len;
    const speed = clamp(len * 0.5, 0.6, 4.2); // 拖得越快，水流越强

    // 合并到附近已有 puff，避免频繁新建
    let target = null, bestD = 64 * 64;
    for (const p of puffs) {
      const ddx = p.x - x, ddy = p.y - y, d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestD) { bestD = d2; target = p; }
    }
    if (target) {
      target.vx = target.vx * 0.6 + nx * speed * 0.4;
      target.vy = target.vy * 0.6 + ny * speed * 0.4;
      target.life = Math.min(target.maxLife, target.life + 6);
      target.x = x; target.y = y;
    } else {
      if (puffs.length >= MAX_PUFFS) puffs.shift();
      puffs.push({ x, y, vx: nx * speed, vy: ny * speed, r: 140, life: 70, maxLife: 70 });
    }
  }

  function update(dt) {
    const dtScale = dt / 16.667;
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life -= dtScale;
      p.r += 0.35 * dtScale; // 影响范围缓慢扩张
      if (p.life <= 0) puffs.splice(i, 1);
    }
  }

  /** 采样某点的水流速度 {vx, vy}：puff 贡献（距离衰减）+ 极轻环境流 */
  function sample(x, y, t = 0) {
    let vx = 0, vy = 0;
    for (const p of puffs) {
      const dx = x - p.x, dy = y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < p.r) {
        const fall = 1 - d / p.r;
        const w = fall * fall * (p.life / p.maxLife);
        vx += p.vx * w;
        vy += p.vy * w;
      }
    }
    // 环境流：几乎不可察的全局漂移，制造"活的海"底噪
    const amb = 0.028;
    vx += Math.sin(y * 0.008 + t * 0.00012) * amb;
    vy += Math.cos(x * 0.008 + t * 0.00009) * amb * 0.6;
    return { vx, vy };
  }

  function draw(ctx) {
    if (!puffs.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of puffs) {
      const a = (p.life / p.maxLife) * 0.16;
      const ang = Math.atan2(p.vy, p.vx);
      // 沿水流方向的几道短流线（手感反馈）
      ctx.strokeStyle = `rgba(170, 225, 255, ${a})`;
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const off = (k / 5 - 0.5) * p.r * 0.9;
        const px = p.x + Math.cos(ang + Math.PI / 2) * off;
        const py = p.y + Math.sin(ang + Math.PI / 2) * off;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.vx * 6, py + p.vy * 6);
        ctx.stroke();
      }
      // 柔环
      ctx.strokeStyle = `rgba(150, 210, 255, ${a * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 - (p.life / p.maxLife) * 0.3), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    get mode() { return mode; },
    setMode(v) { mode = !!v; return mode; },
    toggle() { mode = !mode; return mode; },
    push, update, sample, draw,
  };
}
