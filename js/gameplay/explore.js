// ============================================================
//  探索记录（阶段七）
//  - 已发现的秘密 / 已解锁海域 / 已读故事碎片
//  存储：localStorage 'ocean.explore'
// ============================================================

const STORAGE_KEY = 'ocean.explore';

function loadState() {
  const def = { secrets: {}, zones: { shallow: true }, story: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return def;
    return {
      secrets: d.secrets && typeof d.secrets === 'object' ? d.secrets : {},
      zones: Object.assign({ shallow: true }, d.zones || {}),
      story: d.story && typeof d.story === 'object' ? d.story : {},
    };
  } catch (e) {
    return def;
  }
}

export function createExplore(onSecret, onZone, onStory) {
  const state = loadState();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }

  return {
    /** 发现一处秘密；重复发现返回 false */
    discover(id) {
      if (!id || state.secrets[id] != null) return false;
      state.secrets[id] = Date.now();
      persist();
      if (onSecret) onSecret(id, Object.keys(state.secrets).length);
      return true;
    },
    hasSecret(id) { return state.secrets[id] != null; },
    get count() { return Object.keys(state.secrets).length; },

    /** 解锁海域 */
    unlockZone(id) {
      if (state.zones[id]) return false;
      state.zones[id] = true;
      persist();
      if (onZone) onZone(id);
      return true;
    },
    hasZone(id) { return !!state.zones[id]; },
    get zones() { return { ...state.zones }; },

    /** 记录已读故事碎片 */
    readStory(id) {
      if (state.story[id]) return false;
      state.story[id] = Date.now();
      persist();
      if (onStory) onStory(id);
      return true;
    },
    hasStory(id) { return !!state.story[id]; },
    get storyCount() { return Object.keys(state.story).length; },

    reset() {
      state.secrets = {};
      state.zones = { shallow: true };
      state.story = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    },
  };
}
