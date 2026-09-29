// ============================================================
//  昼夜循环（与主题正交：主题管色相，昼夜管亮度）
// ============================================================

import { TAU, mapRange } from '../core/config.js';
import { dayNight } from '../core/state.js';

export function createDayNight() {
  // 时间偏移：让首屏从明亮的正午开始（phase=0 在公式中对应深夜）
  const OFFSET = dayNight.period * 0.25;

  return {
    id: 'daynight',
    order: -1,
    update(dt, t) {
      if (!dayNight.enabled) { dayNight.sun = 1; return; }
      const p = (((t + OFFSET) / dayNight.period) % 1);
      dayNight.phase = p;
      // 0..1 循环，映射为 0(深夜) → 1(正午) → 0(深夜)
      const s = (Math.sin(p * TAU - Math.PI / 2) + 1) / 2;
      // 稍微抬高下限，避免全黑
      dayNight.sun = mapRange(s, 0, 1, 0.22, 1);
    },
  };
}

/** 依据 sun 返回当前时段 key（供 HUD 显示） */
export function phaseKey() {
  const s = dayNight.sun;
  if (s < 0.4) return 'night';
  if (s < 0.6) return 'dawn';
  if (s < 0.85) return 'noon';
  return 'noon';
}

/** 更细的四段划分 */
export function phaseKey4() {
  const p = dayNight.phase; // 0..1，0 为日出前
  // p: 0 深夜起点 -> 0.25 正午 -> 0.5 深夜 -> 0.75 正午
  const s = dayNight.sun;
  if (s < 0.38) return 'night';
  if (s < 0.62) return dayNight.phase < 0.5 ? 'dawn' : 'dusk';
  return 'noon';
}
