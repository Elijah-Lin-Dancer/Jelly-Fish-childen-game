// ============================================================
//  伴随水母（阶段十）
//  - 玩家身份标识：长期跟随光标，区别于 Bogyó（隐藏纪念猫）
//  - 5 变体，参照 MC 美西螈（常见×4 + 1 稀有）
//      lucy 樱粉 / wild 焦糖棕 / gold 流金 / cyan 冰蓝 / rare 幻紫(稀有)
//  - 不参与生态 / 繁育 / 图鉴；不被大鱼叼走
//  参考：https://minecraft.wiki/w/Axolotl
// ============================================================

import { TAU, rand, clamp } from '../core/config.js';
import {
  glow, organicVolume, specular, rimLight, depthLight,
  signals, makeCache, rgba, shade, LIGHT,
} from '../render/volume.js';

/** 变体定义：配色 + 花纹 */
export const COMPANION_VARIANTS = [
  {
    id: 'lucy', label: 'companion.lucy', pattern: 'spots',
    core: '#F7B7CE', glow: '#FF7FB6', tent: '#FFD3E6', accent: '#FFFFFF',
  },
  {
    id: 'wild', label: 'companion.wild', pattern: 'plain',
    core: '#C98A4B', glow: '#B06A2E', tent: '#E0AC72', accent: '#FBE6C8',
  },
  {
    id: 'gold', label: 'companion.gold', pattern: 'stripes',
    core: '#F2C14E', glow: '#E8A21B', tent: '#FFDC8A', accent: '#FFF3C4',
  },
  {
    id: 'cyan', label: 'companion.cyan', pattern: 'rings',
    core: '#7FD8E8', glow: '#2FB6D8', tent: '#AEEBF5', accent: '#E6FFFF',
  },
  {
    id: 'rare', label: 'companion.rare', pattern: 'star', rare: true,
    core: '#B98CFF', glow: '#8A4DFF', tent: '#D7BEFF', accent: '#F2E6FF',
  },
];

export function companionVariant(id) {
  return COMPANION_VARIANTS.find((v) => v.id === id) || COMPANION_VARIANTS[0];
}

/** '#RRGGBB' -> 'R,G,B'（volume 库只认三元组） */
function hexToTriple(hex) {
  const h = hex.replace('#', '');
  return parseInt(h.slice(0, 2), 16) + ',' +
         parseInt(h.slice(2, 4), 16) + ',' +
         parseInt(h.slice(4, 6), 16);
}

export class Companion {
  constructor(x, y, { variant = 'lucy' } = {}) {
    this.x = x ?? 0;
    this.y = y ?? 0;
    this.vx = 0;
    this.vy = 0;
    this.r = 22;
    this.scale = 0.9;
    this.variant = companionVariant(variant);
    this.coreRgb = hexToTriple(this.variant.core);
    this.glowRgb = hexToTriple(this.variant.glow);
    this.tentRgb = hexToTriple(this.variant.tent);
    this.accentRgb = hexToTriple(this.variant.accent);
    this._cache = makeCache();
    this.isCompanion = true;   // 供各系统识别：不参与繁育 / 不被叼走
    this.age = 0;
    this._pulse = rand(0, TAU);
    this._bob = rand(0, TAU);
  }

  /** 缓动跟随目标（光标 / 触摸点），带漂移与距离感 */
  update(dt, target) {
    this.age += dt;
    this._pulse += dt * 0.003;
    this._bob += dt * 0.0016;

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    // 保持一段舒适距离，太近则回退，太远则追
    const rest = 70;
    const pull = clamp((dist - rest) / 260, -1, 1);
    const k = 0.0016 * (dt / 16.667);
    this.vx += (dx / dist) * pull * k * 60;
    this.vy += (dy / dist) * pull * k * 60;

    // 悬浮浮力 + 阻尼
    this.vy += Math.sin(this._bob) * 0.02 * (dt / 16.667);
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.x += this.vx * (dt / 16.667);
    this.y += this.vy * (dt / 16.667);
  }

