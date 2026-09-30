// 地形系统：解析式海床（noise / sine 公式），零网格、O(1) 采样。
//
// 【坐标约定 —— 全项目必须一致】
//   worldX ∈ [WORLD.x0, WORLD.x1] —— 温度 / 沿岸轴（横向世界）
//   worldY ∈ [WORLD.y0, WORLD.y1] —— 水深梯度轴（0 = 水线，负 = 岸上，正 = 越深）
//
// depthAt(x, y) 返回「水深」：< 0 表示陆地高度（抬升），0 附近是水线，> 0 是水深。
// 深度已饱和到 MAX_DEPTH，不会随 y 无限增长。
import { clamp, lerp } from '../core/config.js';
import { makeRng, rangeFrom } from '../core/seed.js';

export const WORLD = {
  x0: 0,
  x1: 6000,
  y0: -220,
  y1: 900,
  w: 6000,
  h: 1120,
};

// 尺寸取 6000 × 1120（≈ 5.4:1），刚好覆盖 16:9 到 21:9 的主流视口 ——
// 相机用 max() 铺满视口，任何比 4.6:1 更宽的屏幕都看不到边界。
// WORLD 轴的单位刻意贴近「缩放 1 时的屏幕像素」，这样地形的所有常数
// 都直接对应屏幕上看到的大小（岸上 340 就真的是 340px 的土坡）。
// 任何等比例缩放的坐标系都必须保持 w/h 这个比例，否则 island 会变椭圆。
export const ASPECT = WORLD.w / WORLD.h;

// 水深带（按 depth 阈值划分），顺序由浅到深。
export const MAX_DEPTH = 1000;

// 阈值是按「世界高 1120」标定的：每个带对应约 200 世界单位（≈150 屏幕像素），
// 这样六档在观感上是均匀递进的，而不是「浅滩一大坨、深海看不见」。
export const BANDS = [
  { id: 'land', key: 'band.land', max: 0 },
  { id: 'beach', key: 'band.beach', max: 90 },
  { id: 'shallow', key: 'band.shallow', max: 210 },
  { id: 'nearshore', key: 'band.nearshore', max: 380 },
  { id: 'midsea', key: 'band.midsea', max: 620 },
  { id: 'deepsea', key: 'band.deepsea', max: MAX_DEPTH },
];

// 归一化水深（0..1），供压力 / 生态 / 混色使用
export function depthNorm(depth) {
  return clamp(depth / MAX_DEPTH, 0, 1);
}

export function bandAt(depth) {
  // 注意：负数（陆地）必须钳到 -1，不能钳到 0 —— 钳到 0 后 `0 < land.max(0)` 为 false，
  // land 带永远匹配不到，所有陆地都会被误判成 beach。
  const d = depth < 0 ? -1 : Math.min(depth, MAX_DEPTH);
  for (let i = 0; i < BANDS.length; i++) {
    if (d < BANDS[i].max) return BANDS[i];
  }
  return BANDS[BANDS.length - 1];
}

export function bandIndexAt(depth) {
  const d = depth < 0 ? -1 : Math.min(depth, MAX_DEPTH);
  for (let i = 0; i < BANDS.length; i++) {
    if (d < BANDS[i].max) return i;
  }
  return BANDS.length - 1;
}

// 廉价的一维值噪声（散列 + 平滑插值），比逐点 sin 更有「地形感」
function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}

function fbm1(x, octaves) {
  let a = 1;
  let sum = 0;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise1(x * f) * a;
    norm += a;
    a *= 0.5;
    f *= 2.07;
  }
  return norm > 0 ? sum / norm : 0;
}

const TERRAIN_TYPES = ['shore', 'slope', 'island'];

export function terrainTypes() {
  return TERRAIN_TYPES.slice();
}

export function isTerrainType(id) {
  return TERRAIN_TYPES.indexOf(id) >= 0;
}

