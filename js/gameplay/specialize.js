// ============================================================
//  专长系统（阶段六 · 4.4）
//  - 三系专长，各 3 级，用生物荧光购买
//  - 等级影响：经济产出倍率、繁育突变概率、图鉴/成就加成
//  存储：localStorage 'ocean.spec'
// ============================================================

const STORAGE_KEY = 'ocean.spec';

/** 专长定义（data 驱动） */
export const SPECIALIZATIONS = [
  {
    id: 'breeder',
    icon: '🧬',
    label: 'spec.breeder',
    desc: 'spec.breeder.desc',
    costs: [40, 90, 180],   // 每级花费
  },
  {
    id: 'explorer',
    icon: '💠',
    label: 'spec.explorer',
    desc: 'spec.explorer.desc',
    costs: [40, 90, 180],
  },
  {
    id: 'collector',
    icon: '📖',
    label: 'spec.collector',
    desc: 'spec.collector.desc',
    costs: [40, 90, 180],
  },
];

const MAX_LEVEL = 3;

function load() {
  const def = { breeder: 0, explorer: 0, collector: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const d = JSON.parse(raw);
    return Object.assign(def, d && typeof d === 'object' ? d : {});
  } catch (e) {
    return def;
  }
}

export function createSpecialize(economy, onLevelUp) {
  const levels = load();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(levels)); } catch (e) { /* 忽略 */ }
  }

  function levelOf(id) { return levels[id] || 0; }

  /** 经济产出倍率：explorer 每级 +15% */
  function multiplier() { return 1 + levelOf('explorer') * 0.15; }

  /** 繁育突变概率加成：breeder 每级 +6% */
  function mutateBonus() { return levelOf('breeder') * 0.06; }

  return {
    get list() { return SPECIALIZATIONS; },
    levelOf,
    multiplier,
    mutateBonus,
    get total() { return Object.values(levels).reduce((a, b) => a + b, 0); },

    /** 是否可升下一级 */
    canUpgrade(id) {
      const def = SPECIALIZATIONS.find((s) => s.id === id);
      if (!def) return false;
      const lv = levelOf(id);
      return lv < MAX_LEVEL && economy.bio >= def.costs[lv];
    },

    /** 花费生物荧光升一级 */
    upgrade(id) {
      const def = SPECIALIZATIONS.find((s) => s.id === id);
      if (!def) return false;
      const lv = levelOf(id);
      if (lv >= MAX_LEVEL) return false;
      const cost = def.costs[lv];
      if (!economy.spend(cost)) return false;
      levels[id] = lv + 1;
      persist();
      if (onLevelUp) onLevelUp(id, levels[id]);
      return true;
    },

    reset() {
      levels.breeder = 0; levels.explorer = 0; levels.collector = 0;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    },
  };
}
