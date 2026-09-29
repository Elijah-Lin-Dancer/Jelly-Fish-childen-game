// ============================================================
//  水母 — 主角
//  含：呼吸脉冲 / 指针吸引 / 受惊回弹 / 成长进化 / 入夜增亮
// ============================================================

import { rand, TAU, damp, clamp } from '../core/config.js';
import { pointer, view, theme, dayNight } from '../core/state.js';

/** 六种配色（name 供图鉴使用） */
export const JELLY_PALETTES = [
  { key: 'pink',   core: '#ff9ed8', glow: '#ff5fbf', tent: '#ffb3e6' },
  { key: 'cyan',   core: '#7fe9ff', glow: '#2fc8ff', tent: '#a8efff' },
  { key: 'orange', core: '#ffd29e', glow: '#ff9a3c', tent: '#ffe0b3' },
  { key: 'green',  core: '#a8ffb8', glow: '#3dffa0', tent: '#c2ffd0' },
  { key: 'violet', core: '#d9b3ff', glow: '#a64dff', tent: '#e6ccff' },
  { key: 'yellow', core: '#fff0a8', glow: '#ffd84d', tent: '#fff5c2' },
];

export class Jellyfish {
  constructor(x, y, paletteIndex, opts = {}) {
    this.x = x ?? rand(view.W * 0.05, view.W * 0.95);
    this.y = y ?? rand(view.H * 0.12, view.H * 0.88);
    this.paletteIndex = paletteIndex ?? ((Math.random() * JELLY_PALETTES.length) | 0);
    this.palette = JELLY_PALETTES[this.paletteIndex];

    const juvenile = opts.juvenile === true;
    // 按视口尺寸缩放，小屏水母不至于过大
    const scaleRef = Math.min(1, Math.max(0.52, Math.min(view.W, view.H) / 720));
    this.r = (juvenile ? rand(10, 14) : rand(22, 48)) * scaleRef;
    this.baseR = this.r;

    // 成长
    this.age = 0;
    this.scale = juvenile ? 0.45 : 1;
    this.growthTarget = 1;
    this.mutated = false;
    this.interactions = 0;

    this.vx = rand(-0.3, 0.3);
    this.vy = rand(-0.2, 0.1);
    this.phase = rand(0, TAU);
    this.pulseSpeed = rand(0.012, 0.022);
    this.sway = rand(0, TAU);
    this.swaySpeed = rand(0.005, 0.012);

    this.tentacles = [];
    this._buildTentacles();

    this.scared = 0;
    this.attract = 0;
    this.pulse = 0;

    // 复用的渐变缓存（避免每帧 new）
    this._glowGrad = null;
    this._glowKey = '';

    // 闪光（被互动/变异时）
    this.flash = 0;
  }

  _buildTentacles() {
    this.tentacles.length = 0;
    const n = this.r > 35 ? 9 : 7;
    for (let i = 0; i < n; i++) {
      this.tentacles.push({
        len: rand(this.r * 1.2, this.r * 2.6),
        phase: rand(0, TAU),
        freq: rand(0.02, 0.05),
        amp: rand(4, 12),
        width: rand(1.2, 2.6),
      });
    }
  }

  /** 变异：换一种配色 + 触须加两根 */
  mutate() {
    if (this.mutated) return false;
    this.mutated = true;
    let idx = this.paletteIndex;
    while (idx === this.paletteIndex && JELLY_PALETTES.length > 1) {
      idx = (Math.random() * JELLY_PALETTES.length) | 0;
    }
    this.paletteIndex = idx;
    this.palette = JELLY_PALETTES[idx];
    this.tentacles.push(
      { len: rand(this.r * 1.2, this.r * 2.6), phase: rand(0, TAU), freq: rand(0.02, 0.05), amp: rand(4, 12), width: rand(1.2, 2.6) },
      { len: rand(this.r * 1.2, this.r * 2.6), phase: rand(0, TAU), freq: rand(0.02, 0.05), amp: rand(4, 12), width: rand(1.2, 2.6) }
    );
    this._glowGrad = null;
    this.flash = 1;
    return true;
  }

  /** 一次互动（点击命中） */
  interact() {
    this.interactions++;
    this.flash = 1;
    if (this.interactions >= 5 && !this.mutated) return this.mutate();
    return false;
  }

  scare() { this.scared = 1; }

  update(dt, t) {
    const dtScale = dt / 16.667;

    this.phase += this.pulseSpeed * dtScale;
    this.sway += this.swaySpeed * dtScale;

    // 成长
    this.age += dt;
    if (this.scale < 1) {
      this.scale = damp(this.scale, 1, 0.28, dt);
      if (this.scale > 0.995) this.scale = 1;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 600);

    const pulse = (Math.sin(this.phase) + 1) * 0.5;

    // 指针吸引
    if (pointer.active) {
      const dx = pointer.x - this.x;
      const dy = pointer.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 260 * 260) {
        const d = Math.sqrt(d2) || 1;
        const f = (1 - d / 260) * 0.15 * dtScale;
        this.vx += (dx / d) * f;
        this.vy += (dy / d) * f;
        this.attract = Math.min(1, this.attract + 0.05 * dtScale);
      } else {
        this.attract *= Math.pow(0.95, dtScale);
      }
    } else {
      this.attract *= Math.pow(0.9, dtScale);
    }

