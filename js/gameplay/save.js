// ============================================================
//  池塘存档
//  - 序列化当前水母（位置 / 配色 / 成长 / 变异 / 互动次数）
//  - 节流写入 + 页面隐藏/卸载时强制写入
//  - 恢复时按视口 clamp，避免换屏后跑到画布外
// ============================================================

import { view, quality } from '../core/state.js';
import { clamp } from '../core/config.js';

const STORAGE_KEY = 'ocean.pond';
const SAVE_INTERVAL = 3000; // ms

/** 单只水母 -> 可存储的纯数据 */
function serialize(j) {
  return {
    x: Math.round(j.x),
    y: Math.round(j.y),
    p: j.paletteIndex,
    s: +j.scale.toFixed(3),
    m: j.mutated ? 1 : 0,
    n: j.interactions | 0,
    a: Math.round(j.age),
  };
}

export function createSave(getJellyfish) {
  let timer = null;
  let dirty = false;

  function snapshot() {
    const arr = getJellyfish() || [];
    // 上限与运行时一致，避免存档无限膨胀
    const cap = Math.round((quality.jellyfish || 20) * 2.5);
    return arr.slice(0, cap).map(serialize);
  }

  function write() {
    if (!dirty) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
      dirty = false;
    } catch (e) { /* 配额或隐私模式，忽略 */ }
  }

  /** 读取原始存档数组（无有效数据返回 null） */
  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data) || !data.length) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  /** 把存档数据映射为水母构造参数（坐标按当前视口 clamp） */
  function restoreParams() {
    const data = read();
    if (!data) return null;
    const W = view.W, H = view.H;
    return data
      .filter((d) => d && typeof d.p === 'number')
      .map((d) => ({
        x: W > 0 ? clamp(+d.x || W / 2, 0, W) : undefined,
        y: H > 0 ? clamp(+d.y || H / 2, 0, H) : undefined,
        paletteIndex: ((d.p % 6) + 6) % 6,
        scale: clamp(+d.s || 1, 0.4, 1.6),
        mutated: !!d.m,
        interactions: +d.n || 0,
        age: +d.a || 0,
      }));
  }

  function markDirty() { dirty = true; }

  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(write, SAVE_INTERVAL);
    // 页面隐藏 / 关闭时立即落盘
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) write();
    });
    window.addEventListener('beforeunload', write);
    window.addEventListener('pagehide', write);
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    dirty = false;
  }

  function hasSave() { return !!read(); }

  return { start, markDirty, write, restoreParams, reset, hasSave };
}
