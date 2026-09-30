// ============================================================
//  Bogyó — 隐藏纪念水母
//  继承自 Jellyfish，叠加他的四个专属特征：
//    1. 橘白配色（上橘下白，对应他的花色）
//    2. 歪耳朵 —— 伞盖一侧的不对称折角，他的招牌
//    3. 吐舌头 —— 伞中央垂下的小粉舌，随水轻晃
//    4. 浣熊尾 —— 触手末端的环纹，就是他的尾巴花纹
//  他不参与经济 / 繁育 / 图鉴计数，只是安静地游着。
// ============================================================

import { TAU, rand } from '../core/config.js';
import { Jellyfish } from './jellyfish.js';

export class Bogyo extends Jellyfish {
  constructor(x, y, opts = {}) {
    // 固定配色索引 0（实际颜色由 palette 覆盖）
    super(x, y, 0, {});
    this.palette = opts.palette || { core: '#f7b06a', glow: '#ff8f3c', tent: '#fff0e0' };
    this.isMemory = true;     // 标记：不收录图鉴、不参与统计
    this.rare = false;
    this.hybrid = false;
    this.egg = false;

    // 体型：偏小一号，像只还没玩够的小猫；游得稍快
    const scaleRef = this.baseR / Math.max(1, this.r) || 1;
    this.r *= 0.86 * scaleRef;
    this.baseR = this.r;

    // 舌头 / 耳朵的独立相位（避免与呼吸同步，显得更"活着"）
    this.tonguePhase = rand(0, TAU);
    this.earPhase = rand(0, TAU);

    // 触手做成环纹（浣熊尾）
    this._buildTentacles();
    for (const t of this.tentacles) t.ringed = true;

    // 名字
    this.name = opts.name || 'Bogyó';
  }

  update(dt, t) {
    super.update(dt, t);
    this.tonguePhase += 0.0022 * (dt / 16.667);
    this.earPhase += 0.0013 * (dt / 16.667);
    return true;
  }

  draw(ctx) {
    // 常驻柔光：让他即使在人多的池塘里也能被找到（很轻，不喧宾夺主）
    this._drawAura(ctx);
    // 先画本体 + 触须（父类），再叠他的特征
    this._drawRingedTentacles(ctx);
    super.draw(ctx);
    this._drawEarAndTongue(ctx);
  }

