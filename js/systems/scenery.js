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

      // ---------- 1.5 天空（水线以上的空气） ----------
      //
      // 【11B 修复】水线以上本来是 bg 的暗水色，被当成「陆地/远景」，天地不分。
      //   这里在水线以上铺一段真正的天空渐变（白天亮蓝、夜晚深蓝，随昼夜插值），
      //   让「天空 → 陆地 → 海水」三段有明确色相分界。
      //   多边形上沿一直收到屏幕外，保证相机深入内陆时天空仍然铺满。
      //   只在有水线的地形画；水线在世界里的 y 由 shoreLineAt 给出。
      ctx.save();
      ctx.beginPath();
      let s0 = true;
      for (let i = 0; i < cols; i++) {
        const sy = (tp.shoreLineAt(wxs[i]) - camera.y) * scale;
        if (s0) { ctx.moveTo(sxs[i], sy); s0 = false; }
        else ctx.lineTo(sxs[i], sy);
      }
      ctx.lineTo(view.W, -view.H);
      ctx.lineTo(0, -view.H);
      ctx.closePath();
      const sun2 = dayNight.sun;
      // 白天：淡蓝天空；夜晚：深靛蓝。用主题 tint 微调色相靠拢整体风格。
      const skyTop = `rgba(${Math.round(60 + 120 * sun2)}, ${Math.round(150 + 90 * sun2)}, ${Math.round(210 + 40 * sun2)}, 1)`;
      const skyBot = `rgba(${Math.round(40 + 70 * sun2)}, ${Math.round(110 + 60 * sun2)}, ${Math.round(170 + 30 * sun2)}, 1)`;
      const skyGrad = ctx.createLinearGradient(0, -view.H, 0, 0);
      skyGrad.addColorStop(0, skyTop);
      skyGrad.addColorStop(1, skyBot);
      ctx.fillStyle = skyGrad;
      ctx.fill();
      ctx.restore();

      // ---------- 2. 岸上陆地 + 沙滩 ----------
      //
      // 【11B 修复】陆地只画「水线以上的一段陆地带」，不再从屏幕顶一路铺到水线。
      //   旧实现把整个上方全填成陆地渐变，于是天上和水下是两种颜色，但
      //   水线以上那大片区域被当成「陆地」而非「天空」，视觉上天地不分；
      //   同时 life 元素画在最上层，看起来就像悬浮贴纸，没有站在岸上的感觉。
      //   现在：陆地收在水线附近一条带内，带以上露出 bg 的天空/远水渐变，
      //   于是「天空 → 陆地带 → 海水」三段清晰。
      //
      //   陆地带厚度用「水线以上抬升到内陆」的视觉高度：取 DUNE 常量，
      //   与地形无关（地形只决定水线在哪，不决定画面留多少天）。
      // 陆地带厚度（世界单位）。必须同时容纳：
      //   ① 元素脚底深度 —— pushAshore 的 targetDepth，最深约 -165（灯塔）
      //   ② 元素自身高度 —— 灯塔/棕榈约 80
      //   ③ 上方留一点陆地余量，别让元素顶到天空
      // 取 300：165 + 80 + 余量 55。上界受「初始可见纵深 ≈ 290」约束，
      // 天空因此只在水线以上很小的范围里，符合「海为主、岸点缀」的定位。
      const DUNE = 300;              // 水线以上陆地带的屏幕厚度（世界单位）
      const warm = theme.name === 'shallow';
      ctx.save();
      ctx.beginPath();
      // 上沿：水线往内陆方向抬 DUNE（屏幕 y 更小），并带一点沙丘起伏
      let e0 = true;
      let bandTop = Infinity;
      let bandBot = -Infinity;
      for (let i = 0; i < cols; i++) {
        const wx = wxs[i];
        const sl = tp.shoreLineAt(wx);
        // 上沿做一点 fbm 化的起伏，形成沙丘轮廓而不是一条直线
        const dune = Math.sin(wx * 0.0009 + 1.7) * 26 + Math.sin(wx * 0.0031) * 12;
        const sy = (sl - camera.y) * scale - DUNE - dune;
        if (sy < bandTop) bandTop = sy;
        if (e0) { ctx.moveTo(sxs[i], sy); e0 = false; } else ctx.lineTo(sxs[i], sy);
      }
      // 下沿：沿水线回来，与上沿闭合成一条带
      for (let i = cols - 1; i >= 0; i--) {
        const sy = (tp.shoreLineAt(wxs[i]) - camera.y) * scale;
        if (sy > bandBot) bandBot = sy;
        ctx.lineTo(sxs[i], sy);
      }
      ctx.closePath();
      // 渐变贴着这条带的真实纵向范围铺：
      //   0 = 上沿（内陆侧，偏暗）→ 1 = 下沿（贴水侧，亮沙）。
      // 用实测的 bandTop/bandBot 而不是写死值，相机无论如何移动都贴得住。
      const gradTop = Math.min(bandTop, bandBot) - 8;
      const gradBot = Math.max(bandBot, gradTop + 1);
      const landGrad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
      landGrad.addColorStop(0, warm ? 'rgba(86, 88, 78, 1)' : 'rgba(44, 50, 56, 1)');
      landGrad.addColorStop(0.55, warm ? 'rgba(150, 140, 110, 1)' : 'rgba(104, 102, 92, 1)');
      landGrad.addColorStop(1, warm ? 'rgba(226, 208, 164, 1)' : 'rgba(176, 170, 150, 1)');
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
