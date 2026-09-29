// ============================================================
//  图鉴收集
// ============================================================

import { collection } from '../core/state.js';

const STORAGE_KEY = 'ocean.dex';

export function createCollection(onUnlock, onComplete) {
  // 恢复进度
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach((i) => collection.found.add(i));
      if (collection.found.size >= collection.total) collection.celebrated = true;
    }
  } catch (e) { /* 忽略 */ }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...collection.found])); } catch (e) { /* 忽略 */ }
  }

  return {
    /** 收录一个物种，返回 true 表示新发现 */
    unlock(index) {
      if (index == null || index < 0 || index >= collection.total) return false;
      if (collection.found.has(index)) return false;
      collection.found.add(index);
      persist();
      if (onUnlock) onUnlock(index);
      if (collection.found.size >= collection.total && !collection.celebrated) {
        collection.celebrated = true;
        persist();
        if (onComplete) onComplete();
      }
      return true;
    },
    get size() { return collection.found.size; },
    get total() { return collection.total; },
    has(i) { return collection.found.has(i); },
    reset() {
      collection.found.clear();
      collection.celebrated = false;
      persist();
    },
  };
}
