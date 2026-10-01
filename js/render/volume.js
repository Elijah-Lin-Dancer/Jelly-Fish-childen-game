// ============================================================================
// volume.js —— 全局伪 3D 体积光照库（期二）
// ----------------------------------------------------------------------------
// 目标：让"整个游戏"看上去处于同一套光照之下。
//
// 期一里水母（jellyfish.js）手搓了一套伪 3D 手法（外发光 + 半透明体 +
// 高光 + 边缘亮环 + 色相强化），效果很好但只有水母自己有。期二把手法抽成
// 共享函数，地形 / 鱼 / 龟 / 鲸 / 岸上元素统一调用，避免"水母有立体感，
// 别的东西是纸片"的割裂感。
//
// 核心约定
//   · 单一光源：左上偏上（水下感知里"光从海面来"），LIGHT 为单位向量。
//   · 所有函数只接收**世界坐标**，调用方负责已经 translate 到实体中心。
//   · 颜色一律用 'r,g,b' 三元组字符串（如 '120,200,255'），便于任意调 alpha。
//   · 不污染 ctx 状态：内部 save/restore，或在函数末尾还原 composite。
//
// 性能约定
//   · 渐变对象按 (尺寸, 颜色, 强度) 做 key 缓存，避免每帧重建（GC 抖动）。
//   · 缓存挂在 ctx 上会跨实体串味，因此各实体自带缓存；本模块提供
//     `gradCache` 让调用方按自己的 key 取用，简单可靠。
// ============================================================================

export const TAU = Math.PI * 2;

// 光从左上来。y 为负 = 向上（canvas 坐标系 y 向下），x 为负 = 来自左侧。
export const LIGHT = { x: -0.42, y: -0.88 };

// ---------------------------------------------------------------------------
// 颜色工具
// ---------------------------------------------------------------------------

/** 'R,G,B' 三元组 -> 'rgba(R,G,B,a)' */
export function rgba(triple, a) {
  return 'rgba(' + triple + ',' + a + ')';
}

/** 把 'R,G,B' 朝白/黑方向推，t>0 提亮，t<0 压暗 */
export function shade(triple, t) {
  const p = triple.split(',');
  let r = +p[0], g = +p[1], b = +p[2];
  if (t >= 0) {
    r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t;
  } else {
    r *= (1 + t); g *= (1 + t); b *= (1 + t);
  }
  return Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b);
}

/** 'R,G,B' -> '#RRGGBB' */
export function hexOf(triple) {
  const p = triple.split(',');
  return '#' + p.map(function (v) {
    return Math.max(0, Math.min(255, +v)).toString(16).padStart(2, '0');
  }).join('');
}

/** 两色线性混合，t=0 取 a，t=1 取 b；接受 'R,G,B' 或 '#RRGGBB' */
export function mixColor(a, b, t) {
  const A = parseColor(a), B = parseColor(b);
  return Math.round(A[0] + (B[0] - A[0]) * t) + ',' +
    Math.round(A[1] + (B[1] - A[1]) * t) + ',' +
    Math.round(A[2] + (B[2] - A[2]) * t);
}

function parseColor(c) {
  if (c.charAt(0) === '#') {
    const h = c.slice(1);
    const n = h.length === 3
      ? h.split('').map(function (ch) { return parseInt(ch + ch, 16); })
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return n;
  }
  const p = c.split(',');
  return [+p[0], +p[1], +p[2]];
}

// ---------------------------------------------------------------------------
// 渐变缓存 —— 调用方自带 map，避免每帧重建渐变
// ---------------------------------------------------------------------------

/**
 * 取（或建）一个径向渐变。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Map} cache   调用方的缓存 map（可传 null 表示不缓存）
 * @param {string} key  唯一键（含尺寸/颜色/强度）
 * @param {number} x0,y0 渐变中心
 * @param {number} r0   内半径
 * @param {number} r1   外半径
 * @param {Array} stops [[offset, color], ...]
 * @returns {CanvasGradient}
 */