    // 自然漂浮：温和的垂直回归力，让水母分布在中层水域而非堆在顶部
    const midY = view.H * 0.52;
    const dy2 = midY - this.y;
    this.vy += Math.sign(dy2) * Math.min(0.012, Math.abs(dy2) / view.H * 0.03) * dtScale;
    this.vx += Math.sin(this.sway) * 0.008 * dtScale;
    this.vx *= Math.pow(0.96, dtScale);
    this.vy *= Math.pow(0.97, dtScale);

    // 速度上限
    const sp = Math.hypot(this.vx, this.vy);
    const maxSp = 3;
    if (sp > maxSp) { this.vx = (this.vx / sp) * maxSp; this.vy = (this.vy / sp) * maxSp; }

    if (this.scared > 0) {
      this.vy -= this.scared * 0.3 * dtScale;
      this.scared *= Math.pow(0.9, dtScale);
    }

    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;

    // 边界环绕
    const rr = this.r * this.scale;
    if (this.y < -rr * 4) this.y = view.H + rr;
    if (this.y > view.H + rr * 4) this.y = -rr;
    if (this.x < -rr * 3) this.x = view.W + rr;
    if (this.x > view.W + rr * 3) this.x = -rr;

    this.pulse = pulse;
    return true;
  }

  draw(ctx) {
    const pulse = this.pulse;
    const r = this.baseR * this.scale * (0.85 + pulse * 0.25);
    const p = this.palette;
    const th = theme.current;
    const nightGlow = 1 + (1 - dayNight.sun) * 1.2;
    // 密度自适应：水母越多，单个外发光越收敛，避免叠加死白
    const crowd = Math.min(1, 12 / Math.max(4, Jellyfish.__count || 12));
    const boost = (th.glowBoost * nightGlow + this.flash * 0.8) * (0.6 + crowd * 0.4);

    ctx.save();
    ctx.translate(this.x, this.y);

    // 外发光（渐变按尺寸缓存，尺寸变了才重建）
    const glowR = r * (th.glowScale + pulse * 0.8);
    const key = Math.round(glowR) + '|' + p.glow + '|' + boost.toFixed(2);
    if (this._glowKey !== key) {
      const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, glowR);
      const a1 = Math.min(160, Math.round(0x88 * boost)).toString(16).padStart(2, '0');
      const a2 = Math.min(90, Math.round(0x44 * boost)).toString(16).padStart(2, '0');
      g.addColorStop(0, p.glow + a1);
      g.addColorStop(0.4, p.glow + a2);
      g.addColorStop(1, p.glow + '00');
      this._glowGrad = g;
      this._glowKey = key;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this._glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 触须
    ctx.lineCap = 'round';
    const nT = this.tentacles.length;
    for (let i = 0; i < nT; i++) {
      const t2 = this.tentacles[i];
      const baseX = (i / (nT - 1) - 0.5) * r * 1.4;
      const segs = 14;
      ctx.beginPath();
      ctx.moveTo(baseX, r * 0.3);
      for (let s = 1; s <= segs; s++) {
        const f = s / segs;
        const wave = Math.sin(this.sway * 3 + t2.phase + s * 0.6) * t2.amp * f;
        const tx = baseX + wave + this.vx * 6 * f;
        const ty = r * 0.3 + t2.len * f * this.scale;
        ctx.lineTo(tx, ty);
      }
      ctx.strokeStyle = p.tent + (i % 2 === 0 ? 'cc' : '88');
      ctx.lineWidth = t2.width * (1 - pulse * 0.3);
      ctx.stroke();
    }

    // 伞盖（半透明，但保持足够色彩浓度以区分六色）
    const bodyG = ctx.createRadialGradient(0, -r * 0.2, 0, 0, 0, r);
    bodyG.addColorStop(0, p.core + 'ee');
    bodyG.addColorStop(0.55, p.core + '99');
    bodyG.addColorStop(1, p.glow + '44');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r, -r * 1.3, r, -r * 1.3, r, 0);
    const waveCount = 5;
    for (let i = 0; i <= waveCount; i++) {
      const f = i / waveCount;
      const x = r - f * r * 2;
      const y = r * 0.15 + Math.sin(f * Math.PI + this.phase * 2) * r * 0.12 * (0.5 + pulse * 0.8);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // 色相强化层：用 lighter 叠一层本色，抵消暗背景对色彩的稀释
    ctx.globalCompositeOperation = 'lighter';
    const hueG = ctx.createRadialGradient(0, -r * 0.15, 0, 0, 0, r * 1.02);
    hueG.addColorStop(0, p.core + '3a');
    hueG.addColorStop(0.7, p.glow + '24');
    hueG.addColorStop(1, p.glow + '00');
    ctx.fillStyle = hueG;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r, -r * 1.3, r, -r * 1.3, r, 0);
    for (let i = 0; i <= waveCount; i++) {
      const f = i / waveCount;
      const x = r - f * r * 2;
      const y = r * 0.15 + Math.sin(f * Math.PI + this.phase * 2) * r * 0.12 * (0.5 + pulse * 0.8);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 伞盖高光
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.5, r * 0.35, r * 0.18, -0.3, 0, TAU);
    ctx.fill();

    // 边缘亮环
    ctx.strokeStyle = p.core + '55';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.92, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // 吸引光环
    if (this.attract > 0.1) {
      ctx.strokeStyle = p.core + Math.floor(Math.min(1, this.attract) * 180).toString(16).padStart(2, '0');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }
}
