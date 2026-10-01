// ============================================================
//  秘密实体（阶段七）
//  - shell：隐藏贝壳（点击发现）
//  - shrine：冥想点（点击后静静发光）
//  低调脉动，奖励好奇心；发现后由 explore 记录
// ============================================================

import { rand, TAU } from '../core/config.js';
import { camera } from '../core/state.js';
import { WORLD } from '../systems/terrain.js';
import { signals, depthLight, rimLight, rgba, LIGHT } from '../render/volume.js';

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

    // 期三：接入共享深度协议。秘密是发光信标 ——
    // 浅水 boost=1 与旧观感完全一致；越深越醒目（黑暗里的信标感）；
    // 受光不对称朝向共享 LIGHT，但幅度随深度衰减（深海方向感消失，只剩信标本身）。
    const dn = signals.depthNorm(this.x, this.y);
    const L = depthLight(dn);
    const boost = 1 + dn * 0.55;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (this.kind === 'shrine') {
      // 冥想点：柔和的直立光柱 + 基座环
      const a = (0.18 + p * 0.16) * boost;
      const g = ctx.createLinearGradient(this.x, this.y - 120, this.x, this.y + 20);
      g.addColorStop(0, 'rgba(200, 235, 255, 0)');
      g.addColorStop(0.6, `rgba(200, 235, 255, ${a})`);
      g.addColorStop(1, `rgba(150, 210, 255, ${Math.min(1, a * 1.4)})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.x - 16, this.y + 18);
      ctx.lineTo(this.x + 16, this.y + 18);
      ctx.lineTo(this.x + 6, this.y - 120);
      ctx.lineTo(this.x - 6, this.y - 120);
      ctx.closePath();
      ctx.fill();

      const rx = this.r * (1 + p * 0.08);
      ctx.strokeStyle = rgba('190,230,255', Math.min(0.85, (0.35 + p * 0.3) * boost));
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 18, rx, this.r * 0.42, 0, 0, TAU);
      ctx.stroke();

      // 基座环朝光弧（左上）增亮 —— 与世界共享同一受光方向；
      // 深海里方向光衰减（L.light），信标本身更亮（boost）
      rimLight(ctx, this.x, this.y + 18, rx, '200,235,255', {
        ry: 0.42, from: Math.PI * 1.02, to: Math.PI * 1.72,
        alpha: Math.min(0.5, (0.18 + p * 0.2) * boost * L.light), width: 1.4,
      });
    } else {
      // 贝壳：低调的柔光点 + 小扇形
      const a = (0.2 + p * 0.25) * boost;
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.6);
      g.addColorStop(0, `rgba(255, 240, 200, ${Math.min(1, a)})`);
      g.addColorStop(1, 'rgba(255, 220, 160, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 2.6, 0, TAU);
      ctx.fill();

      ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const ang = -Math.PI * 0.9 + (i / 3) * Math.PI * 0.8;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        // 肋线朝光侧更亮：与 LIGHT 的点积决定受光系数（0.55 ~ 1.05），
        // 幅度乘 L.light（深海方向感衰减）
        const lit = Math.max(0.55, Math.min(1.05, 0.75 + (dx * LIGHT.x + dy * LIGHT.y) * 0.4 * L.light));
        ctx.strokeStyle = rgba('255,235,190', Math.min(1, (0.5 + p * 0.4) * lit * (1 + dn * 0.3)));
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.r * 0.5);
        ctx.lineTo(this.x + dx * this.r, this.y + dy * this.r);
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
