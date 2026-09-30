// ============================================================
//  生物荧光经济（阶段六 · 4.4）
//  - 资源「生物荧光」产出 / 消费 / 持久化
//  - 产出倍率由专长（specialize）注入
//  存储：localStorage 'ocean.economy'
// ============================================================

const STORAGE_KEY = 'ocean.economy';

function loadState() {
  const def = { bio: 0, baseCap: 999, earned: 0, spent: 0, unlocked: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const d = JSON.parse(raw);
    return Object.assign(def, d && typeof d === 'object' ? d : {});
  } catch (e) {
    return def;
  }
}

export function createEconomy({ getMultiplier, onGain } = {}) {
  const state = loadState();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }

  function cap() {
    // 上限随专长倍率提升
    const mult = getMultiplier ? Math.max(1, getMultiplier()) : 1;
    return Math.round(state.baseCap * mult);
  }

  return {
    /** 获得生物荧光（自动乘专长倍率，受上限钳制） */
    gain(amount) {
      if (!(amount > 0)) return 0;
      const mult = getMultiplier ? Math.max(1, getMultiplier()) : 1;
      const add = amount * mult;
      state.bio = Math.min(cap(), state.bio + add);
      state.earned += add;
      persist();
      if (onGain) onGain(add, state.bio);
      return add;
    },

    /** 花费生物荧光；余额不足返回 false */
    spend(amount) {
      if (!(amount > 0) || state.bio < amount) return false;
      state.bio -= amount;
      state.spent += amount;
      persist();
      return true;
    },

    /** 解锁项（记录到 unlocked，避免重复购买） */
    unlock(id, cost) {
      if (state.unlocked[id]) return false;
      if (!this.spend(cost)) return false;
      state.unlocked[id] = Date.now();
      persist();
      return true;
    },

    hasUnlock(id) { return !!state.unlocked[id]; },

    get bio() { return Math.floor(state.bio); },
    get earned() { return Math.floor(state.earned); },
    get spent() { return Math.floor(state.spent); },
    get cap() { return cap(); },

    reset() {
      state.bio = 0; state.earned = 0; state.spent = 0; state.unlocked = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    },
  };
}