  draw(ctx) {
    const v = this.variant;
    const pulse = 1 + Math.sin(this._pulse) * 0.06;
    const r = this.r * this.scale * pulse;

    // 共享深度协议：与主角水母同一套光照（浅水保色 / 深水偏水色）
    const dn = signals.depthNorm(this.x, this.y);
    const L = depthLight(dn);

    ctx.save();
    ctx.translate(this.x, this.y);

    // 柔光晕 —— 共享 glow()（外径与旧版一致 ≈ r*2.4）
    glow(ctx, 0, 0, r, this.glowRgb, {
      glow: 0.55,
      scale: 2.4 / (0.7 + 0.55 * 0.45),
      cache: this._cache,
    });

    // 触须 —— 沿 LIGHT 方向的渐变（旧版平涂）
    ctx.lineCap = 'round';
    const tgKey = 'ctg|' + Math.round(r) + '|' + this.tentRgb;
    let tentGrad = this._cache.get(tgKey);
    if (!tentGrad) {
      tentGrad = ctx.createLinearGradient(
        LIGHT.x * r * 1.4, LIGHT.y * r * 1.4,
        -LIGHT.x * r * 1.4, -LIGHT.y * r * 1.4
      );
      tentGrad.addColorStop(0, rgba(shade(this.tentRgb, 0.3), 0.85));
      tentGrad.addColorStop(1, rgba(shade(this.tentRgb, -0.3), 0.55));
      if (this._cache.size > 60) this._cache.clear();
      this._cache.set(tgKey, tentGrad);
    }
    ctx.strokeStyle = tentGrad;
    ctx.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) {
      const x = i * (r * 0.34);
      const wob = Math.sin(this.age * 0.004 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(x, r * 0.5);
      ctx.quadraticCurveTo(x + wob, r * 1.4, x + wob * 1.6, r * 2.1);
      ctx.stroke();
    }

    // 伞盖 —— organicVolume（受光方向对齐 LIGHT，与主角同款软体）
    organicVolume(ctx, 0, 0, r, this.coreRgb, {
      waves: 5,
      waveAmp: 0.07,
      phase: this._pulse * 2,
      depth: dn,
      light: L.light,
      cache: this._cache,
    });

    // 伞盖边沿 —— 共享 rimLight（左上受光弧）
    rimLight(ctx, 0, 0, r, this.accentRgb, {
      from: Math.PI * 1.1, to: Math.PI * 1.9,
      cy: -0.18, rk: 0.94, width: 1.2, alpha: 0.5,
    });

    // 花纹（身份标识，不动）
    this._drawPattern(ctx, v, r);

    // 高光 —— 共享 specular
    specular(ctx, -r * 0.32, -r * 0.28, r * 0.22, r * 0.14, { rot: -0.5, alpha: 0.5 });

    ctx.restore();
  }

  _drawPattern(ctx, v, r) {
    ctx.fillStyle = hexA(v.accent, 0.75);
    switch (v.pattern) {
      case 'spots': {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI - Math.PI * 0.9;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.4 - r * 0.1, r * 0.08, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'stripes': {
        ctx.strokeStyle = hexA(v.accent, 0.7);
        ctx.lineWidth = r * 0.09;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.42, -r * 0.5);
          ctx.lineTo(i * r * 0.42, r * 0.15);
          ctx.stroke();
        }
        break;
      }
      case 'rings': {
        ctx.strokeStyle = hexA(v.accent, 0.7);
        ctx.lineWidth = r * 0.08;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.32, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.58, Math.PI, 0);
        ctx.stroke();
        break;
      }
      case 'star': {
        const cx = 0, cy = -r * 0.14, R = r * 0.3;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const outer = (i / 5) * TAU - Math.PI / 2;
          const inner = outer + TAU / 10;
          ctx.lineTo(cx + Math.cos(outer) * R, cy + Math.sin(outer) * R);
          ctx.lineTo(cx + Math.cos(inner) * R * 0.42, cy + Math.sin(inner) * R * 0.42);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      default: break; // plain：素
    }
  }
}

/** #RRGGBB -> rgba(...) */
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
