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
  x1: 3200,
  y0: -180,
  y1: 1220,
  w: 3200,
  h: 1400,
};

// 【尺寸是怎么定下来的 —— 改动前务必读这一段】
//
//   ① 相机缩放：scale = max(视口宽 / w, 视口高 / h) * GROW（见 camera.js）。
//      可见世界宽 vw = 视口宽 / scale，可见世界高 vh = 视口高 / scale。
//      相机 x 取值 [x0, max(x0, x1 - vw)]，余量 = 世界尺寸 - 可见尺寸。
//
//   ② 单靠调 w/h 无法让两个方向同时有余量：纯 max 会让约束边「恰好铺满」，
//      那条边的余量恒为 0。真正打开余量的是 GROW（>1）——
//      它把 scale 抬到两个比值之上，保证 vw < w 且 vh < h。
//
//   ③ 缩放与横移距离成反比：scale ≈ 视口宽 / w，所以 w 越大画面缩得越小、
//      横移越远。这是取舍而非 bug，实测数据（桌面 16:9，GROW=1.15）：
//
//        w=3200  缩放 0.59 ↓  横移 1036（约 1.6 屏）  ← 当前选择
//        w=5200  缩放 0.35    横移 2100（约 3 屏）
//        w=9000  缩放 0.23    横移 3435（约 5 屏）
//
//   ④ 选定 3200×1400 的理由：缩放 0.59 保住「接近 1:1 水下沉浸感」，
//      水母尺寸够大、点击互动命中容易；横移 1.6 屏配合横向为主的定位够用。
//      9000 那种俯瞰长卷虽然横移 5 屏，但水母缩成一个小点，互动体验会崩。
//
//   ⑤ 纵向 1400（h/w = 0.4375）：桌面 16:9 得 183 纵移，够表达
//      「浅滩 → 斜坡 → 深海」的层次；手机竖屏会额外获得约 150 纵移。
export const ASPECT = WORLD.w / WORLD.h;

// 水深带（按 depth 阈值划分），顺序由浅到深。
//
// 阈值按「每个带约占可见高度的 1/6」标定：桌面 16:9 的 vh ≈ 1130，
// 1130 / 6 ≈ 190，于是取 190 的递增序列 190/430/700/1030/1400。
// 这样六档在观感上是均匀递进的，而不是「浅滩一大坨、深海看不见」。
export const MAX_DEPTH = 1400;

export const BANDS = [
  { id: 'land', key: 'band.land', max: 0 },
  { id: 'beach', key: 'band.beach', max: 150 },
  { id: 'shallow', key: 'band.shallow', max: 380 },
  { id: 'nearshore', key: 'band.nearshore', max: 700 },
  { id: 'midsea', key: 'band.midsea', max: 1030 },
  { id: 'deepsea', key: 'band.deepsea', max: MAX_DEPTH },
];

