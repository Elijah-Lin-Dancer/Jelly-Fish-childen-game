// ============================================================
//  生态系统（阶段五 · 4.2）
//  - 浮游 → 鱼群 → 水母 的轻食物链联动
//  - 持有温和大鱼，统一调度其 AI（玩家洋流可把它推开）
//  - 大鱼首次靠近水母群时，onEvent 提示一次
// ============================================================

import { BigFish } from '../entities/bigfish.js';

export function createEcosystem({ plankton, schools, jellyfish, current, onEvent, getMode, onSnatch, isSheltered } = {}) {
  const bigFish = new BigFish(getMode ? (getMode() === 'adventure' ? 'adventure' : 'peace') : 'peace');
  let announced = false;
  let prevNear = false;
  let announcedHunt = false;

  function nearestPlankton(x, y) {
    let best = null, bestD = Infinity;
    for (const p of plankton) {
      const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = p; }
    }
    return best;
  }

  function nearestSchool(x, y) {
    let best = null, bestD = Infinity;
    for (const s of schools) {
      const dx = s.cx - x, dy = s.cy - y, d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = s; }
    }
    return best;
  }

  function update(dt, t) {
    const dtScale = dt / 16.667;

    // 1) 浮游 → 鱼群：把鱼群漫游中心缓慢拉向最近浮游（复用 FishSchool 的"绕中心"力）
    for (const s of schools) {
      const pk = nearestPlankton(s.cx, s.cy);
      if (pk) {
        const k = 0.02 * dtScale;
        s.cx += (pk.x - s.cx) * k;
        s.cy += (pk.y - s.cy) * k;
      }
    }

    // 2) 鱼群 → 水母：水母朝最近鱼群轻微聚集（食物链视觉）
    for (const j of jellyfish) {
      const sc = nearestSchool(j.x, j.y);
      if (sc) {
        const dx = sc.cx - j.x, dy = sc.cy - j.y, d = Math.hypot(dx, dy) || 1;
        if (d < 380) {
          const f = (1 - d / 380) * 0.02 * dtScale;
          j.vx += (dx / d) * f;
          j.vy += (dy / d) * f;
        }
      }
    }

    // 3) 大鱼 AI（读取 current → 可被玩家洋流推开）；模式决定温和 / 掠食
    if (getMode) bigFish.setMode(getMode() === 'adventure' ? 'adventure' : 'peace');
    bigFish.update(dt, t, jellyfish, current, { onSnatch, isSheltered });

    // 4) 首次靠近水母群 → 提示一次（分模式文案）
    if (bigFish.nearJellies && !prevNear && !announced) {
      announced = true;
      if (onEvent) onEvent('eco.bigfish');
    }
    prevNear = bigFish.nearJellies;

    // 5) 冒险模式：首次进入捕猎状态 → 提示一次
    if (bigFish.isPredator && bigFish.hunting > 0.3 && !announcedHunt) {
      announcedHunt = true;
      if (onEvent) onEvent('adventure.hunt');
    }

    return true;
  }

  function draw(ctx) {
    bigFish.draw(ctx);
  }

  return {
    update, draw,
    get bigFish() { return bigFish; },
  };
}
