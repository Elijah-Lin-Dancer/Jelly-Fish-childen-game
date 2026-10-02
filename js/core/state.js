// ============================================================
//  全局可变状态单例
// ============================================================

import { QUALITY_TIERS, isMobile } from './config.js';

/** 画布尺寸（resize 时更新） */
export const view = { W: 0, H: 0 };

/** 指针状态 */
export const pointer = { x: -9999, y: -9999, active: false, down: false };

// ============================================================
//  相机（Phase 11 开放世界）
// ------------------------------------------------------------
//  世界坐标 → 屏幕坐标： screen = (world - camera) * scale
//  世界尺寸 3200 × 4000（见 terrain.js 的 WORLD），做法是「把世界当视口铺满」——
//  scale = max(view.W / WORLD.w, view.H / WORLD.h)，保证世界永远填满窗口、
//  不露黑边；相机被夹在 [0, WORLD.w - view.W/scale] 内。
//  这样地形的所有常数都与分辨率无关，手机 / 桌面得到的是同一个世界。
// ============================================================
export const camera = {
  x: 0,
  y: 0,
  tx: 0, // 缓动目标
  ty: 0,
  scale: 1,
  // 可见世界宽高。必须在这里就给初值 —— 相机 resize 之前任何读取
  // 拿到 undefined 都会把 NaN 带进渲染管线。
  vw: 6000,
  vh: 1120,
  /** 拖视角期间为 true（实体据此决定是否追指针） */
  dragging: false,
};

/** 键盘移动意图（-1..1），由 main.js 的键盘监听写入 */
export const camInput = { x: 0, y: 0 };
// 触屏虚拟摇杆的轴向输入（与键盘 camInput 并存，相机每帧把二者合成）。
// 键盘设 camInput，摇杆设 touchAxis，互不打断。
export const touchAxis = { x: 0, y: 0 };

// ---- 坐标换算（数据版）----
// 实体需要「屏幕 → 世界」换算，但它们不该依赖 camera 实例（会引入循环依赖，
// 也让实体难以在无相机的环境里单测）。这几个纯函数只读 camera 的字段。
export function screenToWorldX(sx) {
  const sc = camera.scale || 1;
  return sx / sc + camera.x;
}
export function screenToWorldY(sy) {
  const sc = camera.scale || 1;
  return sy / sc + camera.y;
}
export function screenToWorld(sx, sy) {
  return { x: screenToWorldX(sx), y: screenToWorldY(sy) };
}
/** 「半径换算」：屏幕上 R 像素对应多少世界单位 */
export function screenRadius(r) {
  return r / (camera.scale || 1);
}

/** 相机平移速度（世界单位 / 秒） */
export const CAM_SPEED = 620;

/** 缓动速率：越大越跟手 */
export const CAM_EASE = 9;

/** 边界阻尼强度（0..1）：越大越硬 */
export const CAM_DAMP = 0.86;

/** 当前性能等级索引 */
export const perf = { tier: 0, fps: 60, samples: [], lowStreak: 0, highStreak: 0 };

// ============================================================
//  生物密度（玩家可调，与画质解耦）
// ------------------------------------------------------------
//  【为什么从画质里拆出来】原先「生物数量」是画质档位的副产物 ——
//  低画质 = 少水母。问题是玩家不知道这件事：觉得卡顿的人会去调
//  「画质」，但看到的是光效变化，容易以为「调了没用」；
//  而想要热闹的玩家在低配机上永远看不到密集的鱼群。
//  现在两个杠杆各管各的：
//      画质档位  = 光效 / 粒子 / 光束（渲染开销）
//      密度系数  = 水母 / 鱼群 / 浮游 / 海草 / 岸上元素（实体数量）
//
//  【作用方式】setTier 先把档位基数写进 quality，再乘以本系数。
//  这样「自动降档」只动画质、不动密度（玩家的选择被尊重），
//  三档系数 ×0.5 / ×1.0 / ×1.5 覆盖「省电」到「热闹」。
// ============================================================
export const DENSITY_TIERS = [
  { key: 'sparse', mult: 0.5 },   // 稀疏 —— 弱机 / 想安静看海
  { key: 'normal', mult: 1.0 },   // 标准（默认）
  { key: 'busy', mult: 1.5 },     // 热闹 —— 鱼群满屏
];

export const density = { index: 1 };   // 默认「标准」
/** 只影响实体数量的那些键（渲染开销类的键不参与缩放） */
const DENSITY_KEYS = ['jellyfish', 'fishSchools', 'fishPerSchool', 'plankton', 'bubbles', 'seaweed', 'life'];

/** 当前 QUALITY 对象（随 perf.tier 与 density 变化） */
export const quality = { ...QUALITY_TIERS[isMobile ? 'mobile' : 'desktop'][0] };

/** 把「档位基数 × 密度系数」写进 quality。改画质或改密度后都要调用。 */
function applyQuality() {
  const table = QUALITY_TIERS[isMobile ? 'mobile' : 'desktop'];
  const base = table[Math.max(0, Math.min(table.length - 1, perf.tier))];
  const mult = DENSITY_TIERS[Math.max(0, Math.min(DENSITY_TIERS.length - 1, density.index))].mult;
  Object.assign(quality, base);
  for (const k of DENSITY_KEYS) {
    if (typeof quality[k] === 'number') {
      // 水母这类核心实体至少留 1 只，否则「空海」看着像坏了
      quality[k] = k === 'jellyfish' ? Math.max(1, Math.round(quality[k] * mult)) : quality[k] * mult;
    }
  }
  return quality;
}

export function setTier(t) {
  const table = QUALITY_TIERS[isMobile ? 'mobile' : 'desktop'];
  perf.tier = Math.max(0, Math.min(table.length - 1, t));
  applyQuality();
  return perf.tier;
}

/** 设置生物密度档（0 稀疏 / 1 标准 / 2 热闹）。返回当前档位。 */
export function setDensity(idx) {
  density.index = Math.max(0, Math.min(DENSITY_TIERS.length - 1, idx));
  applyQuality();
  return density.index;
}

export { applyQuality };

/** 主题：shallow（阳光浅海） / deep（深邃夜潜） */
export const THEMES = {
  shallow: {
    bg: ['#1e8fc4', '#1067a0', '#082f5c', '#04182f'],
    rayAlpha: 0.22,
    rayColor: 'rgba(190, 240, 255, ALPHA)',
    glowScale: 2.5,
    glowBoost: 0.5,
    topLight: 0.18,
    haze: 0.06,
    tint: [10, 70, 120], // 暗化叠加色
  },
  deep: {
    bg: ['#0a3a6b', '#062548', '#03162f', '#010814'],
    rayAlpha: 0.06,
    rayColor: 'rgba(180, 230, 255, ALPHA)',
    glowScale: 2.4,
    glowBoost: 0.55,
    topLight: 0.12,
    haze: 0.03,
    tint: [2, 10, 28],
  },
};

export const theme = {
  name: 'shallow',
  get current() { return THEMES[this.name]; },
  toggle() { this.name = this.name === 'shallow' ? 'deep' : 'shallow'; return this.name; },
};

/** 昼夜：dayPhase 0..1，sun 0(深夜)..1(正午)
 *  初始 phase=0 对应 sun 峰值附近，让用户从明亮的白天开始 */
export const dayNight = { enabled: true, phase: 0.25, sun: 1, period: 60000 };

/** 图鉴收集：found 保持 Set 兼容旧逻辑；records 存每物种详情 */
export const collection = { found: new Set(), total: 6, celebrated: false, records: null };

/** 语言 */
export const app = { lang: 'en' };
