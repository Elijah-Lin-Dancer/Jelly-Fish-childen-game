// ============================================================
//  秘密实体（阶段七）
//  - shell：隐藏贝壳（点击发现）
//  - shrine：冥想点（点击后静静发光）
//  低调脉动，奖励好奇心；发现后由 explore 记录
// ============================================================

import { rand, TAU } from '../core/config.js';
import { camera } from '../core/state.js';
import { WORLD } from '../systems/terrain.js';

export class Secret {
  constructor(id, kind, x, y, opts = {}) {
    this.id = id;
    this.kind = kind || 'shell';   // shell | shrine
    // 阶段十一：世界坐标。未指定时落在相机可见范围内（秘境总是「可遇」的）
    this.x = x ?? rand(camera.x, camera.x + camera.vw);
    this.y = y ?? rand(camera.y, camera.y + camera.vh);
    this.r = kind === 'shrine' ? 26 : 12;
    this.found = false;
    this.phase = rand(0, TAU);
    this.label = opts.label || null;
    this.zone = opts.zone || 'shallow';
  }

  /** 命中检测 */
  hit(x, y, pad = 22) {
    const dx = x - this.x, dy = y - this.y;
    const rr = this.r + pad;
    return dx * dx + dy * dy < rr * rr;
  }

  update(dt) {
    this.phase += 0.0016 * dt;
    return true;
  }

  draw(ctx) {
    const p = (Math.sin(this.phase) + 1) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (this.kind === 'shrine') {
      // 冥想点：柔和的直立光柱 + 基座环
      const a = 0.18 + p * 0.16;
      const g = ctx.createLinearGradient(this.x, this.y - 120, this.x, this.y + 20);
      g.addColorStop(0, 'rgba(200, 235, 255, 0)');
      g.addColorStop(0.6, `rgba(200, 235, 255, ${a})`);
      g.addColorStop(1, `rgba(150, 210, 255, ${a * 1.4})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.x - 16, this.y + 18);
      ctx.lineTo(this.x + 16, this.y + 18);
      ctx.lineTo(this.x + 6, this.y - 120);
      ctx.lineTo(this.x - 6, this.y - 120);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(190, 230, 255, ${0.35 + p * 0.3})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 18, this.r * (1 + p * 0.08), this.r * 0.42, 0, 0, TAU);
      ctx.stroke();
    } else {
      // 贝壳：低调的柔光点 + 小扇形
      const a = 0.2 + p * 0.25;
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.6);
      g.addColorStop(0, `rgba(255, 240, 200, ${a})`);
      g.addColorStop(1, 'rgba(255, 220, 160, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 2.6, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 235, 190, ${0.5 + p * 0.4})`;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const ang = -Math.PI * 0.9 + (i / 3) * Math.PI * 0.8;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.r * 0.5);
        ctx.lineTo(this.x + Math.cos(ang) * this.r, this.y + Math.sin(ang) * this.r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** 按海域布置秘密（确定性坐标，避免每次刷新乱跳） */
export function seedSecrets(zoneId) {
  const out = [];
  if (zoneId === 'shallow') {
    out.push(new Secret('sh_c1', 'shell', 0.22, 0.72, { zone: 'shallow' }));
    out.push(new Secret('sh_c2', 'shell', 0.78, 0.34, { zone: 'shallow' }));
    out.push(new Secret('sh_s1', 'shrine', 0.5, 0.8, { zone: 'shallow' }));
  } else if (zoneId === 'midnight') {
    out.push(new Secret('mi_c1', 'shell', 0.3, 0.4, { zone: 'midnight' }));
    out.push(new Secret('mi_c2', 'shell', 0.7, 0.66, { zone: 'midnight' }));
    out.push(new Secret('mi_s1', 'shrine', 0.5, 0.3, { zone: 'midnight' }));
  } else {
    out.push(new Secret('ab_c1', 'shell', 0.4, 0.6, { zone: 'abyss' }));
    out.push(new Secret('ab_s1', 'shrine', 0.6, 0.42, { zone: 'abyss' }));
  }
  // 相对坐标 → 世界坐标。阶段十一：映射到「世界」而不是视口，
  // 这样秘密是地图上的固定地标，而不是随窗口尺寸漂移。
  const vx0 = camera.x;
  const vy0 = camera.y;
  const vw = camera.vw;
  const vh = camera.vh;
  for (const s of out) {
    s.x = vx0 + vw * s.x;
    s.y = vy0 + vh * s.y;
    s.r = Math.min(s.r, Math.min(vw, vh) * 0.05);
  }
  return out;
}
