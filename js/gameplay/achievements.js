// ============================================================
//  成就系统
//  - data 驱动：新增成就只需在 ACHIEVEMENTS 里加一条
//  - onUnlock 决定何时解锁（依赖 stats / 事件）
//  - 进度存 localStorage 'ocean.ach' = { id: unlockedAt }
// ============================================================

const STORAGE_KEY = 'ocean.ach';

/**
 * 成就定义
 * @param stats 运行时统计（见 createAchievements 的 stats 参数）
 * @param ctx   事件上下文（如 { type:'dex' } / { type:'mutation' } / { type:'phase', key:'night' }）
 */
export const ACHIEVEMENTS = [
  {
    id: 'first_mutate',
    icon: '🧬',
    label: 'ach.first_mutate',
    desc: 'ach.first_mutate.desc',
    test: (s, ctx) => s.mutations >= 1,
  },
  {
    id: 'dex_done',
    icon: '📖',
    label: 'ach.dex_done',
    desc: 'ach.dex_done.desc',
    test: (s) => s.speciesFound >= s.speciesTotal,
  },
  {
    id: 'breeder',
    icon: '🌱',
    label: 'ach.breeder',
    desc: 'ach.breeder.desc',
    test: (s) => s.summoned >= 30,
  },
  {
    id: 'midnight',
    icon: '🌙',
    label: 'ach.midnight',
    desc: 'ach.midnight.desc',
    test: (s, ctx) => ctx && ctx.type === 'unlock' && ctx.phase === 'night',
  },
  {
    id: 'summoner',
    icon: '✨',
    label: 'ach.summoner',
    desc: 'ach.summoner.desc',
    test: (s) => s.summoned >= 25,
  },
  {
    id: 'feeder',
    icon: '🫧',
    label: 'ach.feeder',
    desc: 'ach.feeder.desc',
    test: (s) => s.fed >= 50,
  },
];

export function createAchievements(onUnlock) {
  /** 已解锁：{ id: unlockedAt } */
  let unlocked = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d === 'object') unlocked = d;
    }
  } catch (e) { /* 忽略 */ }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked)); } catch (e) { /* 忽略 */ }
  }

  /**
   * 评估所有成就；新解锁的会触发 onUnlock
   * @param stats 统计对象
   * @param ctx   可选事件上下文
   */
  function check(stats, ctx) {
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (unlocked[a.id]) continue;
      let ok = false;
      try { ok = !!a.test(stats, ctx); } catch (e) { ok = false; }
      if (ok) {
        unlocked[a.id] = Date.now();
        newly.push(a);
      }
    }
    if (newly.length) {
      persist();
      if (onUnlock) newly.forEach((a) => onUnlock(a));
    }
    return newly;
  }

  function has(id) { return !!unlocked[id]; }

  function unlockedAt(id) { return unlocked[id] || 0; }

  return {
    check,
    has,
    unlockedAt,
    get count() { return Object.keys(unlocked).length; },
    get total() { return ACHIEVEMENTS.length; },
    get list() { return ACHIEVEMENTS; },
    reset() {
      unlocked = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    },
  };
}
