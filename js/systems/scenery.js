// ============================================================
//  背景 / 光束 / 水面光 / 深度雾
//  性能关键：背景渐变缓存，昼夜用暗化叠加层而非每帧重建渐变
// ============================================================

import { TAU, isMobile } from '../core/config.js';
import { view, theme, dayNight, quality } from '../core/state.js';

/** 当前海域提供者（由 main 注入 zones 对象；默认中性） */
let zoneTintProvider = null;
export function setZoneProvider(z) { zoneTintProvider = z; }

function zoneShift() {
  if (!zoneTintProvider) return [0, 0, 0];
  const t = zoneTintProvider.tint;
  return Array.isArray(t) ? t : [0, 0, 0];
}

function shiftHex(hex, shift) {
  const [r, g, b] = hexToRgb(hex);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(r + shift[0])},${c(g + shift[1])},${c(b + shift[2])})`;
}

/** 对已生成的 rgb(...) 字符串再叠加偏移 */
function applyShift(rgbStr, shift) {
  if (!shift[0] && !shift[1] && !shift[2]) return rgbStr;
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(rgbStr);
  if (!m) return rgbStr;
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(+m[1] + shift[0])},${c(+m[2] + shift[1])},${c(+m[3] + shift[2])})`;
}

/* ---------------- 背景 ---------------- */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function createBackground() {
  let cache = null;
  let cacheKey = '';
  let cacheW = 0, cacheH = 0;

  function build(ctx) {
    const th = theme.current;
    const stops = th.bg;
    const g = ctx.createLinearGradient(0, 0, 0, view.H);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.3, stops[1]);
    g.addColorStop(0.65, stops[2]);
    g.addColorStop(1, stops[3]);
    cache = g;
    cacheKey = theme.name;
    cacheW = view.W;
    cacheH = view.H;
  }

  function lerpHex(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * t);
    const g2 = Math.round(A[1] + (B[1] - A[1]) * t);
    const bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return `rgb(${r},${g2},${bl})`;
  }

  // 昼夜色（正午亮 / 深夜暗），在主题基色上做整体明暗与冷暖偏移
  const DAY_TINT = { r: 26, g: 60, b: 40 };    // 白天偏暖偏亮
  const NIGHT_TINT = { r: -30, g: -55, b: -40 }; // 夜晚压暗偏冷

  return {
    id: 'bg',
    order: 0,
    draw(ctx) {
      const th = theme.current;
      // 主题或尺寸变了才重建渐变
      if (!cache || cacheKey !== theme.name || cacheW !== view.W || cacheH !== view.H) {
        build(ctx);
      }

      const sun = dayNight.sun;
      const shift = zoneShift();
      const hasShift = shift[0] || shift[1] || shift[2];
      if (dayNight.enabled && sun < 0.995) {
        // 用插值色重画（仅在昼夜运行时，每帧 4 次 addColorStop，成本可接受）
        const t = sun; // 0 夜 -> 1 昼
        const g = ctx.createLinearGradient(0, 0, 0, view.H);
        g.addColorStop(0, applyShift(lerpHex('#04182f', th.bg[0], t), shift));
        g.addColorStop(0.3, applyShift(lerpHex('#031326', th.bg[1], t), shift));
        g.addColorStop(0.65, applyShift(lerpHex('#020c1c', th.bg[2], t), shift));
        g.addColorStop(1, applyShift(lerpHex('#010610', th.bg[3], t), shift));
        ctx.fillStyle = g;
      } else if (hasShift) {
        // 海域色调：在缓存基色上叠加偏移
        const g = ctx.createLinearGradient(0, 0, 0, view.H);
        g.addColorStop(0, shiftHex(th.bg[0], shift));
        g.addColorStop(0.3, shiftHex(th.bg[1], shift));
        g.addColorStop(0.65, shiftHex(th.bg[2], shift));
        g.addColorStop(1, shiftHex(th.bg[3], shift));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = cache;
      }
      ctx.fillRect(0, 0, view.W, view.H);
    },
  };
}

/* ---------------- 丁达尔光束 ---------------- */
export function createLightRays() {
  let frameSkip = 0;
  const SKIP = isMobile ? 2 : 1;   // 移动端隔帧更新光束位置

  return {
    id: 'rays',
    order: 2,
    draw(ctx, t) {
      const count = quality.rays;
      if (count <= 0) return;
      frameSkip++;
      if (frameSkip % SKIP !== 0) return;

      const th = theme.current;
      const sun = dayNight.sun;
      const baseAlpha = th.rayAlpha * (0.25 + sun * 0.75);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < count; i++) {
        const baseX = (view.W / (count + 1)) * (i + 1);
        const sway = Math.sin(t * 0.0003 + i) * 60;
        const angleShift = (1 - sun) * 40;
        const x = baseX + sway + angleShift;
        const grad = ctx.createLinearGradient(x, 0, x + sway * 2, view.H);
        grad.addColorStop(0, `rgba(190, 240, 255, ${baseAlpha})`);
        grad.addColorStop(0.5, `rgba(120, 200, 255, ${baseAlpha * 0.45})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        const halfW = 72;
        ctx.beginPath();
        ctx.moveTo(x - halfW, 0);
        ctx.lineTo(x + halfW, 0);
        ctx.lineTo(x + sway * 2 + halfW * 1.8, view.H);
        ctx.lineTo(x + sway * 2 - halfW * 1.8, view.H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

/* ---------------- 顶部水面光 ---------------- */
export function createWaterSurface() {
  return {
    id: 'surface',
    order: 99,
    draw(ctx) {
      const th = theme.current;
      const a = th.topLight * (0.3 + dayNight.sun * 0.7);
      const g = ctx.createLinearGradient(0, 0, 0, view.H * 0.15);
      g.addColorStop(0, `rgba(120, 200, 255, ${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.W, view.H * 0.15);
    },
  };
}

/* ---------------- 深度雾（远近层次） ---------------- */
export function createDepthHaze(entities) {
  return {
    id: 'haze',
    order: 50,
    draw(ctx) {
      const th = theme.current;
      const zoneMul = zoneTintProvider ? (zoneTintProvider.haze || 1) : 1;      const a = th.haze * (0.4 + dayNight.sun * 0.6) * zoneMul;
      if (a <= 0.005) return;
      ctx.fillStyle = `rgba(20, 110, 170, ${a})`;
      ctx.fillRect(0, 0, view.W, view.H);
    },
  };
}
