// ============================================================
//  背景 / 光束 / 水面光 / 深度雾 / 岸线与海床（阶段十一）
//  性能关键：
//    - 背景渐变缓存，昼夜用暗化叠加层而非每帧重建渐变
//    - 岸线 / 海床用「逐列采样地形」画多边形，列宽 16px，与地形复杂度无关
// ============================================================

import { TAU, isMobile, clamp } from '../core/config.js';
import { view, theme, dayNight, quality, camera } from '../core/state.js';
import { WORLD, depthNorm } from './terrain.js';

/** 当前海域提供者（由 main 注入 zones 对象；默认中性） */
let zoneTintProvider = null;
export function setZoneProvider(z) { zoneTintProvider = z; }

/** 当前地形提供者（由 main 注入 terrain 代理；默认 null → 不画岸线） */
let terrainProvider = null;
export function setTerrainProvider(tp) { terrainProvider = tp; }

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

/* ---------------- 颜色工具 ---------------- */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/* ---------------- 背景 ---------------- */
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

  return {
    id: 'bg',
    order: 0,
    // 天空 / 远水，始终铺满视口（screen 空间），但色相按相机所在水深插值
    draw(ctx) {
      const th = theme.current;
      if (!cache || cacheKey !== theme.name || cacheW !== view.W || cacheH !== view.H) {
        build(ctx);
      }

      const sun = dayNight.sun;
      const shift = zoneShift();
      const hasShift = shift[0] || shift[1] || shift[2];

      // 阶段十一：相机越往下潜，背景整体越暗 —— 让「往下游」有纵深感
      const depthAtCam = terrainProvider
        ? clamp(depthNorm(terrainProvider.depthAt(camera.x + camera.vw * 0.5, camera.y + camera.vh * 0.5)), 0, 1)
        : 0;

      if (dayNight.enabled && sun < 0.995) {
        const t = sun;
        const g = ctx.createLinearGradient(0, 0, 0, view.H);
        g.addColorStop(0, applyShift(lerpHex('#04182f', th.bg[0], t), shift));
        g.addColorStop(0.3, applyShift(lerpHex('#031326', th.bg[1], t), shift));
        g.addColorStop(0.65, applyShift(lerpHex('#020c1c', th.bg[2], t), shift));
        g.addColorStop(1, applyShift(lerpHex('#010610', th.bg[3], t), shift));
        ctx.fillStyle = g;
      } else if (hasShift) {
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

      // 深水压暗：相机在水面附近为 0，到最深处最多压暗 0.5
      if (depthAtCam > 0.02) {
        ctx.fillStyle = `rgba(2, 14, 34, ${depthAtCam * 0.5})`;
        ctx.fillRect(0, 0, view.W, view.H);
      }
    },
  };
}

/* ---------------- 丁达尔光束 ---------------- */
export function createLightRays() {
  let frameSkip = 0;
  const SKIP = isMobile ? 2 : 1;

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
      // 越深光束越弱：深海里不该有阳光柱
      const depthAtCam = terrainProvider
        ? clamp(depthNorm(terrainProvider.depthAt(camera.x + camera.vw * 0.5, camera.y + camera.vh * 0.5)), 0, 1)
        : 0;
      const baseAlpha = th.rayAlpha * (0.25 + sun * 0.75) * (1 - depthAtCam * 0.85);
      if (baseAlpha <= 0.004) return;

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
    // 水面在「世界 y = shoreLine 附近」而不是屏幕顶端，
    // 所以它的屏幕高度由相机位置决定；吸在屏幕顶部只是为了让亮部跟随镜头。
    draw(ctx) {
      const th = theme.current;
      const a = th.topLight * (0.3 + dayNight.sun * 0.7) * (1 - (camera.y / WORLD.h) * 0.55);
      if (a <= 0.004) return;
      const h = view.H * 0.15;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(120, 200, 255, ${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.W, h);
    },
  };
}

/* ---------------- 深度雾（远近层次） ---------------- */
export function createDepthHaze() {
  return {
    id: 'haze',
    order: 50,
    draw(ctx) {
      const th = theme.current;
      const zoneMul = zoneTintProvider ? (zoneTintProvider.haze || 1) : 1;
      const depthAtCam = terrainProvider
        ? clamp(depthNorm(terrainProvider.depthAt(camera.x + camera.vw * 0.5, camera.y + camera.vh * 0.5)), 0, 1)
        : 0;
      // 越深雾越浓：这是「深海」的观感来源
      const a = th.haze * (0.4 + dayNight.sun * 0.6) * zoneMul * (1 + depthAtCam * 1.1);
      if (a <= 0.005) return;
      ctx.fillStyle = `rgba(20, 110, 170, ${a})`;
      ctx.fillRect(0, 0, view.W, view.H);
    },
  };
}

/* ---------------- 岸线与海床（阶段十一核心视觉） ---------------- */
// 用「逐列采样」把地形画成多边形。列宽固定 16 屏幕像素 →
// 每帧最多 view.W/16 ≈ 80~120 次 depthAt 调用，与地形复杂度无关。
const COL_STEP = 16;