// createTerrain({ type, seed })
//   depthAt(x, y)     -> 水深（负 = 陆上高度）
//   zoneAt(x, y)      -> 'land' | 'beach' | 'shallow' | 'nearshore' | 'midsea' | 'deepsea'
//   shoreLineAt(x)    -> 该 x 处的水线 y（worldY 小于它即岸上）
//   surfaceAt(x)      -> 岸上高度（海平面以上，用于天空/海岸渲染）
//   landHeightAt(x,y) -> 岸上地形起伏（只在 depth < 0 时有意义）
//   temperatureAt(x)  -> 0..1 暖 → 冷，供群系混色使用
//   samplePoint(band) -> 在指定水深带内找一个生成点
export function createTerrain(opts = {}) {
  const type = isTerrainType(opts.type) ? opts.type : 'shore';
  const { seed, rng } = makeRng(opts.seed == null ? 'shore' : opts.seed);

  // —— 由种子派生少量参数，保证同种子必得同地形 ——
  const p = {};

  // slope 专用：水线是一段斜线。端点必须留在 worldX 范围内夹紧，
  // 否则「橙子皮」效应会让整张图退化成纯陆地（早期版本 81% 陆地就是这个原因）。
  p.sx0 = rangeFrom(rng, WORLD.x0 - 900, WORLD.x0 - 400);
  p.sx1 = rangeFrom(rng, WORLD.x1 - 1500, WORLD.x1 - 800);
  p.sy0 = rangeFrom(rng, -230, -150);
  // sy1 必须「由 sx1 反推」：先定斜率，再算出水线在世界右边缘的位置，
  // 这样无论种子怎么抽，x = WORLD.x1 处的水线都稳定落在 y≈820（深海），
  // 不会出现「右侧本该是陆地高度、却在屏幕下方」的接缝。
  p.slopeA = rangeFrom(rng, 0.16, 0.26);
  p.sy1 = p.sy0 + (p.sx1 - p.sx0) * p.slopeA;

  // 岸线整体起伏（三种类型共用）
  p.shoreAmp = rangeFrom(rng, 26, 76);
  p.shoreFreq = rangeFrom(rng, 0.0006, 0.0016);
  p.shorePhase = rangeFrom(rng, 0, Math.PI * 2);

  // 沿岸滩涂宽度（陆上高度跨度）
  p.beachW = rangeFrom(rng, 80, 140);

  // shore 专用：水线基高
  p.shoreY = rangeFrom(rng, -50, 80);

  // island：中心岛的位置 / 半径
  p.islX = rangeFrom(rng, WORLD.x0 + WORLD.w * 0.3, WORLD.x0 + WORLD.w * 0.7);
  p.islY = rangeFrom(rng, -20, 60);
  p.islR = rangeFrom(rng, 400, 500);
  p.islWobble = rangeFrom(rng, 0.1, 0.26);

  // 通用相位
  p.nPhase = rangeFrom(rng, 0, 1000);
  p.tempWob = rangeFrom(rng, 0.05, 0.16);
  p.ridgeFreq = rangeFrom(rng, 0.0012, 0.0022);

  // 把「水线 y 随 x 变化」的斜率归一化到世界坐标 —— 这样任意等比例缩放的
  // 坐标系下岸线倾角都一致。注意岸线粗细必须用与方向无关的常量（SLOPE_BAND），
  // 不能用 p.sy1 - p.sy0，否则近乎垂直的岸线会被归一化抹平。
  const slopeA = p.slopeA;
  const SLOPE_BAND = 240;

  function shoreBaseAt(x) {
    if (type === 'slope') return p.sy0 + (x - p.sx0) * slopeA;
    if (type === 'island') return p.islY;
    return p.shoreY;
  }

  // 水线：给定 x 返回该处水线的 worldY
  function shoreLineAt(x) {
    const base = shoreBaseAt(x);
    const wob = Math.sin(x * p.shoreFreq + p.shorePhase) * p.shoreAmp;
    const detail = fbm1(x * 0.0016 + p.nPhase, 3) * 40;
    if (type === 'island') {
      // 岛屿之外是开阔海面，水线基本水平，只做轻微起伏
      return base + wob * 0.35 + detail * 0.3;
    }
    return base + wob + detail;
  }

  // 岸上高度（海平面以上为正）
  function landHeightAt(x, y) {
    const sl = shoreLineAt(x);
    const uphill = sl - y; // 越大表示越往内陆
    if (uphill <= 0) return 0;
    const t = clamp(uphill / p.beachW, 0, 1);
    const h = t * p.beachW; // 线性抬升
    const dune = fbm1(x * 0.002 + p.nPhase * 1.7, 3) * 34 * t;
    // 上限 200：世界高只有 1120，不封顶的话 slope 型会在屏幕里长出一堵
    // 贯穿整个视口的土墙。这个值也保证 y0=-220 到水线之间始终是完整的沙滩。
    return clamp(Math.max(0, h + dune), 0, 200);
  }

  // —— 浅水剖面：水线处 depth = 0，往外平滑加深，最终饱和到 MAX_DEPTH ——
  // 用两段指数而不是幂函数：幂函数在远离岸线处会顶到 7000+，
  // 整张图 2/3 掉进 deepsea，变成「要么陆地要么深渊」。
  // 两段指数：d=0 起陡（浅滩），随后转缓（深海）。目标是在 y 从水线走到
  // 世界底边（约 1120）的过程中走完 90 → 620 → MAX_DEPTH，让每一档都吃到
  // 足够的水深，而不是前 200 单位就把整条曲线跑完。
  function shelfDepth(d) {
    return 400 * (1 - Math.exp(-d / 300)) + 560 * (1 - Math.exp(-d / 1600));
  }

  // 岛屿边缘半径（带角度扰动，让岛不是完美圆形）
  function islandEdge(x, y) {
    const ang = Math.atan2(y - p.islY, x - p.islX);
    const wob =
      1 + Math.sin(ang * 3 + p.nPhase) * p.islWobble + fbm1(ang * 2.4 + p.nPhase, 2) * p.islWobble;
    return p.islR * wob;
  }

  // 岛内返回负水深（陆地），不在岛上返回 null
  function islandInside(x, y) {
    const dx = x - p.islX;
    const dy = y - p.islY;
    const r = Math.sqrt(dx * dx + dy * dy);
    const edge = islandEdge(x, y);
    if (r > edge) return null;
    // r=0 岛心最高 —— 抬升为陆地，边缘收平到水线
    const t = clamp(r / edge, 0, 1);
    const dome = Math.pow(1 - t, 1.6);
    const dune = fbm1(x * 0.003 + p.nPhase * 1.7, 3) * 30 * dome;
    return -(190 * dome + dune) - 4;
  }

  // 海床起伏（颗粒），只加在水下
  function ridgeNoise(x, y) {
    return fbm1(x * p.ridgeFreq + p.nPhase, 3) * 34 + fbm1(y * 0.0021 + p.nPhase * 2.3, 2) * 26;
  }

  // 水深核心
  function depthAt(x, y) {
    if (type === 'island') {
      const inside = islandInside(x, y);
      if (inside !== null) return inside;
      const dx = x - p.islX;
      const dy = y - p.islY;
      const r = Math.sqrt(dx * dx + dy * dy);
      const d = r - islandEdge(x, y);
      return clamp(shelfDepth(d * 2.4) + ridgeNoise(x, y), 0, MAX_DEPTH);
    }

    if (type === 'slope') {
      const raw = y - shoreLineAt(x);
      if (raw < 0) return -landHeightAt(x, y) - 4;
      // 沿岸带内用线性过渡（避免噪声把水线打成毛边），带外接指数剖面
      const band = clamp(raw / SLOPE_BAND, 0, 1);
      const linear = raw * 0.16;
      return clamp(lerp(linear, shelfDepth(raw), band) + ridgeNoise(x, y) * band, 0, MAX_DEPTH);
    }

    // shore：顶部一条横贯沙滩，往下逐深 —— 经典海湾
    const sl = shoreLineAt(x);
    if (y < sl) return -landHeightAt(x, y) - 4;
    const below = y - sl;
    return clamp(shelfDepth(below) + ridgeNoise(x, y), 0, MAX_DEPTH);
  }

  function zoneAt(x, y) {
    return bandAt(depthAt(x, y)).id;
  }

  // 岸上高度（给天空/海岸渲染用）
  function surfaceAt(x) {
    const sl = shoreLineAt(x);
    return Math.max(0, landHeightAt(x, sl + 1));
  }

  // 温度轴：左暖右冷 + 抖动（沿 worldX）
  function temperatureAt(x) {
    const t = (x - WORLD.x0) / WORLD.w;
    const wob =
      Math.sin(x * 0.0007 + p.shorePhase) * p.tempWob + fbm1(x * 0.0009 + p.nPhase, 2) * p.tempWob;
    return clamp(t + wob, 0, 1);
  }

  function isLand(x, y) {
    return depthAt(x, y) < 0;
  }

  // 找一个给定深度带内的生成点。deepsea 在某些地形（shore / slope）里不存在，
  // 此时会退化为「该地形能达到的最深处」，而不是返回水线。
  function samplePoint(bandId, rngFn) {
    const r = rngFn || rng;
    let fallback = null;
    let best = null;
    for (let i = 0; i < 90; i++) {
      const x = rangeFrom(r, WORLD.x0 + 120, WORLD.x1 - 120);
      const y = rangeFrom(r, WORLD.y0 + 40, WORLD.y1 - 40);
      const d = depthAt(x, y);
      if (bandAt(d).id === bandId) return { x, y, depth: d };
      if (!fallback) fallback = { x, y, depth: d };
      if (!best || d > best.depth) best = { x, y, depth: d };
    }
    return best || fallback;
  }

  // 每种地形推荐的家（出生点 + 初始相机）。相机 clamp 由 camera 模块做，
  // 这里只给出「玩家一睁眼该看到什么」。
  function homePoint() {
    if (type === 'island') {
      return { x: p.islX, y: p.islY + 40 };
    }
    if (type === 'slope') {
      // slope 的岸线往右下扫，如果家放在左上段，一屏里几乎全是陆地（实测 60%+）。
      // 反过来解：找一个 x，让水线正好落在「世界中部偏上」，这样相机居中后
      // 上方是斜切的沙滩、下方是开阔的海 —— 这才是 slope 该有的样子。
      const target = WORLD.y0 + WORLD.h * 0.34;
      let hx = WORLD.x0 + WORLD.w * 0.5;
      for (let i = 0; i < 24; i++) {
        const sl = shoreLineAt(hx);
        if (sl > target) hx -= WORLD.w * 0.04;
        else if (sl < target - 60) hx += WORLD.w * 0.04;
        else break;
        hx = clamp(hx, WORLD.x0 + 200, WORLD.x1 - 200);
      }
      return { x: hx, y: shoreLineAt(hx) + 170 };
    }
    // shore：岸边浅水，抬头能看到沙滩
    const hx = WORLD.x0 + WORLD.w * 0.42;
    return { x: hx, y: shoreLineAt(hx) + 190 };
  }

  return {
    type,
    seedStr: opts.seed == null || opts.seed === '' ? 'shore' : String(opts.seed),
    params: p,
    shoreLineAt,
    landHeightAt,
    depthAt,
    zoneAt,
    surfaceAt,
    temperatureAt,
    isLand,
    samplePoint,
    homePoint,
    bandAt,
    bandIndexAt,
  };
}
