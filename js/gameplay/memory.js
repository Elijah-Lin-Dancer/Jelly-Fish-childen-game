// ============================================================
//  隐藏纪念内容 · 解锁系统
//  - 口令校验（SHA-256 + 盐，明文不落盘、不进仓库）
//  - 解锁状态持久化
//  存储：localStorage 'ocean.memory'
// ============================================================
//
//  ⚠️ 安全说明（诚实版）：
//  前端没有后端，口令只是「门槛」，不是加密。
//  它能挡住随手翻看的人，挡不住铁了心读源码的人。
//  本系统的设计目标是「体面地藏」，不是密码学安全。
// ============================================================

import { MEMORY } from '../memory.config.js';

const STORAGE_KEY = 'ocean.memory';
const SALT = 'jellyfish-ocean::memory::v1';

/** SHA-256(盐 + 口令)，返回十六进制摘要 */
export async function hashPassword(pw) {
  const data = new TextEncoder().encode(SALT + '|' + String(pw));
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // 极老浏览器兜底：FNV-1a（非加密级，仅避免功能完全不可用）
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'fnv' + h.toString(16);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: false };
    const d = JSON.parse(raw);
    return { unlocked: !!(d && d.unlocked) };
  } catch (e) {
    return { unlocked: false };
  }
}

export function createMemory(onUnlock) {
  const state = loadState();
  let busy = false;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }

  return {
    /** 内容配置（供 UI 读取名字 / 文案 / 配色） */
    get content() { return MEMORY; },

    get unlocked() { return state.unlocked; },

    /**
     * 尝试用口令解锁。
     * @returns {Promise<'ok'|'bad'|'busy'>}
     */
    async attempt(password) {
      if (busy) return 'busy';
      if (state.unlocked) return 'ok';
      busy = true;
      try {
        const h = await hashPassword(password);
        if (h && h === MEMORY.passwordHash) {
          state.unlocked = true;
          persist();
          if (onUnlock) onUnlock();
          return 'ok';
        }
        return 'bad';
      } finally {
        busy = false;
      }
    },

    /** 清除解锁状态（随存档重置一并调用） */
    reset() {
      state.unlocked = false;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    },
  };
}
