// ============================================================
//  池塘存档
//  - 序列化当前水母（位置 / 配色 / 成长 / 变异 / 互动次数）
//  - 节流写入 + 页面隐藏/卸载时强制写入
//  - 恢复时按视口 clamp，避免换屏后跑到画布外
// ============================================================

import { view, quality, camera } from '../core/state.js';
import { clamp } from '../core/config.js';
import { serializeTraits, deserializeTraits } from './genes.js';
import { WORLD } from '../systems/terrain.js';

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
    // 阶段十：升 v3，加入世界（worldType / seed）与伴随水母（companion）
    // 阶段十一：升 v4，加入地形（terrain）与相机位置（camera）
    // 元数据由 main 注入，保持 save 不反向依赖具体系统
    const meta = getMeta ? (getMeta() || {}) : {};
    return {
      v: 4,
      mode: meta.mode || 'peace',
      worldType: meta.worldType || 'coral',
      terrain: meta.terrain || 'shore',
      seed: meta.seed != null ? String(meta.seed) : '',
      companion: meta.companion || 'lucy',
      starter: meta.starter ? 1 : 0,
      // 相机：记录玩家离开时看到的位置，回来还在原地
      camera: meta.camera || { x: Math.round(camera.x), y: Math.round(camera.y) },
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
   * 读取原始存档（统一为 { v, mode, worldType, seed, companion, starter, buildings, jelly }）。
   * 向后兼容阶段七及以前的纯数组格式 / 阶段八 v2 → 补默认世界与伴随。
   * 无有效数据返回 null。
   */
  function readRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        // v1：纯数组，坐标是「屏幕坐标」
        return data.length
          ? {
              v: 1, mode: 'peace', worldType: 'coral', terrain: 'shore', seed: '',
              companion: 'lucy', starter: 0, camera: null, coordSpace: 'screen',
              buildings: [], jelly: data,
            }
          : null;
      }
      if (!data || !Array.isArray(data.jelly)) return null;
      const v = data.v || 2;
      return {
        v,
        mode: data.mode === 'adventure' ? 'adventure' : 'peace',
        worldType: typeof data.worldType === 'string' ? data.worldType : 'coral',
        // v4 之前没有 terrain → 默认经典海湾（shore）
        terrain: typeof data.terrain === 'string' ? data.terrain : 'shore',
        seed: data.seed != null ? String(data.seed) : '',
        companion: typeof data.companion === 'string' ? data.companion : 'lucy',
        starter: data.starter ? 1 : 0,
        camera: data.camera && typeof data.camera.x === 'number' ? data.camera : null,
        // v3 及以前的水母坐标是「屏幕坐标」，v4 起才是世界坐标
        coordSpace: v >= 4 ? 'world' : 'screen',
        buildings: Array.isArray(data.buildings) ? data.buildings : [],
        jelly: data.jelly,
      };
    } catch (e) {
      return null;
    }
  }

  /** 读取存档元数据（mode / world / companion），无存档返回 null */
  function readMeta() {
    const d = readRaw();
    if (!d) return null;
    return {
      mode: d.mode,
      worldType: d.worldType,
      terrain: d.terrain,
      seed: d.seed,
      companion: d.companion,
      starter: d.starter,
      camera: d.camera,
      buildings: d.buildings,
    };
  }

  /**
   * 把存档数据映射为水母构造参数。
   *
   * 坐标迁移（阶段十一最关键的一处兼容）：
   *   - v4+  坐标已经是世界坐标 → 只做世界边界 clamp
   *   - v1~v3 坐标是旧版的「屏幕坐标」→ 按同比例映射进世界坐标系，
   *           而不是粗暴丢弃，玩家辛苦养大的水母不会因为升级而消失/挤成一堆。
   */
  function restoreParams() {
    const saved = readRaw();
    if (!saved || !saved.jelly.length) return null;
    const data = saved.jelly;
    const W = view.W, H = view.H;
    const legacy = saved.coordSpace === 'screen';
    // 旧屏幕坐标 → 世界坐标的换算比例
    const sx = W > 0 ? WORLD.w / W : 1;
    const sy = H > 0 ? WORLD.h / H : 1;
    return data
      .filter((d) => d && typeof d.p === 'number')
      .map((d) => {
        let x, y;
        if (legacy) {
          // 屏幕坐标按比例铺到整个世界（并留一点边距）
          x = WORLD.x0 + clamp((+d.x || W / 2) * sx, WORLD.x0, WORLD.x1);
          y = WORLD.y0 + clamp((+d.y || H / 2) * sy, 0, WORLD.h);
        } else {
          x = clamp(+d.x || WORLD.w / 2, WORLD.x0, WORLD.x1);
          y = clamp(+d.y || WORLD.h / 2, WORLD.y0, WORLD.y1);
        }
        return {
          x, y,
        paletteIndex: ((d.p % 6) + 6) % 6,
        scale: clamp(+d.s || 1, 0.4, 1.6),
        mutated: !!d.m,
        interactions: +d.n || 0,
        age: +d.a || 0,
        rare: !!d.r,
          // 基因（旧存档无 g 时回落到随机性状）
          genes: d.g ? deserializeTraits(d.g) : undefined,
        };
      });
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