export function radial(ctx, cache, key, x0, y0, r0, r1, stops) {
  if (cache) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  const g = ctx.createRadialGradient(x0, y0, r0, x0, y0, r1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  if (cache) {
    if (cache.size > 120) cache.clear(); // 尺寸/palette 变了就别无限涨
    cache.set(key, g);
  }
  return g;
}

/** 渐变缓存工厂（每个实体/图层持有一个） */
export function makeCache() { return new Map(); }

// ---------------------------------------------------------------------------
// 1. 外光晕 —— "这东西在发光/被照亮"，用 lighter 叠
// ---------------------------------------------------------------------------

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x,y   实体中心（已 translate 则传 0,0）
 * @param {number} r     实体半径
 * @param {string} tint  'R,G,B' 光晕色
 * @param {object} [o]   { glow=1 强度, scale=1.9 外径倍数, cache, key }
 */
export function glow(ctx, x, y, r, tint, o) {
  o = o || {};
  const inten = o.glow === undefined ? 1 : o.glow;
  if (inten <= 0.02) return;
  const sc = (o.scale === undefined ? 1.9 : o.scale) * (0.7 + inten * 0.45);
  const gr = r * sc;
  const a1 = Math.min(200, Math.round(150 * inten));
  const a2 = Math.min(120, Math.round(64 * inten));
  const stops = [
    [0, rgba(tint, a1 / 255)],
    [0.42, rgba(tint, a2 / 255)],
    [1, rgba(tint, 0)]
  ];
  const key = 'g|' + Math.round(gr) + '|' + tint + '|' + inten.toFixed(2);
  const grad = radial(ctx, o.cache, key, 0, 0, 0, gr, stops);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, gr, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
}

// ---------------------------------------------------------------------------
// 2. 球状体积 —— 圆/椭圆主体（鱼身、龟壳、石头、气泡…）
// ---------------------------------------------------------------------------

/**
 * 画一个带体积感的球/椭球体（不描边，纯填充）。
 * 光照：亮面朝 LIGHT 方向，暗面在反向；额外一层"色相强化"抵消水色对色彩的稀释。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x,y  球心
 * @param {number} r    半径
 * @param {string} base 'R,G,B' 基色
 * @param {object} [o]
 *   o.ry      纵向半径倍数（默认 1，<1 压扁成椭圆）
 *   o.rot     椭圆旋转（弧度）
 *   o.depth   0~1，"在水里有多深"——越深越偏冷/越暗（默认 0）
 *   o.alpha   整体不透明度（默认 1）
 *   o.light   额外受光强度 0~1（默认 1）
 *   o.flatTop / o.flatBot  顶部/底部压平（0~1）
 *   o.cache,o.key  渐变缓存
 */
export function sphereVolume(ctx, x, y, r, base, o) {
  o = o || {};
  const ry = o.ry === undefined ? 1 : o.ry;
  const rot = o.rot || 0;
  const depth = o.depth || 0;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  const lightAmt = o.light === undefined ? 1 : o.light;
  if (r <= 0.05) return;

  // 深度冷色偏移：越深越靠蓝，这是水下体积感的"氛围层"
  const body = depth > 0 ? mixColor(base, '#2a3f6e', depth * 0.45) : base;

  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * alpha;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);

  // 主体：径向渐变中心朝光源反方向偏移，形成"球面受光"
  const lx = LIGHT.x * r * 0.42, ly = LIGHT.y * r * 0.42;
  const c = shade(body, 0.30 * lightAmt);
  const m = body;
  const d = shade(body, -0.34 - depth * 0.2);
  const stops = [
    [0, rgba(c, 1)],
    [0.45, rgba(m, 1)],
    [1, rgba(d, 1)]
  ];
  const key = 'sv|' + Math.round(r) + '|' + Math.round(r * ry) + '|' + body + '|' + lightAmt.toFixed(2);
  const grad = radial(ctx, o.cache, key, lx, ly, r * 0.05, r * 1.02, stops);

  ctx.beginPath();
  if (ry === 1 && !o.flatTop && !o.flatBot) {
    ctx.arc(0, 0, r, 0, TAU);
  } else {
    ellipsePath(ctx, r, r * ry, o.flatTop || 0, o.flatBot || 0);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = prevA;
}

/**
 * 标准贝塞尔椭圆路径（可选顶部/底部压平）。
 * flatTop/flatBot 为 0~1：0 是完整圆，1 是完全压平到圆心。
 */
function ellipsePath(ctx, rx, ry, flatTop, flatBot) {
  const k = 0.5523;
  const ty = -ry * (1 - flatTop);
  const by = ry * (1 - flatBot);
  const midY = (ty + by) * 0.5;
  const kyTop = k * (ty - midY);
  const kyBot = k * (by - midY);
  ctx.beginPath();
  ctx.moveTo(0, ty);
  // 右上 → 右
  ctx.bezierCurveTo(rx * k, ty, rx, midY + kyTop, rx, midY);
  // 右 → 右下
  ctx.bezierCurveTo(rx, midY + kyBot, rx * k, by, 0, by);
  // 左下 → 左
  ctx.bezierCurveTo(-rx * k, by, -rx, midY + kyBot, -rx, midY);
  // 左 → 左上
  ctx.bezierCurveTo(-rx, midY + kyTop, -rx * k, ty, 0, ty);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 3. 胶囊体积 —— 长条身体（鱼、虾、海鳗…）
// ---------------------------------------------------------------------------

/**
 * 沿 (x0,y0)->(x1,y1) 画一个带体积的胶囊。
 * 手法：先画整体（含尖头）作为主体渐变，再叠高光条 + 暗侧。
 */
export function capsuleVolume(ctx, x0, y0, x1, y1, r0, r1, base, o) {
  o = o || {};
  const depth = o.depth || 0;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  const lightAmt = o.light === undefined ? 1 : o.light;
  const body = depth > 0 ? mixColor(base, '#2a3f6e', depth * 0.45) : base;
  if (r0 <= 0.05 && r1 <= 0.05) return;

  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * alpha;
  ctx.save();

  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;      // 法线
  const hx = LIGHT.x * -ny - LIGHT.y * nx;  // 高光侧判定
  const side = hx >= 0 ? 1 : -1;

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const mid = Math.max(r0, r1);
  const shadow = shade(body, -0.34 - depth * 0.2);
  const lite = shade(body, 0.3 * lightAmt);
  const stops = [[0, rgba(lite, 1)], [0.45, rgba(body, 1)], [1, rgba(shadow, 1)]];
  const key = 'cv|' + Math.round(len) + '|' + Math.round(mid) + '|' + body + '|' + lightAmt.toFixed(2);
  const gcx = cx + LIGHT.x * mid * 0.5, gcy = cy + LIGHT.y * mid * 0.5;
  const grad = radial(ctx, o.cache, key, gcx, gcy, mid * 0.2, mid * 1.25, stops);

  // 胶囊路径：两端半圆
  const a0 = Math.atan2(dy, dx) + Math.PI / 2;
  const a1 = Math.atan2(dy, dx) - Math.PI / 2;
  ctx.beginPath();
  ctx.arc(x0, y0, r0, a0, a1 + Math.PI * 2, false);
  ctx.arc(x1, y1, r1, a1, a0, false);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 脊背高光：沿中轴偏移一点，画一条细亮线（体积感的"顶面"）
  if (o.spine !== false && mid > 1.2) {
    ctx.globalCompositeOperation = 'lighter';
    const prev = 'source-over';
    ctx.strokeStyle = rgba(shade(body, 0.55), 0.28 * lightAmt);
    ctx.lineWidth = Math.max(0.8, mid * 0.3);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const off = side * mid * 0.42;
    ctx.moveTo(x0 + nx * off * 0.6, y0 + ny * off * 0.6);
    ctx.quadraticCurveTo(cx + nx * off, cy + ny * off, x1 + nx * off * 0.6, y1 + ny * off * 0.6);
    ctx.stroke();
    ctx.globalCompositeOperation = prev;
  }

  ctx.restore();
  ctx.globalAlpha = prevA;
}

// ---------------------------------------------------------------------------
// 4. 有机体积 —— 水母伞盖那种"波浪底边的软体"
// ---------------------------------------------------------------------------

/**
 * 画一个有机软体（伞盖/水母/水草头…）。
 * @param {number} r 半径
 * @param {object} [o]
 *   o.waves   底边波浪数（默认 5）
 *   o.waveAmp 波浪幅度（默认 0.12）
 *   o.phase   波浪相位
 *   o.hueTint 'R,G,B' 色相强化色（默认取 base 的提亮版）
 *   o.hueAmt  色相强化强度（默认 0.22）
 *   o.flatten 顶部压平（默认 1.3 的贝塞尔控制点）
 *   o.cache,o.key
 *   o.pathOnly 只构建路径不填充（供调用方复用）
 */
export function organicVolume(ctx, x, y, r, base, o) {
  o = o || {};
  const waves = o.waves === undefined ? 5 : o.waves;
  const waveAmp = o.waveAmp === undefined ? 0.12 : o.waveAmp;
  const phase = o.phase || 0;
  const depth = o.depth || 0;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  const lightAmt = o.light === undefined ? 1 : o.light;
  const topK = o.flatten === undefined ? 1.3 : o.flatten;
  if (r <= 0.05) return;

  const body = depth > 0 ? mixColor(base, '#2a3f6e', depth * 0.4) : base;
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * alpha;
  ctx.save();
  ctx.translate(x, y);

  const buildPath = function () {
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r, -r * topK, r, -r * topK, r, 0);
    for (let i = 0; i <= waves; i++) {
      const f = i / waves;
      const wx = r - f * r * 2;
      const wy = r * 0.15 + Math.sin(f * Math.PI + phase) * r * waveAmp;
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
  };

  if (!o.pathOnly) {
    // 主体渐变（受光偏上）
    const lx = LIGHT.x * r * 0.3, ly = LIGHT.y * r * 0.3;
    const stops = [
      [0, rgba(shade(body, 0.34 * lightAmt), 0.93)],
      [0.55, rgba(body, 0.6)],
      [1, rgba(shade(body, -0.28), 0.27)]
    ];
    const key = 'ov|' + Math.round(r) + '|' + body + '|' + lightAmt.toFixed(2);
    const grad = radial(ctx, o.cache, key, lx, ly, 0, r, stops);
    buildPath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 色相强化（lighter）——水下色彩被水色稀释，这是必要的补偿
    const hueAmt = o.hueAmt === undefined ? 0.22 : o.hueAmt;
    if (hueAmt > 0.01) {
      const tint = o.hueTint || shade(body, 0.4);
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createRadialGradient(0, -r * 0.15, 0, 0, 0, r * 1.02);
      g2.addColorStop(0, rgba(tint, hueAmt));
      g2.addColorStop(0.7, rgba(tint, hueAmt * 0.5));
      g2.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = g2;
      buildPath();
      ctx.fill();
      ctx.globalCompositeOperation = prev;
    }
  } else {
    buildPath();
  }

  ctx.restore();
  ctx.globalAlpha = prevA;
}

// ---------------------------------------------------------------------------
// 5. 高光 + 边缘亮环 —— 让轮廓"浮起来"
// ---------------------------------------------------------------------------

/**
 * 顶部高光椭圆。
 * @param {number} hw,hh 高光椭圆半径
 */
export function specular(ctx, x, y, hw, hh, o) {
  o = o || {};
  const a = o.alpha === undefined ? 0.32 : o.alpha;
  if (a <= 0.01) return;
  ctx.save();
  ctx.fillStyle = o.color || 'rgba(255,255,255,' + a + ')';
  ctx.beginPath();
  ctx.ellipse(x, y, hw, hh, o.rot === undefined ? -0.3 : o.rot, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * 上缘亮环（物体被上方光"扫到边"的那圈亮边）。
 * @param {object} [o] { from=1.15, to=1.85, color, alpha=0.33, width=1.5, cy=-0.35 }
 */
export function rimLight(ctx, x, y, r, tint, o) {
  o = o || {};
  const from = o.from === undefined ? Math.PI * 1.15 : o.from;
  const to = o.to === undefined ? Math.PI * 1.85 : o.to;
  const a = o.alpha === undefined ? 0.33 : o.alpha;
  if (a <= 0.01) return;
  const prev = ctx.globalCompositeOperation;
  ctx.save();
  ctx.strokeStyle = rgba(tint, a);
  ctx.lineWidth = o.width === undefined ? 1.5 : o.width;
  ctx.beginPath();
  ctx.arc(x, y + r * (o.cy === undefined ? -0.35 : o.cy), r * (o.rk === undefined ? 0.92 : o.rk), from, to);
  ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = prev;
}

// ---------------------------------------------------------------------------
// 6. 面向相机的"贴地/贴墙"体积 —— 地形用
// ---------------------------------------------------------------------------

/**
 * 把一段竖直剖面（从 (x0,y0) 到 (x1,y1)，宽 w）画成有体积的土体。
 * 用于地形边缘 / 崖壁：受光面亮，背光面和底部暗，再压一条接地暗边。
 *
 * @param {number} w 厚度（像素）
 * @param {string} base 'R,G,B'
 * @param {object} [o] { top:'R,G,B' 顶层色, depth:0~1, alpha }
 */
export function earthVolume(ctx, x0, y0, x1, y1, w, base, o) {
  o = o || {};
  const depth = o.depth || 0;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  const body = depth > 0 ? mixColor(base, '#16233f', depth * 0.4) : base;
  const top = o.top ? mixColor(o.top, '#2a3f6e', depth * 0.35) : shade(body, 0.22);

  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * alpha;
  ctx.save();

  // 主体：从上到下压暗
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(top, 1));
  g.addColorStop(0.35, rgba(body, 1));
  g.addColorStop(1, rgba(shade(body, -0.42), 1));
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // 受光顶边：一条亮线（光的来向在左上，所以顶边最亮）
  ctx.fillStyle = rgba(shade(top, 0.42), 0.5);
  ctx.fillRect(x0, y0, x1 - x0, Math.min(2.5, w * 0.04));

  ctx.restore();
  ctx.globalAlpha = prevA;
}

// ---------------------------------------------------------------------------
// 便捷：按深度给元素计算"氛围参数"
// ---------------------------------------------------------------------------

/**
 * 统一的深度感受光参数。所有实体都应该用它算光照，保证同一个世界同一套光。
 * @param {number} depthNorm 0（水面）~ 1（最深）
 * @returns {{light:number, depth:number, tintMix:number}}
 */
export function depthLight(depthNorm) {
  const d = Math.max(0, Math.min(1, depthNorm || 0));
  return {
    light: 1 - d * 0.34,   // 越深越不知道光在哪
    depth: d * 0.85,       // 体积色偏冷程度
    tintMix: d
  };
}

/**
 * 便捷封装：一次调用画完"本体 + 高光 + 边光"。
 * 适合鱼这种"一个椭圆身"的实体，减少调用方样板代码。
 */
export function blob(ctx, x, y, r, base, o) {
  o = o || {};
  sphereVolume(ctx, x, y, r, base, o);
  if (o.spec !== false) {
    specular(ctx, x - r * 0.25, y - r * 0.5, r * 0.35, r * 0.18, { alpha: o.specA === undefined ? 0.3 : o.specA });
  }
  if (o.rim !== false) {
    rimLight(ctx, x, y, r, o.rimColor || shade(base, 0.5), { alpha: o.rimA === undefined ? 0.24 : o.rimA });
  }
}
