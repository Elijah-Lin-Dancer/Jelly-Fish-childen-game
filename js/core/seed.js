// ============================================================
//  种子系统（阶段十）
//  - 任意字符串 -> 32bit 整数（xfnv1a，等价 MC 的 String.hashCode 思路）
//  - mulberry32：可复现 PRNG（同种子 -> 同序列 -> 同世界）
//  - 蘑菇海概率 / 幻紫解锁 / 装饰散布全部从同一 PRNG 派生
//  参考：https://minecraft.wiki/w/World_seeds
// ============================================================

/** 任意字符串 -> 32bit 无符号整数（FNV-1a 变体） */
export function hashSeed(str) {
  const s = String(str == null ? '' : str);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** 可复现 PRNG（mulberry32）。输入种子 -> 返回 () => [0,1) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 由用户输入构造可复现 RNG 上下文。
 * - 非空字符串 -> 哈希为种子
 * - 空 -> 随机生成 32bit 种子（创建后应显示供抄写，MC 同款"留空随机"）
 * 返回 { seed, seedStr, rng }；seedStr 供界面显示/分享。
 */
export function makeRng(input) {
  const trimmed = (input == null ? '' : String(input)).trim();
  let seed;
  if (trimmed) {
    seed = hashSeed(trimmed);
  } else {
    seed = (Math.random() * 4294967296) >>> 0;
  }
  const seedStr = trimmed || String(seed);
  return { seed, seedStr, rng: mulberry32(seed) };
}

/** 蘑菇海：首抽 < 0.005（0.5%）→ 强制（对应 MC 蘑菇岛的"罕见"） */
export function rollMushroom(seed) {
  return mulberry32(seed >>> 0)() < 0.005;
}

// "魔法种子"表：命中则必定开出稀有伴随水母（幻紫）。
// 对应 MC 蓝美西螈"野外无法自然生成，仅特殊途径"——我们选"种子开出"。
const MAGIC_SEEDS = ['bogyo', 'lilla', 'mushroom', 'jellyfish', 'deepsea', '2025', 'ocean'];

/**
 * 幻紫（稀有伴随水母）是否解锁。
 * 命中魔法种子表，或 PRNG 另一抽 < 0.01（1%）→ 可解锁。
 */
export function rareCompanionUnlocked(seedStr) {
  const s = (seedStr == null ? '' : String(seedStr)).trim().toLowerCase();
  if (!s) return false;
  if (MAGIC_SEEDS.includes(s)) return true;
  const seed = hashSeed(s);
  return mulberry32((seed ^ 0x9e3779b9) >>> 0)() < 0.01;
}

/** 便捷：从 PRNG 取 [min,max) 浮点 */
export function rangeFrom(rng, min, max) {
  return min + (max - min) * rng();
}
