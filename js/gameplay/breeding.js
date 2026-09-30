// ============================================================
//  基因繁育（阶段六 · 4.3）
//  - 两只成年水母靠近时结合，产下继承父母性状的后代
//  - 配色 50/50 继承，可低频杂交出第三种色
//  - 性状突变概率由专长（specialize.mutateBonus）提升
//  - 每只水母繁育后有冷却，避免刷屏
// ============================================================

import { Jellyfish, JELLY_PALETTES } from '../entities/jellyfish.js';
import { inheritTraits, traitLevel } from './genes.js';
import { rand } from '../core/config.js';

const BREED_DIST = 62;        // 触发距离（像素）
const COOLDOWN = 9000;        // ms
const HYBRID_CHANCE = 0.12;   // 生出第三种配色
const MAX_PER_CHECK = 1;      // 每次检测最多发生一次繁育

export function createBreeding({ jellyfish, cap, onBreed, getMutateBonus }) {
  let lastCheck = 0;

  /** 成年判定：成长到位且非蛋水母；隐藏纪念水母不参与繁育 */
  function isAdult(j) {
    return j && !j.egg && !j.isMemory && j.scale >= 0.99 && j.age > 1500;
  }

  function pickPalette(a, b) {
    // 低频杂交：取一个不同于父母的第三种色
    if (Math.random() < HYBRID_CHANCE) {
      let idx = a.paletteIndex;
      let guard = 0;
      while ((idx === a.paletteIndex || idx === b.paletteIndex) && guard++ < 12) {
        idx = (Math.random() * JELLY_PALETTES.length) | 0;
      }
      return { idx, hybrid: true };
    }
    return { idx: Math.random() < 0.5 ? a.paletteIndex : b.paletteIndex, hybrid: false };
  }

  function update(dt) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - lastCheck < 1200) return;   // 节流：约 1.2s 检测一次
    lastCheck = now;

    const n = jellyfish.length;
    if (n < 2) return;
    if (cap && n >= cap) return;          // 达上限不再繁育

    let bred = 0;
    for (let i = 0; i < n && bred < MAX_PER_CHECK; i++) {
      const a = jellyfish[i];
      if (!isAdult(a) || now - (a.lastBredAt || 0) < COOLDOWN) continue;
      for (let k = i + 1; k < n; k++) {
        const b = jellyfish[k];
        if (!isAdult(b) || now - (b.lastBredAt || 0) < COOLDOWN) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy > BREED_DIST * BREED_DIST) continue;

        // 结合
        const bonus = getMutateBonus ? getMutateBonus() : 0;
        const { idx, hybrid } = pickPalette(a, b);
        const { traits, mutated } = inheritTraits(a.traits, b.traits, 0.15 + bonus);

        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const child = new Jellyfish(cx, cy, idx, { juvenile: true, genes: traits });
        child.hybrid = hybrid;
        jellyfish.push(child);

        a.lastBredAt = now;
        b.lastBredAt = now;
        child.lastBredAt = now;   // 子代长大前不参与

        if (onBreed) onBreed(child, {
          hybrid,
          mutated,
          parents: [a, b],
          // 供 UI 展示的质量分（性状等级之和）
          quality: mutated.length + (hybrid ? 2 : 0) +
            traitLevel(traits.glow) + traitLevel(traits.tentacles),
        });
        bred++;
        break;
      }
    }
  }

  return { update, isAdult };
}