// 归一化水深（0..1），供压力 / 生态 / 混色使用。
// 做 NaN 兜底：相机尚未 resize 时 vw/vh 可能是 undefined，
// 一旦 NaN 漏进 createLinearGradient 的 addColorStop 会直接抛异常。
export function depthNorm(depth) {
  if (!Number.isFinite(depth)) return 0;
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
  p.sx0 = rangeFrom(rng, WORLD.x0 - 500, WORLD.x0 - 220);
  p.sx1 = rangeFrom(rng, WORLD.x1 - 800, WORLD.x1 - 430);
  p.sy0 = rangeFrom(rng, -195, -140);
  // sy1 必须「由 sx1 反推」：先定斜率，再算出水线在世界右边缘的位置，
  // 这样无论种子怎么抽，x = WORLD.x1 处的水线都稳定落在深海区，
  // 不会出现「右侧本该是陆地高度、却在屏幕下方」的接缝。
  //
  // 斜率用「水线从左上扫到右下时，总共下降多少世界高度」来定义。
  // 这个量必须显著小于 1，否则水线从世界顶部一路扫到底部，整张图近半是陆地。
  // 0.30~0.44 时水线只在世界上部游走：左上角略高于水线（一片斜切的沙滩），
  // 右下角已深入深海，陆地占比稳定在 25~35%。
  // 用比例而不是绝对落差，是为了让世界尺寸变化时观感保持稳定。
  p.slopeSpan = rangeFrom(rng, 0.3, 0.44); // 水线跨越的高度 = WORLD.h * slopeSpan
  p.slopeA = (WORLD.h * p.slopeSpan) / (p.sx1 - p.sx0);
  p.sy1 = p.sy0 + (p.sx1 - p.sx0) * p.slopeA;

  // 岸线整体起伏（三种类型共用）
  p.shoreAmp = rangeFrom(rng, 28, 68);
  p.shoreFreq = rangeFrom(rng, 0.0016, 0.0044);
  p.shorePhase = rangeFrom(rng, 0, Math.PI * 2);

  // 沿岸滩涂宽度（陆上高度跨度）
  p.beachW = rangeFrom(rng, 95, 170);

  // shore 专用：水线基高
  p.shoreY = rangeFrom(rng, -48, 72);

  // island：中心岛的位置 / 半径
  // ⚠ 半径受「世界高度」约束，不是可见宽度。
  //   岛是圆形的，直径超过世界高之后就再也留不下「向外逐级变深」的环带：
  //   半径 780~1080 时陆地占比冲到 32~57%，出生点也被挤到世界底边。
  //   取世界高的 0.30~0.40（→ 420~560）时：岛占屏幕一小半，
  //   四周留得下沙滩 → 浅水 → 近岸 → 外海 → 深渊的完整环带。
  //   （早期 430~590 看着接近这个区间，但当时世界高只有 1120，
  //     换算到 1400 高的世界应该同比放大，这里就按绝对占比重新标定。）
  p.islX = rangeFrom(rng, WORLD.x0 + WORLD.w * 0.35, WORLD.x0 + WORLD.w * 0.65);
  p.islY = rangeFrom(rng, WORLD.y0 + WORLD.h * 0.18, WORLD.y0 + WORLD.h * 0.30);
  p.islR = rangeFrom(rng, WORLD.h * 0.3, WORLD.h * 0.4);
  p.islWobble = rangeFrom(rng, 0.1, 0.26);

  // 通用相位
  p.nPhase = rangeFrom(rng, 0, 1000);
  p.tempWob = rangeFrom(rng, 0.05, 0.16);
  p.ridgeFreq = rangeFrom(rng, 0.0012, 0.0022);

  // 把「水线 y 随 x 变化」的斜率归一化到世界坐标 —— 这样任意等比例缩放的
  // 坐标系下岸线倾角都一致。注意岸线粗细必须用与方向无关的常量（SLOPE_BAND），
  // 不能用 p.sy1 - p.sy0，否则近乎垂直的岸线会被归一化抹平。
  const slopeA = p.slopeA;
  // 沿岸线性过渡带的厚度。必须用与方向无关的常量，不能用 p.sy1 - p.sy0，
  // 否则近乎垂直的岸线会被归一化抹平（整条岸线退化成沙滩）。
  const SLOPE_BAND = 300;

  function shoreBaseAt(x) {
    if (type === 'slope') return p.sy0 + (x - p.sx0) * slopeA;
    if (type === 'island') return p.islY;
    return p.shoreY;
  }

  // 水线：给定 x 返回该处水线的 worldY
  function shoreLineAt(x) {
    const base = shoreBaseAt(x);
    const wob = Math.sin(x * p.shoreFreq + p.shorePhase) * p.shoreAmp;
    const detail = fbm1(x * 0.0016 + p.nPhase, 3) * 46;
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
    const dune = fbm1(x * 0.002 + p.nPhase * 1.7, 3) * 40 * t;
    // 上限 240：不封顶的话 slope 型会在岸上长出一堵贯穿整个视口的土墙。
    // 这个值同时保证 y0=-180 到水线之间始终留得下一段完整沙滩。
    return clamp(Math.max(0, h + dune), 0, 240);
  }

  // —— 浅水剖面：水线处 depth = 0，往外平滑加深，最终饱和到 MAX_DEPTH ——
  // 用两段指数而不是幂函数：幂函数在远离岸线处会顶到 7000+，
  // 整张图 2/3 掉进 deepsea，变成「要么陆地要么深渊」。
  // 特征长度（300 / 1200）决定「走多远才变深」；
  // 振幅之和 1520 略高于 MAX_DEPTH 1400，保证「走得足够远才真的进深渊」。
  function shelfDepth(d) {
    return 520 * (1 - Math.exp(-d / 300)) + 1000 * (1 - Math.exp(-d / 1200));
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
    const dune = fbm1(x * 0.003 + p.nPhase * 1.7, 3) * 36 * dome;
    return -(230 * dome + dune) - 6;
  }

  // 海床起伏（颗粒），只加在水下
  function ridgeNoise(x, y) {
    return fbm1(x * p.ridgeFreq + p.nPhase, 3) * 40 + fbm1(y * 0.0021 + p.nPhase * 2.3, 2) * 30;
  }

  // 水深核心。非有限输入一律返回 0（水线），避免 NaN 顺着渲染管线扩散 ——
  // 相机未初始化、实体坐标尚未赋值时都可能传进 NaN。
  function depthAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    if (type === 'island') {
      const inside = islandInside(x, y);
      if (inside !== null) return inside;
      const dx = x - p.islX;
      const dy = y - p.islY;
      const r = Math.sqrt(dx * dx + dy * dy);
      const d = r - islandEdge(x, y);
      // 系数 1.0：岛外每 1000 世界单位才深一档。
      // 旧的 2.4 是按世界高 1120 定的，在 3600 的世界里会让岛半径还没走完
      // 就撞进深渊（实测 46~51% 是 deepsea），环带薄得像一条线。
      return clamp(shelfDepth(d) + ridgeNoise(x, y), 0, MAX_DEPTH);
    }

    if (type === 'slope') {
      const raw = y - shoreLineAt(x);
      if (raw < 0) return -landHeightAt(x, y) - 6;
      // 沿岸带内用线性过渡（避免噪声把水线打成毛边），带外接指数剖面
      const band = clamp(raw / SLOPE_BAND, 0, 1);
      const linear = raw * 0.5;
      // 0.5 = 沿岸带内的线性斜率（比指数剖面陡），保证刚离开沙滩就有明确变深感
      return clamp(lerp(linear, shelfDepth(raw), band) + ridgeNoise(x, y) * band, 0, MAX_DEPTH);
    }

    // shore：顶部一条横贯沙滩，往下逐深 —— 经典海湾
    const sl = shoreLineAt(x);
    if (y < sl) return -landHeightAt(x, y) - 6;
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
  //
  // ⚠ 出生点要表达的是「水线出现在可见区的哪个高度」，所以偏移量必须按
  // 可见高度来算，不能写死常数。曾经写死 700，在 3600 高的世界里相机居中后
  // 水线被顶到屏幕最上沿，沙滩整片跑出画面（首屏看不到岸）。
  // 现在的做法：把 y 定在「水线往下 SHORE_DROP」，再由相机居中，
  // 水线自然落在可见区偏上的位置。
  const SHORE_DROP = 250;

  function homePoint() {
    if (type === 'island') {
      // 站到岛的「下缘」外侧（y 方向 +R 越过岛缘），这样视野里上方是岛的沙滩、
      // 下方是向外逐级变深的环带。若把家放在岛心（p.islY），整屏都是陆地。
      return { x: p.islX, y: p.islY + p.islR + SHORE_DROP * 0.4 };
    }
    if (type === 'slope') {
      // slope 的岸线往右下扫，如果家放在左上段，一屏里几乎全是陆地。
      // 反过来解：找一个 x，让水线正好落在「可见区上部」，这样相机居中后
      // 上方是斜切的沙滩、下方是开阔的海 —— 这才是 slope 该有的样子。
      const target = WORLD.y0 + WORLD.h * 0.30;
      let hx = WORLD.x0 + WORLD.w * 0.5;
      for (let i = 0; i < 24; i++) {
        const sl = shoreLineAt(hx);
        if (sl > target) hx -= WORLD.w * 0.04;
        else if (sl < target - 180) hx += WORLD.w * 0.04;
        else break;
        hx = clamp(hx, WORLD.x0 + 200, WORLD.x1 - 200);
      }
      return { x: hx, y: shoreLineAt(hx) + SHORE_DROP };
    }
    // shore：岸边浅水，抬头能看到沙滩
    const hx = WORLD.x0 + WORLD.w * 0.42;
    return { x: hx, y: shoreLineAt(hx) + SHORE_DROP };
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
