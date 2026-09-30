// ============================================================
//  海域系统（阶段七）
//  - 三片海域：shallow / midnight / abyss
//  - 解锁靠"正向累积"（发现物种 / 繁育次数），不靠失败
//  - 提供 tint（色调）/ haze（景深）/ rays（光柱）供背景与景深读取
// ============================================================

import { clamp } from '../core/config.js';

export const ZONES = [
  {
    id: 'shallow',
    label: 'zone.shallow',
    tint: [0, 0, 0],          // 相对基色的 RGB 偏移
    haze: 1.0,
    rays: 1.0,
    // 门槛：无
    need: null,
  },
  {
    id: 'midnight',
    label: 'zone.midnight',
    tint: [-34, -18, 26],     // 更冷、更暗蓝
    haze: 0.7,
    rays: 0.35,
    need: (s) => s.speciesFound >= 3 && s.breeds >= 3,
  },
  {
    id: 'abyss',
    label: 'zone.abyss',
    tint: [-58, -30, 40],
    haze: 0.42,
    rays: 0.12,
    need: (s) => s.speciesFound >= 5 && s.breeds >= 8,
  },
];

export function createZones(explore, stats) {
  let current = 'shallow';
  // 平滑插值的当前色调
  const cur = { tint: [0, 0, 0], haze: 1, rays: 1, target: null, t: 1 };
  // 阶段十：世界（群系）基色叠加层，由 main 注入 createWorld 实例
  let worldProvider = null;

  function zoneById(id) { return ZONES.find((z) => z.id === id) || ZONES[0]; }

  /** 注入世界（群系）provider；其 baseTint/haze/rays 会叠加在深度海域之上 */
  function setWorldProvider(w) { worldProvider = w; }

  function worldTint() {
    if (!worldProvider) return [0, 0, 0];
    const t = worldProvider.baseTint;
    return Array.isArray(t) ? t : [0, 0, 0];
  }

  /** 找到当前最高可解锁的海域（按顺序） */
  function evaluate() {
    let best = 'shallow';
    for (const z of ZONES) {
      if (!z.need) continue;
      const ok = z.need(stats);
      const unlocked = explore.hasZone(z.id);
      if (ok && !unlocked) {
        explore.unlockZone(z.id);
      }
      if (ok || unlocked) best = z.id;
    }
    return best;
  }

  function setZone(id, instant = false) {
    const z = zoneById(id);
    current = z.id;
    cur.target = z;
    if (instant) {
      cur.tint = z.tint.slice();
      cur.haze = z.haze; cur.rays = z.rays; cur.t = 1;
    } else {
      cur.t = 0;
    }
    return current;
  }

  function update(dt) {
    if (!cur.target || cur.t >= 1) return;
    cur.t = Math.min(1, cur.t + dt / 1200);   // 约 1.2s 过渡
    const z = cur.target;
    for (let i = 0; i < 3; i++) {
      cur.tint[i] += (z.tint[i] - cur.tint[i]) * 0.08;
    }
    cur.haze += (z.haze - cur.haze) * 0.08;
    cur.rays += (z.rays - cur.rays) * 0.08;
  }

  return {
    get list() { return ZONES; },
    get current() { return current; },
    get label() { return zoneById(current).label; },
    zoneById,
    evaluate,
    setZone,
    setWorldProvider,
    update,
    /**
     * 供背景 / 景深读取（深度海域插值 + 群系基色叠加）。
     * 返回合并后的色调；haze/rays 亦相乘。
     */
    get tint() {
      const w = worldTint();
      return [cur.tint[0] + w[0], cur.tint[1] + w[1], cur.tint[2] + w[2]];
    },
    get haze() {
      const wm = worldProvider ? (worldProvider.haze || 1) : 1;
      return clamp(cur.haze * wm, 0, 1.6);
    },
    get rays() {
      const wm = worldProvider ? (worldProvider.rays || 1) : 1;
      return clamp(cur.rays * wm, 0, 1.4);
    },
  };
}
