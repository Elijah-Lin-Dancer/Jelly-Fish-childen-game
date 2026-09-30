// ============================================================
//  全局可变状态单例
// ============================================================

import { QUALITY_TIERS, isMobile } from './config.js';

/** 画布尺寸（resize 时更新） */
export const view = { W: 0, H: 0 };

/** 指针状态 */
export const pointer = { x: -9999, y: -9999, active: false, down: false };

/** 当前性能等级索引 */
export const perf = { tier: 0, fps: 60, samples: [], lowStreak: 0, highStreak: 0 };

/** 当前 QUALITY 对象（随 perf.tier 变化） */
export const quality = { ...QUALITY_TIERS[isMobile ? 'mobile' : 'desktop'][0] };

export function setTier(t) {
  const table = QUALITY_TIERS[isMobile ? 'mobile' : 'desktop'];
  perf.tier = Math.max(0, Math.min(table.length - 1, t));
  Object.assign(quality, table[perf.tier]);
  return perf.tier;
}

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
