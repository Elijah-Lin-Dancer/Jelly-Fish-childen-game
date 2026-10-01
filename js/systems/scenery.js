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
/* ---------------- 光束 ---------------- */

/**
 * 沿屏幕逐列求「水面」的屏幕 y —— 光柱的上端。
 *   · shore / slope：水面 = shoreLineAt(x)。
 *   · island       ：该列若有岛体，光柱应止于岛体上沿（水里才是光路）；
 *                    无岛体（开阔海面）取岛心高度作为参考水面。
 * 注意：这只决定光柱的**起点**。岛体对光柱的遮挡由 rayWaterClip() 负责。
 */
const RAY_SURF_STEP = 16;
function waterSurfaceAt(wx) {
  const tp = terrainProvider;
  if (!tp) return null;
  if (tp.type === 'island') {
    const pr = tp.islandProfileAt(wx);
    return pr ? pr.top : tp.params.islY;
  }
  return tp.shoreLineAt(wx);
}

/**
 * 把绘制区域裁剪到「水体」：全屏减去陆地/岛体。
 *   光柱是水中的散射，陆地上不该有 —— 尤其 island：只把起点设到岛顶
 *   是不够的，光柱会继续向下穿过整个岛体（实测岛上有竖纹）。
 *   所以必须真正 clip：用 even-odd 规则在全屏矩形里挖掉岛体轮廓。
 * shore / slope 的陆地是屏幕顶部的一条横带，这里也一并挖掉。
 */