  /** 常驻柔光：缓慢呼吸的暖色光环 */
  _drawAura(ctx) {
    const r = this.baseR * this.scale * (0.85 + this.pulse * 0.25);
    const breathe = (Math.sin(this.age * 0.0012) + 1) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = r * (1.9 + breathe * 0.25);
    const g = ctx.createRadialGradient(this.x, this.y, r * 0.6, this.x, this.y, R);
    g.addColorStop(0, 'rgba(255, 214, 150, 0)');
    g.addColorStop(0.7, `rgba(255, 206, 140, ${0.12 + breathe * 0.08})`);
    g.addColorStop(1, 'rgba(255, 190, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, TAU);
    ctx.fill();
    // 一圈极淡的虚环，作为"他在那里"的提示
    ctx.globalAlpha = 0.22 + breathe * 0.14;
    ctx.strokeStyle = 'rgba(255, 224, 178, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -this.age * 0.012;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R * 0.92, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** 环纹触手：在父类触须基础上补一圈圈深色环带 */
  _drawRingedTentacles(ctx) {
    const r = this.baseR * this.scale * (0.85 + this.pulse * 0.25);
    const nT = this.tentacles.length;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < nT; i++) {
      const t2 = this.tentacles[i];
      const baseX = (i / Math.max(1, nT - 1) - 0.5) * r * 1.4;
      const segs = 14;
      // 复算触手路径点，用于在末端打环
      const pts = [];
      for (let s = 0; s <= segs; s++) {
        const f = s / segs;
        const wave = Math.sin(this.sway * 3 + t2.phase + s * 0.6) * t2.amp * f;
        pts.push([baseX + wave + this.vx * 6 * f, r * 0.3 + t2.len * f * this.scale]);
      }
      // 环带只画下半段，越靠末端越密，像尾巴
      ctx.strokeStyle = 'rgba(120, 78, 40, 0.5)';
      ctx.lineWidth = Math.max(1, t2.width * 0.5);
      const rings = 5;
      for (let k = 0; k < rings; k++) {
        const f = 0.52 + (k / rings) * 0.44;
        const idx = Math.min(segs, Math.max(1, Math.round(f * segs)));
        const a = pts[idx - 1];
        const b = pts[idx];
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** 歪耳朵 + 吐舌头 */
  _drawEarAndTongue(ctx) {
    const r = this.baseR * this.scale * (0.85 + this.pulse * 0.25);
    ctx.save();
    ctx.translate(this.x, this.y);

    // 歪耳朵：左上方一个不对称的"折角"三角
    const earFlick = Math.sin(this.earPhase) * 0.12;
    ctx.save();
    ctx.translate(-r * 0.52, -r * 0.92);
    ctx.rotate(-0.55 + earFlick);
    ctx.fillStyle = this.palette.core;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.16, -r * 0.52);   // 折角：一高一低
    ctx.lineTo(r * 0.3, -r * 0.62);
    ctx.closePath();
    ctx.fill();
    // 耳内粉色
    ctx.fillStyle = 'rgba(255, 170, 190, 0.65)';
    ctx.beginPath();
    ctx.moveTo(r * 0.02, -r * 0.08);
    ctx.lineTo(-r * 0.06, -r * 0.4);
    ctx.lineTo(r * 0.22, -r * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 右耳（正常的，做对比）
    ctx.save();
    ctx.translate(r * 0.5, -r * 0.86);
    ctx.rotate(0.32);
    ctx.fillStyle = this.palette.core;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.14, -r * 0.5);
    ctx.lineTo(r * 0.24, -r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 吐舌头：伞中央垂下的小粉舌
    const tl = (Math.sin(this.tonguePhase) + 1) * 0.5;
    const sway = Math.sin(this.sway * 4) * r * 0.05;
    const tongueLen = r * (0.34 + tl * 0.14);
    ctx.fillStyle = 'rgba(255, 150, 175, 0.92)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.09 + sway, r * 0.1);
    ctx.quadraticCurveTo(sway, r * 0.1 + tongueLen, r * 0.09 + sway, r * 0.1);
    ctx.closePath();
    ctx.fill();
    // 舌中线
    ctx.strokeStyle = 'rgba(230, 110, 140, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sway, r * 0.16);
    ctx.lineTo(sway, r * 0.1 + tongueLen * 0.82);
    ctx.stroke();

    ctx.restore();
  }

  /** 图鉴缩略图上用同一套特征（供 dex 调用） */
  drawThumbAt(ctx, cx, cy, R) {
    ctx.save();
    ctx.translate(cx, cy);
    const p = this.palette;

    // 光晕
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2);
    g.addColorStop(0, p.glow + 'aa');
    g.addColorStop(1, p.glow + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2, 0, TAU);
    ctx.fill();

    // 环纹触须
    ctx.lineCap = 'round';
    const nT = 7;
    for (let i = 0; i < nT; i++) {
      const baseX = (i / (nT - 1) - 0.5) * R * 1.4;
      const len = R * (1.5 + (i % 3) * 0.25);
      ctx.beginPath();
      ctx.moveTo(baseX, R * 0.3);
      for (let s = 1; s <= 10; s++) {
        const f = s / 10;
        ctx.lineTo(baseX + Math.sin(i + s * 0.6) * 5 * f, R * 0.3 + len * f);
      }
      ctx.strokeStyle = p.tent + (i % 2 === 0 ? 'cc' : '88');
      ctx.lineWidth = 1.7;
      ctx.stroke();
      // 环
      ctx.strokeStyle = 'rgba(120, 78, 40, 0.55)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const f = 0.55 + (k / 4) * 0.4;
        const y = R * 0.3 + len * f;
        const x = baseX + Math.sin(i + f * 10 * 0.6) * 5 * f;
        ctx.beginPath();
        ctx.moveTo(x - 2, y);
        ctx.lineTo(x + 2, y);
        ctx.stroke();
      }
    }

    // 伞盖
    const bodyG = ctx.createRadialGradient(0, -R * 0.2, 0, 0, 0, R);
    bodyG.addColorStop(0, p.core + 'ff');
    bodyG.addColorStop(0.6, p.core + 'cc');
    bodyG.addColorStop(1, '#ffffffaa');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-R, 0);
    ctx.bezierCurveTo(-R, -R * 1.3, R, -R * 1.3, R, 0);
    for (let i = 0; i <= 5; i++) {
      const f = i / 5;
      ctx.lineTo(R - f * R * 2, R * 0.15);
    }
    ctx.closePath();
    ctx.fill();

    // 歪耳朵
    ctx.save();
    ctx.translate(-R * 0.52, -R * 0.92);
    ctx.rotate(-0.55);
    ctx.fillStyle = p.core;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-R * 0.16, -R * 0.52);
    ctx.lineTo(R * 0.3, -R * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(R * 0.5, -R * 0.86);
    ctx.rotate(0.32);
    ctx.fillStyle = p.core;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-R * 0.14, -R * 0.5);
    ctx.lineTo(R * 0.24, -R * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 舌头
    ctx.fillStyle = 'rgba(255, 150, 175, 0.92)';
    ctx.beginPath();
    ctx.moveTo(-R * 0.09, R * 0.1);
    ctx.quadraticCurveTo(0, R * 0.42, R * 0.09, R * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
