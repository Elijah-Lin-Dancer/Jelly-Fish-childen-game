// ============================================================
//  图鉴收集 · 数据层
//  - 每物种记录：found / firstSeen / seen / mutated
//  - 向后兼容旧版 Set<string> 存档
// ============================================================

import { collection } from '../core/state.js';

const STORAGE_KEY = 'ocean.dex';

/** 建一条空记录 */
function emptyRecord() {
  return { found: false, firstSeen: 0, seen: 0, mutated: 0, traits: null };
}

/** 确保 state 里存在 records（首次或旧数据迁移时构造） */
function ensureRecords() {
  if (!collection.records) collection.records = {};
  for (let i = 0; i < collection.total; i++) {
    if (!collection.records[i]) collection.records[i] = emptyRecord();
  }
  return collection.records;
}

/** 从存档恢复；兼容旧格式（数组 / Set 序列化） */
function load() {
  ensureRecords();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      // 旧格式：发现的索引数组
      data.forEach((i) => {
        const rec = collection.records[i];
        if (rec) {
          rec.found = true;
          rec.seen = Math.max(rec.seen, 1);
        }
      });
    } else if (data && typeof data === 'object') {
      // 新格式：{ "0": {found,firstSeen,seen,mutated}, ... }
      for (const k in data) {
        const rec = collection.records[k];
        if (!rec) continue;
        const src = data[k] || {};
        rec.found = !!src.found;
        rec.firstSeen = +src.firstSeen || 0;
        rec.seen = +src.seen || 0;
        rec.mutated = +src.mutated || 0;
        rec.traits = (src.traits && typeof src.traits === 'object') ? src.traits : null;
      }
    }
    syncCount();
  } catch (e) { /* 忽略损坏数据 */ }
}

/** 用 records 回填 collection.found（供旧代码 get size / has 使用） */
function syncCount() {
  const recs = ensureRecords();
  collection.found.clear();
  for (let i = 0; i < collection.total; i++) {
    if (recs[i].found) collection.found.add(i);
  }
  if (collection.found.size >= collection.total) collection.celebrated = true;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureRecords()));
  } catch (e) { /* 隐私模式忽略 */ }
}

export function createCollection(onUnlock, onComplete) {
  load();

  return {
    /** 收录一个物种，返回 true 表示新发现 */
    unlock(index) {
      if (index == null || index < 0 || index >= collection.total) return false;
      const rec = ensureRecords()[index];
      if (rec.found) return false;
      rec.found = true;
      rec.firstSeen = Date.now();
      rec.seen = Math.max(1, rec.seen);
      syncCount();
      persist();
      if (onUnlock) onUnlock(index);
      if (collection.found.size >= collection.total && !collection.celebrated) {
        collection.celebrated = true;
        persist();
        if (onComplete) onComplete();
      }
      return true;
    },

    /** 记录"见到"某物种（不必新收录），累加计数；可选记录性状（取各项较优者） */
    see(index, traits) {
      if (index == null || index < 0 || index >= collection.total) return;
      const rec = ensureRecords()[index];
      rec.seen++;
      if (traits) {
        if (!rec.traits) rec.traits = {};
        for (const k in traits) {
          if (typeof traits[k] === 'number') {
            rec.traits[k] = Math.max(rec.traits[k] || 0, traits[k]);
          }
        }
      }
      persist();
    },

    /** 记录一次变异（某物种） */
    recordMutation(index, fromIndex) {
      if (index == null || index < 0 || index >= collection.total) return;
      const rec = ensureRecords()[index];
      rec.mutated++;
      // 变异同时视作"见到"变异后的物种
      if (!rec.found) {
        rec.found = true;
        rec.firstSeen = Date.now();
        syncCount();
        if (onUnlock) onUnlock(index);
        if (collection.found.size >= collection.total && !collection.celebrated) {
          collection.celebrated = true;
          if (onComplete) onComplete();
        }
      }
      persist();
    },

    /** 读取某物种记录（只读副本） */
    record(index) {
      const rec = ensureRecords()[index];
      return { ...rec };
    },

    get size() { return collection.found.size; },
    get total() { return collection.total; },
    has(i) { return collection.found.has(i); },

    reset() {
      const recs = ensureRecords();
      for (let i = 0; i < collection.total; i++) recs[i] = emptyRecord();
      collection.found.clear();
      collection.celebrated = false;
      persist();
    },
  };
}