function rayWaterClip(ctx) {
  const tp = terrainProvider;
  if (!tp) return false;
  const scale = camera.scale || 1;

  ctx.beginPath();
  // 外圈：整个屏幕
  ctx.rect(0, 0, view.W, view.H);

  if (tp.type === 'island') {
    // 挖掉岛体轮廓
    const ol = tp.islandOutline(160);
    for (let k = 0; k < ol.length; k++) {
      const px = (ol[k].x - camera.x) * scale;
      const py = (ol[k].y - camera.y) * scale;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    // 挖掉水线以上的陆地带（从屏幕顶到水线）
    const STEP = RAY_SURF_STEP;
    const n = Math.ceil(view.W / STEP) + 1;
    ctx.moveTo(0, -2);
    for (let i = 0; i < n; i++) {
      const sx = Math.min(i * STEP, view.W);
      const wy = tp.shoreLineAt(sx / scale + camera.x);
      ctx.lineTo(sx, (wy - camera.y) * scale);
    }
    ctx.lineTo(view.W, -2);
    ctx.closePath();
  }
  // even-odd：外圈 - 挖洞 = 水体
  ctx.clip('evenodd');
  return true;
}

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

      // 【期二】裁剪到水体：全屏 - 陆地/岛体。光只在水中散射，
      // 之前光柱是全屏竖条，会直接打在天空、沙滩和岛体上。
      rayWaterClip(ctx);

      // 光柱顶端贴水面：逐列取水面 y（clip 已保证不会画到陆地，
      // 这里只是让上端不那么"齐刷刷地截在屏幕顶"）。
      const scale = camera.scale || 1;
      const surfCols = Math.ceil(view.W / RAY_SURF_STEP) + 1;
      const surfYs = new Float32Array(surfCols);
      for (let i = 0; i < surfCols; i++) {
        const sx = Math.min(i * RAY_SURF_STEP, view.W);
        const wy = waterSurfaceAt(sx / scale + camera.x);
        // 水面之上留一点余量，避免光柱硬切在水线上
        surfYs[i] = (wy === null || !Number.isFinite(wy)) ? 0 : (wy - camera.y) * scale - 6;
      }

      for (let i = 0; i < count; i++) {
        const baseX = (view.W / (count + 1)) * (i + 1);
        const sway = Math.sin(t * 0.0003 + i) * 60;
        const angleShift = (1 - sun) * 40;
        const x = baseX + sway + angleShift;
        const halfW = 72;
        const botSpread = halfW * 1.8;

        // 光柱：上沿取左右边界处的水面 y（该宽度内水面足够平），下沿到屏幕底
        const xL = x - halfW, xR = x + halfW;
        const idxL = Math.max(0, Math.min(surfCols - 1, Math.round(xL / RAY_SURF_STEP)));
        const idxR = Math.max(0, Math.min(surfCols - 1, Math.round(xR / RAY_SURF_STEP)));
        const yL = surfYs[idxL], yR = surfYs[idxR];
        ctx.beginPath();
        ctx.moveTo(xL, yL);
        ctx.lineTo(xR, yR);
        ctx.lineTo(x + sway * 2 + botSpread, view.H);
        ctx.lineTo(x + sway * 2 - botSpread, view.H);
        ctx.closePath();

        const gTop = Math.min(yL, yR);
        const grad = ctx.createLinearGradient(x, gTop, x + sway * 2, view.H);
        grad.addColorStop(0, `rgba(190, 240, 255, ${baseAlpha})`);
        grad.addColorStop(0.5, `rgba(120, 200, 255, ${baseAlpha * 0.45})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
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

/* ---------------- 岸线与海床（阶段十一核心视觉 + 期二体积化） ---------------- */
// 用「逐列采样」把地形画成多边形。列宽固定 16 屏幕像素 →
// 每帧最多 view.W/16 ≈ 80~120 次采样，与地形复杂度无关。
//
// 【期二改动】三地形统一走「海床 → 天空 → 远景山脊 → 近景陆地」的分层
// 体积渲染，差异只在「陆地边沿怎么算」：
//   shore / slope：一维剖面，上沿 = landRearAt(x)，下沿 = shoreLineAt(x)。
//   island       ：二维环形 —— 陆体用 islandOutline(θ) 闭合轮廓填充，
//                  边沿元素沿轮廓的远岸段 / 近岸段走。
// 色值统一遵守 volume.js 的受光规则：高处/远岸冷暗，临水/受光处暖亮。
const COL_STEP = 16;

// 远景山脊纵深（世界单位）：决定"山在后面多远"
const RIDGE = 260;

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
      const sun2 = dayNight.sun;
      const warm = theme.name === 'shallow';

      // ---------- 1. 海床（水下的浅色底，越深越暗）----------
      // 海床基准 = "该处水面所在的 world y"：
      //   shore / slope：就是 shoreLineAt(x)（一条随 x 起伏的水线）。
      //   island       ：岛心高度 islY —— 岛外的水线本来就近似水平，
      //                  若用 shoreLineAt 会在岛两侧拉出一条横贯屏幕的
      //                  假海床棱线。用 islY 作为基准，深度由 depthAt 决定，
      //                  海床就从岛缘向外自然下沉。
      const islMode = tp.type === 'island';
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
        const base = islMode ? tp.params.islY : tp.shoreLineAt(wx);
        const bedY = base + Math.min(d, 900) * 0.85;
        const sy = (bedY - camera.y) * scale;
        if (!started) { ctx.moveTo(sxs[i], sy); started = true; }
        else ctx.lineTo(sxs[i], sy);
      }
      ctx.lineTo(view.W, view.H);
      ctx.lineTo(0, view.H);
      ctx.closePath();
      // 海床体积化：顶部（近水面）受光偏亮，往下迅速压暗 —— 与 volume.js 的
      // earthVolume 同一套"顶亮底暗"规则，保证海床和陆地是同一个光源。
      const bedGrad = ctx.createLinearGradient(0, view.H * 0.35, 0, view.H);
      bedGrad.addColorStop(0, `rgba(40, 92, 130, ${0.5 * sunF})`);
      bedGrad.addColorStop(0.5, `rgba(20, 56, 88, ${0.78 * sunF})`);
      bedGrad.addColorStop(1, `rgba(8, 26, 46, ${0.92 * sunF})`);
      ctx.fillStyle = bedGrad;
      ctx.fill();
      ctx.restore();

      // ---------- 2. 天空 / 远景山脊 / 近景陆地（体积化）----------
      //
      // 【陆地区域模型】陆地从「水线函数」重构为「有实体纵深的区域」，
      //   分层（从上到下 = 从远到近）：
      //     天空 → 远景山脊 → 近景陆地（高地 + 沙滩）→ 水线 → 海
      //
      //   两种地形的"边沿"来源不同：
      //     shore / slope：一维剖面 —— 上沿 = landRearAt(x)，下沿 = shoreLineAt(x)，
      //                    横贯屏幕，一条线走到底。
      //     island       ：环形 —— 陆体用 islandOutline(θ) 闭合轮廓填充；
      //                    边沿元素（水线 / 湿沙 / 受光边）也沿轮廓分"远岸段 /
      //                    近岸段"走。不用逐列 profile：岛心附近的列会同时
      //                    包含远岸和近岸，逐列的 bot 落在岛体中部，会把水线
      //                    画进岛里面。
      const isIsland = tp.type === 'island';
      // 岛的地色渐变 / 轮廓要用到岛心与半径的屏幕坐标
      const islCxW = isIsland ? tp.params.islX : 0;
      const islCyW = isIsland ? tp.params.islY : 0;

      let upAt = null, loAt = null;
      if (!isIsland) {
        upAt = (i) => tp.landRearAt(wxs[i]);
        loAt = (i) => tp.shoreLineAt(wxs[i]);
      }

      // 陆地参考上沿（世界 y）：山脊/天空对齐用。取整屏陆地的最高点。
      const landTopWorld = (function () {
        if (isIsland) {
          // 岛用轮廓的最小 y
          let t = Infinity;
          const ol = tp.islandOutline(64);
          for (let k = 0; k < ol.length; k++) if (ol[k].y < t) t = ol[k].y;
          return t === Infinity ? islCyW : t;
        }
        let t = Infinity;
        for (let i = 0; i < cols; i++) {
          const u = upAt(i);
          if (u !== null && u < t) t = u;
        }
        return t === Infinity ? tp.shoreLineAt(wxs[0]) : t;
      })();

      // 连续段表：shore/slope 是一整段（岛屿不适用）。
      const segs = [];
      if (!isIsland) segs.push([0, cols - 1]);

      // 岛的屏幕几何：轮廓点表 + 岛心/半径（2c/2d/3/4 共用，只算一次）
      const islPx = (islCxW - camera.x) * scale;
      const islPy = (islCyW - camera.y) * scale;
      const islRpx = isIsland ? Math.max(24, tp.params.islR * scale) : 0;
      let outlineS = null;
      if (isIsland) {
        const ol = tp.islandOutline(160);
        outlineS = new Array(ol.length);
        for (let k = 0; k < ol.length; k++) {
          outlineS[k] = {
            x: (ol[k].x - camera.x) * scale,
            y: (ol[k].y - camera.y) * scale,
            wy: ol[k].y,
          };
        }
      }

      // —— 2a. 天空（铺到远景山脊上沿）——
      ctx.save();
      ctx.beginPath();
      let k0 = true;
      for (let i = 0; i < cols; i++) {
        const sy = (landTopWorld - RIDGE - camera.y) * scale;
        if (k0) { ctx.moveTo(sxs[i], sy); k0 = false; } else ctx.lineTo(sxs[i], sy);
      }
      ctx.lineTo(view.W, -view.H);
      ctx.lineTo(0, -view.H);
      ctx.closePath();
      const skyTop = `rgba(${Math.round(60 + 120 * sun2)}, ${Math.round(150 + 90 * sun2)}, ${Math.round(210 + 40 * sun2)}, 1)`;
      const skyBot = `rgba(${Math.round(40 + 70 * sun2)}, ${Math.round(110 + 60 * sun2)}, ${Math.round(170 + 30 * sun2)}, 1)`;
      const skyGrad = ctx.createLinearGradient(0, -view.H, 0, view.H * 0.4);
      skyGrad.addColorStop(0, skyTop);
      skyGrad.addColorStop(1, skyBot);
      ctx.fillStyle = skyGrad;
      ctx.fill();
      ctx.restore();

      // —— 2b. 远景山脊（半透明剪影，带山形起伏）——
      // 山脊底部对齐陆地参考上沿：陆地在哪，山就从哪站起来。
      ctx.save();
      ctx.beginPath();
      let r0 = true;
      for (let i = 0; i < cols; i++) {
        const wx = wxs[i];
        const ridge = Math.sin(wx * 0.0006 + 2.1) * 70 + Math.sin(wx * 0.0019 + 0.6) * 34;
        const sy = (landTopWorld - RIDGE - ridge - camera.y) * scale;
        if (r0) { ctx.moveTo(sxs[i], sy); r0 = false; } else ctx.lineTo(sxs[i], sy);
      }
      for (let i = cols - 1; i >= 0; i--) {
        const sy = (landTopWorld - camera.y) * scale;
        ctx.lineTo(sxs[i], sy);
      }
      ctx.closePath();
      const ridgeGrad = ctx.createLinearGradient(0, -view.H, 0, view.H * 0.6);
      ridgeGrad.addColorStop(0, warm ? 'rgba(96, 108, 118, 0.55)' : 'rgba(52, 64, 80, 0.6)');
      ridgeGrad.addColorStop(1, warm ? 'rgba(140, 132, 108, 0.32)' : 'rgba(96, 96, 92, 0.4)');
      ctx.fillStyle = ridgeGrad;
      ctx.fill();
      ctx.restore();

      // —— 2c. 近景陆地（体积渐变：内陆暗冷 → 临水暖亮）——
      // 这是"伪 3D"的关键一段：光从左上打来，所以同一块地从上（内陆高处）
      // 到下（临水沙滩）必须有一个连续的明度攀升，看起来才像是"一块斜着
      // 伸进水里的地"，而不是贴片。
      ctx.save();
      if (isIsland) {
        // —— 环形岛体：用岛缘闭合轮廓直接填充 ——
        // 不用逐列上包络：包络在岛的左右极点会拓扑跳变，屏幕上是两条垂直
        // 切边（像块布丁）。islandEdge(θ) 本身就是闭合光滑曲线，直接连点。
        let t0 = Infinity, b0 = -Infinity;
        for (let k = 0; k < outlineS.length; k++) {
          const py = outlineS[k].y;
          if (py < t0) t0 = py;
          if (py > b0) b0 = py;
        }
        const gTop = t0 - 8;
        const gBot = Math.max(b0, gTop + 1);
        const g = ctx.createLinearGradient(0, gTop, 0, gBot);
        // 上沿（远岸）冷暗 → 下沿（近岸沙滩）暖亮 —— 环形的体积感来源
        g.addColorStop(0, warm ? 'rgba(64, 74, 64, 1)' : 'rgba(40, 46, 54, 1)');
        g.addColorStop(0.42, warm ? 'rgba(112, 108, 88, 1)' : 'rgba(80, 80, 74, 1)');
        g.addColorStop(0.78, warm ? 'rgba(170, 156, 124, 1)' : 'rgba(124, 118, 104, 1)');
        g.addColorStop(1, warm ? 'rgba(232, 214, 172, 1)' : 'rgba(184, 178, 158, 1)');
        // 岛体路径（多处复用）
        const islPath = () => {
          ctx.beginPath();
          for (let k = 0; k < outlineS.length; k++) {
            if (k === 0) ctx.moveTo(outlineS[k].x, outlineS[k].y);
            else ctx.lineTo(outlineS[k].x, outlineS[k].y);
          }
          ctx.closePath();
        };
        islPath();
        ctx.fillStyle = g;
        ctx.fill();

        // —— 岛体地势：由岛心向外的地色渐变 ——
        // 平涂一层沙色会让岛看着像块饼干。真实岛屿从水线到岛脊有明显的地色
        // 过渡（湿沙 → 干沙 → 草被 → 岩脊）。
        // ⚠ 不能用同心硬边圈（看着像等高线地形图），必须做成连续渐变。
        //   这里用径向渐变：圆心 = 岛心，半径 = 岛体在屏幕上的实际半径，
        //   沿半径方向排布地色停靠，与 islandInside 的 dome 高度场同构。
        const islCxS = islPx, islCyS = islPy;
        const domeG = ctx.createRadialGradient(islCxS, islCyS, islRpx * 0.05, islCxS, islCyS, islRpx * 1.05);
        if (warm) {
          domeG.addColorStop(0, 'rgba(236, 224, 184, 1)');    // 岛脊：亮沙/岩
          domeG.addColorStop(0.42, 'rgba(222, 208, 166, 1)');
          domeG.addColorStop(0.72, 'rgba(196, 182, 142, 1)');
          domeG.addColorStop(0.9, 'rgba(160, 152, 122, 1)');
          domeG.addColorStop(1, 'rgba(120, 118, 100, 1)');    // 水线：湿冷
        } else {
          domeG.addColorStop(0, 'rgba(186, 180, 160, 1)');
          domeG.addColorStop(0.42, 'rgba(170, 164, 146, 1)');
          domeG.addColorStop(0.72, 'rgba(146, 140, 124, 1)');
          domeG.addColorStop(0.9, 'rgba(116, 112, 102, 1)');
          domeG.addColorStop(1, 'rgba(78, 80, 78, 1)');
        }
        // 用岛体轮廓裁剪后铺渐变（否则渐变会溢出到海里）
        ctx.save();
        islPath();
        ctx.clip();
        ctx.fillStyle = domeG;
        // 覆盖整个岛体的包围盒（离屏部分无所谓，已被 clip）
        ctx.fillRect(islCxS - islRpx * 1.6, islCyS - islRpx * 1.6, islRpx * 3.2, islRpx * 3.2);

        // 受光面：光从左上来 —— 岛体左上一侧被照亮，右下一侧沉入阴影。
        // 这是让整座岛"鼓起来"的关键一笔（纯径向渐变是正圆形的，缺方向感）。
        const litG = ctx.createLinearGradient(
          islCxS - islRpx, islCyS - islRpx * 1.1,
          islCxS + islRpx * 0.9, islCyS + islRpx * 1.1
        );
        litG.addColorStop(0, 'rgba(255, 248, 226, 0.22)');
        litG.addColorStop(0.45, 'rgba(255, 248, 226, 0.04)');
        litG.addColorStop(1, 'rgba(12, 26, 46, 0.26)');
        ctx.fillStyle = litG;
        ctx.fillRect(islCxS - islRpx * 1.6, islCyS - islRpx * 1.6, islRpx * 3.2, islRpx * 3.2);

        // 细颗粒：给沙面一点粗糙质感（用极淡的静态噪点图案太贵，
        // 这里用几条随种子偏移的极淡弧线代替，成本近乎为零）
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = warm ? 'rgba(150, 140, 110, 1)' : 'rgba(110, 110, 100, 1)';
        ctx.lineWidth = 1;
        const seedO = tp.params.nPhase % 40;
        for (let k = 0; k < 3; k++) {
          const rr = islRpx * (0.35 + k * 0.22);
          ctx.beginPath();
          ctx.arc(islCxS, islCyS, rr, Math.PI * (0.15 + seedO * 0.001), Math.PI * (1.05 + seedO * 0.001));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      } else {
        for (let s = 0; s < segs.length; s++) {
          const [i, j] = segs[s];
          ctx.beginPath();
          for (let k = i; k <= j; k++) {
            const sy = (upAt(k) - camera.y) * scale;
            if (k === i) ctx.moveTo(sxs[k], sy); else ctx.lineTo(sxs[k], sy);
          }
          for (let k = j; k >= i; k--) {
            const sy = (loAt(k) - camera.y) * scale;
            ctx.lineTo(sxs[k], sy);
          }
          ctx.closePath();
          // 该段的纵向范围决定渐变停靠
          let t0 = Infinity, b0 = -Infinity;
          for (let k = i; k <= j; k++) {
            const a = (upAt(k) - camera.y) * scale;
            const b = (loAt(k) - camera.y) * scale;
            if (a < t0) t0 = a;
            if (b > b0) b0 = b;
          }
          const gTop = t0 - 8;
          const gBot = Math.max(b0, gTop + 1);
          const g = ctx.createLinearGradient(0, gTop, 0, gBot);
          // 横贯陆地：四停（内陆冷暗 → 草/岩 → 干沙 → 浪线暖亮）
          g.addColorStop(0, warm ? 'rgba(74, 82, 70, 1)' : 'rgba(46, 52, 58, 1)');
          g.addColorStop(0.6, warm ? 'rgba(126, 118, 94, 1)' : 'rgba(88, 86, 78, 1)');
          g.addColorStop(0.85, warm ? 'rgba(178, 162, 128, 1)' : 'rgba(130, 124, 108, 1)');
          g.addColorStop(1, warm ? 'rgba(228, 210, 166, 1)' : 'rgba(178, 172, 152, 1)');
          ctx.fillStyle = g;
          ctx.fill();
        }
      }
      ctx.restore();

      // ---------- 2d. 受光顶边 / 3. 水线 / 4. 湿沙 ----------
      // shore / slope：这三笔都是横贯线，逐列取 upAt/loAt 即可。
      // island：不能用逐列 profile —— 岛心附近的列会同时包含"远岸"和"近岸"，
      //   逐列的 bot 会落在岛体中部，于是水线被画进岛里面（实测一圈内轮廓）。
      //   正确做法是沿**轮廓点表**走：轮廓天然区分远岸段与近岸段，按点的
      //   世界 y 相对岛心分两半即可。（outlineS / islPx / islPy 已在前文算好）

      // —— 2d. 受光顶边（内陆界 / 岛的远岸上沿）——
      // 光从左上来 → 陆地的"上沿"应该被照亮，这是让它立起来最便宜的一笔。
      ctx.save();
      ctx.strokeStyle = warm ? 'rgba(196, 190, 156, 0.5)' : 'rgba(150, 152, 146, 0.42)';
      ctx.lineWidth = 1.6;
      if (isIsland) {
        // 取轮廓的"远岸段"：世界 y < islY 的那一半（画面上半）
        strokePolyline(ctx, outlineS.filter((q) => q.wy < tp.params.islY));
      } else {
        for (let s = 0; s < segs.length; s++) {
          const [i, j] = segs[s];
          ctx.beginPath();
          for (let k = i; k <= j; k++) {
            const sy = (upAt(k) - camera.y) * scale;
            if (k === i) ctx.moveTo(sxs[k], sy); else ctx.lineTo(sxs[k], sy);
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      // ---------- 3. 水线（白色浪花细线，贴下沿 / 近岸段）----------
      ctx.save();
      ctx.strokeStyle = `rgba(230, 248, 255, ${0.5 * sunF})`;
      ctx.lineWidth = 2;
      if (isIsland) {
        // 近岸段（世界 y > islY），浪花按点的世界 x 起伏
        const near = outlineS.filter((q) => q.wy >= tp.params.islY);
        if (near.length > 1) {
          ctx.beginPath();
          for (let k = 0; k < near.length; k++) {
            const wx = near[k].x / scale + camera.x;
            const wave = Math.sin(wx * 0.02 + t * 0.0016) * 3 + Math.sin(wx * 0.006 - t * 0.0011) * 4;
            const sy = near[k].y + wave;
            if (k === 0) ctx.moveTo(near[k].x, sy); else ctx.lineTo(near[k].x, sy);
          }
          ctx.stroke();
        }
      } else {
        for (let s = 0; s < segs.length; s++) {
          const [i, j] = segs[s];
          ctx.beginPath();
          for (let k = i; k <= j; k++) {
            const wx = wxs[k];
            // 浪花随时间起伏，让水线是「活的」
            const wave = Math.sin(wx * 0.02 + t * 0.0016) * 3 + Math.sin(wx * 0.006 - t * 0.0011) * 4;
            const sy = (loAt(k) - camera.y) * scale + wave;
            if (k === i) ctx.moveTo(sxs[k], sy); else ctx.lineTo(sxs[k], sy);
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      // ---------- 4. 湿沙反光（紧贴水线之上的薄带）----------
      // 湿沙反光会把水线和陆地"焊"在一起，不然陆地像是浮在水面的贴纸。
      ctx.save();
      ctx.fillStyle = `rgba(255, 246, 214, ${0.2 * sunF})`;
      if (isIsland) {
        // 沿近岸段做一条向内 5px 的薄带
        const near = outlineS.filter((q) => q.wy >= tp.params.islY);
        if (near.length > 1) {
          ctx.beginPath();
          // 外沿（轮廓）从左到右
          for (let k = 0; k < near.length; k++) {
            if (k === 0) ctx.moveTo(near[k].x, near[k].y); else ctx.lineTo(near[k].x, near[k].y);
          }
          // 内沿回程：朝岛心方向缩 5px
          for (let k = near.length - 1; k >= 0; k--) {
            const dx = near[k].x - islPx, dy = near[k].y - islPy;
            const len = Math.hypot(dx, dy) || 1;
            ctx.lineTo(near[k].x - (dx / len) * 6, near[k].y - (dy / len) * 6);
          }
          ctx.closePath();
          ctx.fill();
        }
      } else {
        for (let s = 0; s < segs.length; s++) {
          const [i, j] = segs[s];
          ctx.beginPath();
          for (let k = i; k <= j; k++) {
            const sy = (loAt(k) - camera.y) * scale;
            if (k === i) ctx.moveTo(sxs[k], sy); else ctx.lineTo(sxs[k], sy);
          }
          for (let k = j; k >= i; k--) ctx.lineTo(sxs[k], (loAt(k) - camera.y) * scale - 5);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    },
  };
}

/** 把一串屏幕点连成折线并描边（调用方已设好样式） */
function strokePolyline(ctx, pts) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  for (let k = 0; k < pts.length; k++) {
    if (k === 0) ctx.moveTo(pts[k].x, pts[k].y); else ctx.lineTo(pts[k].x, pts[k].y);
  }
  ctx.stroke();
}
