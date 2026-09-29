// ============================================================
//  撒饵喂食系统
//  饵料上限 8，避免 O(n*m) 爆炸
// ============================================================

import { Bait } from '../entities/env.js';

const MAX_BAIT = 8;

export function createFeeding(baits, onDrop) {
  let feedMode = false;

  return {
    get mode() { return feedMode; },

    toggle() {
      feedMode = !feedMode;
      return feedMode;
    },

    setMode(v) {
      feedMode = !!v;
      return feedMode;
    },

    /** 投放一枚饵料 */
    drop(x, y) {
      if (baits.length >= MAX_BAIT) baits.shift();
      const b = new Bait(x, y);
      baits.push(b);
      if (onDrop) onDrop(x, y);
      return b;
    },

    /** 取距实体最近的饵料（供聚集力使用） */
    nearest(x, y) {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < baits.length; i++) {
        const b = baits[i];
        const dx = b.x - x, dy = b.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = b; }
      }
      return best;
    },

    /** 鱼群靠近时消耗饵料，营造"抢食" */
    consume(bait, amount) {
      if (!bait) return;
      bait.consumed = Math.min(1, bait.consumed + amount);
    },

    get count() { return baits.length; },
  };
}
