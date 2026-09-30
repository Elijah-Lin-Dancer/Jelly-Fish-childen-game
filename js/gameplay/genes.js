// ============================================================
//  基因模型（阶段六 · 4.3）
//  - 性状：size 体型 / glow 辉光 / speed 游速 / tentacles 触须
//  - 每项 0..1 归一化，展示时映射为等级 1..5
//  - 与 paletteIndex 共同构成个体表型
// ============================================================

import { rand, clamp } from '../core/config.js';

export const TRAITS = ['size', 'glow', 'speed', 'tentacles'];

/** 随机性状（自然生成 / 无基因时） */
export function randomTraits() {
  return {
    size: rand(0.35, 0.7),
    glow: rand(0.35, 0.7),
    speed: rand(0.35, 0.7),
    tentacles: rand(0.35, 0.7),
  };
}

/** 归一化 + 兜底 */
export function normalizeTraits(t) {
  const out = {};
  for (const k of TRAITS) {
    const v = t && typeof t[k] === 'number' ? t[k] : 0.5;
    out[k] = clamp(v, 0, 1);
  }
  return out;
}

/** 0..1 -> 1..5 等级（供图鉴展示） */
export function traitLevel(v) {
  return Math.max(1, Math.min(5, Math.round(clamp(v, 0, 1) * 4) + 1));
}

/** 序列化为紧凑数组（存档用） */
export function serializeTraits(t) {
  const g = normalizeTraits(t);
  return TRAITS.map((k) => +g[k].toFixed(2));
}

/** 从紧凑数组恢复 */
export function deserializeTraits(arr) {
  if (!Array.isArray(arr) || arr.length !== TRAITS.length) return randomTraits();
  const out = {};
  TRAITS.forEach((k, i) => { out[k] = clamp(+arr[i] || 0.5, 0, 1); });
  return out;
}

/**
 * 子代性状：每个性状继承父母之一，并有 mutateChance 概率发生突变
 * @returns { traits, mutated:[trait...] }
 */
export function inheritTraits(a, b, mutateChance = 0.15, mutateAmount = 0.16) {
  const out = {};
  const mutated = [];
  for (const k of TRAITS) {
    let v = Math.random() < 0.5 ? a[k] : b[k];
    // 取父母均值 + 抖动，让子代落在两者之间略微浮动
    v = v * 0.7 + ((a[k] + b[k]) / 2) * 0.3;
    if (Math.random() < mutateChance) {
      v += rand(-mutateAmount, mutateAmount) * (Math.random() < 0.5 ? 1 : -1);
      mutated.push(k);
    }
    out[k] = clamp(v, 0, 1);
  }
  return { traits: out, mutated };
}
