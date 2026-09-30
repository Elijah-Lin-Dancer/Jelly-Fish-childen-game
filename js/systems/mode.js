// ============================================================
//  模式系统（阶段八 · 8A）
//  - 两种调性：peace（和平，0 压力）/ adventure（冒险，风险回报）
//  - 仅在新存档引导时由玩家选定，之后锁死（决策 2：每存档独立）
//  - mode 持久化在池塘存档元数据里（见 gameplay/save.js）
// ============================================================

export const MODES = ['peace', 'adventure'];
export const DEFAULT_MODE = 'peace';

export function createMode({ onMode } = {}) {
  // 默认和平：最安全的调性，也保证老存档行为不变
  let mode = DEFAULT_MODE;

  function isMode(m) { return m === 'peace' || m === 'adventure'; }

  return {
    get current() { return mode; },
    isPeace() { return mode === 'peace'; },
    isAdventure() { return mode === 'adventure'; },

    /** 玩家选定（仅新存档引导时调用），触发 onMode */
    set(m) {
      if (!isMode(m) || m === mode) return mode;
      mode = m;
      if (onMode) onMode(mode);
      return mode;
    },

    /** 从存档恢复（不触发 onMode 的"切换"语义） */
    restore(m) {
      if (isMode(m)) mode = m;
      return mode;
    },

    serialize() { return mode; },
  };
}
