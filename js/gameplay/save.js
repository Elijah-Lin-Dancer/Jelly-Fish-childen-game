// ============================================================
//  池塘存档
//  - 序列化当前水母（位置 / 配色 / 成长 / 变异 / 互动次数）
//  - 节流写入 + 页面隐藏/卸载时强制写入
//  - 恢复时按视口 clamp，避免换屏后跑到画布外
// ============================================================

import { view, quality } from '../core/state.js';
import { clamp } from '../core/config.js';
import { serializeTraits, deserializeTraits } from './genes.js';

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
    r: j.rare ? 1 : 0,
    g: serializeTraits(j.traits),
  };
}

export function createSave(getJellyfish, getMeta) {
  let timer = null;
  let dirty = false;

  function snapshot() {
    const arr = getJellyfish() || [];
    // 上限与运行时一致，避免存档无限膨胀
    const cap = Math.round((quality.jellyfish || 20) * 2.5);
    // 隐藏纪念水母不入存档：它的存在由 ocean.memory 决定，避免被重复计算
    const jelly = arr.filter((j) => !j.isMemory).slice(0, cap).map(serialize);
    // 阶段八：池塘存档升级为带元数据的对象（mode / buildings）
    // 元数据由 main 注入，保持 save 不反向依赖具体系统
    const meta = getMeta ? (getMeta() || {}) : {};
    return {
      v: 2,
      mode: meta.mode || 'peace',
      buildings: meta.buildings || [],
      jelly,
    };
  }

  function write() {
    if (!dirty) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
      dirty = false;
    } catch (e) { /* 配额或隐私模式，忽略 */ }
  }

  /**
   * 读取原始存档（统一为 { v, mode, buildings, jelly }）。
   * 向后兼容阶段七及以前的纯数组格式 → 视为 peace + 无建筑。
   * 无有效数据返回 null。
   */
  function readRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.length ? { v: 1, mode: 'peace', buildings: [], jelly: data } : null;
      }
      if (!data || !Array.isArray(data.jelly)) return null;
      return {
        v: data.v || 2,
        mode: data.mode === 'adventure' ? 'adventure' : 'peace',
        buildings: Array.isArray(data.buildings) ? data.buildings : [],
        jelly: data.jelly,
      };
    } catch (e) {
      return null;
    }
  }

  /** 读取存档元数据（mode / buildings），无存档返回 null */
  function readMeta() {
    const d = readRaw();
    if (!d) return null;
    return { mode: d.mode, buildings: d.buildings };
  }

  /** 把存档数据映射为水母构造参数（坐标按当前视口 clamp） */
  function restoreParams() {
    const saved = readRaw();
    if (!saved || !saved.jelly.length) return null;
    const data = saved.jelly;
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
        rare: !!d.r,
        // 基因（旧存档无 g 时回落到随机性状）
        genes: d.g ? deserializeTraits(d.g) : undefined,
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

  function hasSave() { return !!readRaw(); }

  return { start, markDirty, write, restoreParams, readMeta, reset, hasSave };
}
