// ============================================================
//  每日稀有客
//  - 用日期作为种子，确定性地挑出"今日稀有配色"
//  - 同一天内所有玩家/刷新结果一致（可复现）
// ============================================================

import { JELLY_PALETTES } from '../entities/jellyfish.js';

/** 今日日期键 yyyymmdd */
export function dayKey(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** 简单字符串哈希（FNV-1a 变体），稳定可复现 */
function hash(n) {
  let h = 2166136261;
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 今日稀有配色的索引 */
export function dailyRareIndex(d = new Date()) {
  const k = dayKey(d);
  return hash(k) % JELLY_PALETTES.length;
}

/** 给定 paletteIndex 是否就是今日稀有 */
export function isDailyRare(paletteIndex, d = new Date()) {
  return paletteIndex === dailyRareIndex(d);
}
