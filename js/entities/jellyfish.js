// ============================================================
//  水母 — 主角
//  含：呼吸脉冲 / 指针吸引 / 受惊回弹 / 成长进化 / 入夜增亮
// ============================================================

import { rand, TAU, damp, clamp } from '../core/config.js';
import { pointer, view, theme, dayNight } from '../core/state.js';
import { randomTraits, normalizeTraits } from '../gameplay/genes.js';

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
    this.rare = opts.rare === true;   // 每日稀有客

    // 阶段六：性状基因（size / glow / speed / tentacles）+ 繁育冷却
    this.traits = opts.genes ? normalizeTraits(opts.genes) : randomTraits();
    this.hybrid = false;
    this.lastBredAt = 0;
    this.bornAt = 0;

    // 阶段八 8B：进食成长上限 / 缺氧 / 休眠
    this.growthCap = opts.growthCap || 1.6;   // scale 可成长到的上限（冒险模式更高）
    this.fed = 0;                            // 累计进食量（0..）
    this.feedFlash = 0;                      // 进食时的微光
    this.oxygen = 1;                         // 0..1；冒险模式下随深度变化
    this.dormant = false;                    // 缺氧归零 → 休眠（缓慢沉底、停止繁育）
    this.isMemory = false;                   // 隐藏纪念水母标记（由 Bogyo 设置）

    // 体型基因影响初始半径（±15%）
    const sizeMod = 0.85 + this.traits.size * 0.3;
    this.r *= sizeMod;
    this.baseR = this.r;

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

    // 从存档恢复（成长 / 变异 / 互动次数）
    if (opts.restore) this._applyRestore(opts.restore);
  }

  /** 应用存档数据 */
  _applyRestore(r) {
    if (r.g && Array.isArray(r.g)) {
      // 基因数组顺序：[size, glow, speed, tentacles]
      const [sz, gl, sp, tn] = r.g;
      this.traits = normalizeTraits({ size: sz, glow: gl, speed: sp, tentacles: tn });
      const sizeMod = 0.85 + this.traits.size * 0.3;
      this.r = this.baseR * sizeMod;
      this.baseR = this.r;
      this._buildTentacles();
    }
    if (typeof r.scale === 'number') this.scale = clamp(r.scale, 0.4, 1.6);
    if (typeof r.age === 'number') this.age = Math.max(0, r.age);
    if (typeof r.interactions === 'number') this.interactions = Math.max(0, r.interactions | 0);
    if (r.rare) this.rare = true;
    if (r.mutated) {
      this.mutated = true;
      // 变异个体：多两根触须，与 mutate() 表现一致
      this.tentacles.push(
        { len: rand(this.r * 1.2, this.r * 2.6), phase: rand(0, TAU), freq: rand(0.02, 0.05), amp: rand(4, 12), width: rand(1.2, 2.6) },
        { len: rand(this.r * 1.2, this.r * 2.6), phase: rand(0, TAU), freq: rand(0.02, 0.05), amp: rand(4, 12), width: rand(1.2, 2.6) }
      );
    }
    this._glowGrad = null;
    this._glowKey = '';
  }

  _buildTentacles() {
    this.tentacles.length = 0;
    // 触须基因：0..1 映射到 6..11 根
    const tn = this.traits ? this.traits.tentacles : 0.5;
    const n = Math.round(6 + tn * 5);
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

  /**
   * 阶段八 8B：进食（冒险模式）。朝 growthCap 缓慢长大。
   * 返回是否"刚跨过成长阈值"（用于触发形态反馈）。
   */
  feed(amount = 1) {
    if (this.dormant) return false;
    const before = this.scale;
    this.fed += amount;
    this.feedFlash = Math.min(1, this.feedFlash + 0.25);
    // 每进食累计到一定量，scale 上限抬升一点点
    if (this.scale < this.growthCap) {
      this.scale = Math.min(this.growthCap, this.scale + 0.00035 * amount);
    }
    return this.scale > before;
  }

  /**
   * 阶段八 8B：缺氧/复氧（冒险模式）。rate > 0 缺氧，< 0 复氧。
   * 归零进入休眠；回到安全区自动苏醒。
   */
  oxygenate(rate, dtScale) {
    this.oxygen = clamp(this.oxygen + rate * dtScale, 0, 1);
    if (this.oxygen <= 0.001 && !this.dormant) this.dormant = true;
    else if (this.oxygen > 0.25 && this.dormant) this.dormant = false;
  }

  /** 是否成年（供繁育使用，休眠个体不繁育） */
  get canBreed() { return !this.egg && !this.dormant && this.scale >= 0.99 && this.age > 1500; }

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
    if (this.feedFlash > 0) this.feedFlash = Math.max(0, this.feedFlash - dt / 700);

    // 阶段八 8B：休眠个体（缺氧）缓慢沉底、几乎不动、不再被指针吸引
    if (this.dormant) {
      this.vy += 0.02 * dtScale;              // 缓慢下沉
      this.vx *= Math.pow(0.94, dtScale);
      this.vy *= Math.pow(0.94, dtScale);
      this.x += this.vx * dtScale;
      this.y += this.vy * dtScale;
      const rr0 = this.r * this.scale;
      if (this.y > view.H - rr0) { this.y = view.H - rr0; this.vy = 0; }
      this.pulse = (Math.sin(this.phase) + 1) * 0.5;
      this.attract *= Math.pow(0.85, dtScale);
      return true;
    }

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
    // 辉光基因：0.6x..1.5x
    const glowGene = 0.6 + (this.traits ? this.traits.glow : 0.5) * 0.9;
    // 休眠个体整体变暗（缺氧提示）
    const dorm = this.dormant ? 0.45 : 1;
    const boost = (th.glowBoost * nightGlow + this.flash * 0.8 + this.feedFlash * 0.4) * (0.6 + crowd * 0.4) * glowGene * dorm;
    // 杂交个体：柔和的青蓝附加光晕，作为"混血"标识
    if (this.hybrid) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(180, 235, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.15, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

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
      const baseX = (i / Math.max(1, nT - 1) - 0.5) * r * 1.4;
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

    // 每日稀有客：金色缓旋光环 + 星点
    if (this.rare) {
      ctx.globalCompositeOperation = 'lighter';
      const spin = this.age * 0.001;
      ctx.strokeStyle = 'rgba(255, 216, 77, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 9]);
      ctx.lineDashOffset = -spin * 40;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.85, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 3; i++) {
        const a = spin * 2 + (i / 3) * TAU;
        ctx.fillStyle = 'rgba(255, 240, 170, 0.9)';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.85, Math.sin(a) * r * 1.85, 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }
}