export function createTerrainLayer() {
  return {
    id: 'terrain',
    order: 0.5, // 在背景之上、光束之下
    space: 'screen', // 自己按列换算屏幕坐标，比整体 scale 更省
    draw(ctx, t) {
      const tp = terrainProvider;
      if (!tp) return;
      const scale = camera.scale || 1;
      const cols = Math.ceil(view.W / COL_STEP) + 1;

      // 每列的世界 x 与屏幕 x
      const wxs = new Float32Array(cols);
      const sxs = new Float32Array(cols);
      for (let i = 0; i < cols; i++) {
        const sx = i * COL_STEP;
        sxs[i] = sx;
        wxs[i] = sx / scale + camera.x;
      }

      const sunF = 0.35 + dayNight.sun * 0.65;
      const th = theme.current;

      // ---------- 1. 海床（水下的浅色底，越深越暗）----------
      ctx.save();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < cols; i++) {
        const wx = wxs[i];
        // 该列水深 → 海床在世界里的 y（深度越大越靠下）
        // 采样点取相机可视区的垂直中心，同一帧里所有列共用一个采样高度，
        // 否则海床会跟着相机上下抖动。
        const d = tp.depthAt(wx, camera.y + camera.vh * 0.5);
        // 海床纵深系数 0.85、封顶 900：这两个数是「水深 → 屏幕纵深」的
        // 观感压缩比。封顶值取 MAX_DEPTH 的约 0.64，保证海床曲线能铺满
        // 可见高度（桌面 16:9 约 1130）而不会在画面中间就抹平。
        const bedY = tp.shoreLineAt(wx) + Math.min(d, 900) * 0.85;
        const sy = (bedY - camera.y) * scale;
        if (!started) { ctx.moveTo(sxs[i], sy); started = true; }
        else ctx.lineTo(sxs[i], sy);
      }
      ctx.lineTo(view.W, view.H);
      ctx.lineTo(0, view.H);
      ctx.closePath();
      const bedGrad = ctx.createLinearGradient(0, view.H * 0.35, 0, view.H);
      bedGrad.addColorStop(0, `rgba(40, 92, 130, ${0.5 * sunF})`);
      bedGrad.addColorStop(0.5, `rgba(20, 56, 88, ${0.78 * sunF})`);
      bedGrad.addColorStop(1, `rgba(8, 26, 46, ${0.92 * sunF})`);
      ctx.fillStyle = bedGrad;
      ctx.fill();
      ctx.restore();

      // ---------- 2. 岸上陆地 + 沙滩 ----------
      ctx.save();
      ctx.beginPath();
      let landStarted = false;
      // 记录陆地多边形的实际纵向跨度（屏幕坐标）。
      // 渐变必须贴着这段真实范围铺，不能写死成 view.H * 0.5 ——
      // 那样陆地一旦超过半屏，下面的部分就全落在最后一个色标上，
      // 变成一块毫无层次的纯色矩形（与原水线的沙色割裂，非常突兀）。
      let landTop = Infinity;
      let landBot = -Infinity;
      for (let i = 0; i < cols; i++) {
        const wx = wxs[i];
        const sl = tp.shoreLineAt(wx);
        const sy = (sl - camera.y) * scale;
        if (sy < landTop) landTop = sy;
        if (sy > landBot) landBot = sy;
        if (!landStarted) { ctx.moveTo(sxs[i], sy); landStarted = true; }
        else ctx.lineTo(sxs[i], sy);
      }
      // 收口到屏幕顶部
      ctx.lineTo(view.W, -view.H);
      ctx.lineTo(0, -view.H);
      ctx.closePath();
      // 陆地是「从屏幕顶部一路铺到水线」的一整块。
      // 渐变端点必须贴合它的真实纵向范围：
      //   gradBot = 水线所在位置（多边形最低点），
      //   gradTop = 屏幕顶部（-view.H 是为了在相机深入内陆时也够远）。
      // 之前写死 view.H * 0.5，导致陆地超过半屏后全落在最后一个色标上，
      // 变成一块没有层次的纯色矩形。
      const gradTop = Math.min(landTop, 0) - view.H;
      const gradBot = Math.max(landBot, 1);
      const landGrad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
      // 色标语义：0 = 最内陆（暗），1 = 紧贴水线（亮）。
      // 暖沙色集中在最后 15% 的窄带里 —— 现实中也是靠水的沙最亮、
      // 越往内陆越被植被和阴影压暗。若把暖色点铺到 0.5 以上，
      // 整片陆地会糊成均匀的沙黄，正是之前那种"突兀矩形"的观感。
      const warm = theme.name === 'shallow';
      landGrad.addColorStop(0, warm ? 'rgba(58, 62, 58, 1)' : 'rgba(28, 34, 40, 1)');
      landGrad.addColorStop(0.45, warm ? 'rgba(92, 90, 76, 1)' : 'rgba(58, 62, 64, 1)');
      landGrad.addColorStop(0.85, warm ? 'rgba(158, 144, 112, 1)' : 'rgba(116, 112, 100, 1)');
      landGrad.addColorStop(1, warm ? 'rgba(214, 196, 152, 1)' : 'rgba(160, 154, 136, 1)');
      ctx.fillStyle = landGrad;
      ctx.fill();
      ctx.restore();

      // ---------- 3. 水线（白色浪花细线）----------
      ctx.save();
      ctx.strokeStyle = `rgba(230, 248, 255, ${0.5 * sunF})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const wx = wxs[i];
        // 浪花随时间起伏，让水线是「活的」
        const wave = Math.sin(wx * 0.02 + t * 0.0016) * 3 + Math.sin(wx * 0.006 - t * 0.0011) * 4;
        const sy = (tp.shoreLineAt(wx) - camera.y) * scale + wave;
        if (i === 0) ctx.moveTo(sxs[i], sy);
        else ctx.lineTo(sxs[i], sy);
      }
      ctx.stroke();
      ctx.restore();
    },
  };
}
