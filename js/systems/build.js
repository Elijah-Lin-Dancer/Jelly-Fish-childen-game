// ============================================================
//  建造系统（阶段八 · 8A）
//  - MC 式"布置"的软化版：预设模块 + 点槽位放置（非格子世界）
//  - 消耗生物荧光（复用阶段六 economy）
//  - 模块产生"生态效果"，供洋流 / 经济 / 繁育 / 冒险庇护读取
//  - 持久化在池塘存档元数据里（buildings 数组）
// ============================================================

import { TAU } from '../core/config.js';

/** 半径：各模块的生效范围（像素） */
export const BUILD_MODULES = [
  {
    id: 'coral',
    label: 'build.coral',
    cost: 30,
    radius: 170,
    // 生态效果：附近水母繁育冷却缩短（繁育倾向↑）
    effect: { breedBoost: 0.35 },
  },
  {
    id: 'reef',
    label: 'build.reef',
    cost: 50,
    radius: 150,
    // 庇护所：范围内水母不被 scare / 不被大鱼叼走
    effect: { shelter: 1 },
  },
  {
    id: 'beacon',
    label: 'build.beacon',
    cost: 80,
    radius: 9999,
    // 全局荧光产出提升（乘进 economy.gain）
    effect: { yieldBoost: 0.15 },
  },
  {
    id: 'kelp',
    label: 'build.kelp',
    cost: 40,
    radius: 190,
    // 削弱局部洋流（水母受洋流位移乘 1 - kelpFactor）
    effect: { calm: 0.6 },
  },
];

const MODULE_BY_ID = Object.fromEntries(BUILD_MODULES.map((m) => [m.id, m]));

export function createBuild({ economy, onPlaced, onError, onRemove } = {}) {
  /** @type {{id:string,x:number,y:number}[]} */
  const buildings = [];

  function moduleOf(id) { return MODULE_BY_ID[id]; }

  /** 放置一个模块；余额不足或未知模块返回 false */
  function place(id, x, y, free = false) {
    const mod = moduleOf(id);
    if (!mod) return false;
    if (!free) {
      if (!economy || !economy.spend(mod.cost)) {
        if (onError) onError('build.broke');
        return false;
      }
    }
    const b = { id, x: Math.round(x), y: Math.round(y) };
    buildings.push(b);
    if (onPlaced) onPlaced(mod, b);
    return true;
  }

  function remove(index) {
    if (index < 0 || index >= buildings.length) return false;
    const [b] = buildings.splice(index, 1);
    if (onRemove) onRemove(b);
    return true;
  }

  function countOf(id) {
    let n = 0;
    for (const b of buildings) if (b.id === id) n++;
    return n;
  }

  /**
   * 某类型在某点的效果强度（0..1，按半径衰减）。
   * 不传坐标则返回全局累加（用于灯塔这类全域效果）。
   */
  function effectOf(type, x, y, falloff = true) {
    let total = 0;
    for (const b of buildings) {
      const mod = moduleOf(b.id);
      if (!mod) continue;
      const eff = mod.effect[type];
      if (!eff) continue;
      if (x == null || y == null) { total += eff; continue; }
      const R = mod.radius;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d >= R) continue;
      // 越靠近中心越强；线性衰减
      const w = falloff ? (1 - d / R) : 1;
      total += eff * w;
    }
    return total;
  }

  /** 点是否在任意 reef 庇护范围内 */
  function isSheltered(x, y) {
    return effectOf('shelter', x, y) > 0;
  }

  /** 荧光产出倍率（灯塔） */
  function yieldMultiplier() {
    return 1 + effectOf('yieldBoost');
  }

  // ---------- 绘制 ----------
  function draw(ctx, t) {
    for (const b of buildings) drawOne(ctx, b, t);
  }

  function drawOne(ctx, b, t) {
    const mod = moduleOf(b.id);
    if (!mod) return;
    const x = b.x, y = b.y;
    if (mod.id === 'coral') {
      ctx.save();
      ctx.translate(x, y);
      const sway = Math.sin(t * 0.001 + x * 0.01) * 0.06;
      ctx.rotate(sway);
      // 主枝
      ctx.strokeStyle = 'rgba(255, 150, 130, 0.85)';
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.42;
        const len = 26 + (i % 2) * 12;
        ctx.lineWidth = 5 - (i % 2);
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.quadraticCurveTo(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
      }
      // 基部
      ctx.fillStyle = 'rgba(190, 110, 100, 0.7)';
      ctx.beginPath();
      ctx.ellipse(0, 12, 14, 6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (mod.id === 'reef') {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(120, 140, 160, 0.75)';
      ctx.beginPath();
      ctx.moveTo(-30, 14);
      ctx.lineTo(-18, -14);
      ctx.lineTo(-2, -4);
      ctx.lineTo(10, -20);
      ctx.lineTo(26, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 180, 200, 0.4)';
      ctx.beginPath();
      ctx.moveTo(10, -20);
      ctx.lineTo(26, 14);
      ctx.lineTo(6, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (mod.id === 'beacon') {
      ctx.save();
      ctx.translate(x, y);
      // 光晕
      const pulse = 0.6 + Math.sin(t * 0.003) * 0.4;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 90);
      g.addColorStop(0, `rgba(255, 230, 150, ${0.5 * pulse})`);
      g.addColorStop(1, 'rgba(255, 230, 150, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // 塔身
      ctx.fillStyle = 'rgba(255, 226, 160, 0.95)';
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.lineTo(2, 20);
      ctx.lineTo(-2, 20);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (mod.id === 'kelp') {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = 'rgba(120, 210, 160, 0.7)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      for (let i = -1; i <= 1; i++) {
        const sway = Math.sin(t * 0.0016 + i * 1.3 + x * 0.01) * 16;
        ctx.beginPath();
        ctx.moveTo(i * 14, 26);
        ctx.quadraticCurveTo(i * 14 + sway, -6, i * 14 + sway * 1.4, -42);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function reset() { buildings.length = 0; }

  return {
    modules: BUILD_MODULES,
    get list() { return buildings; },
    get size() { return buildings.length; },
    moduleOf,
    place,
    remove,
    reset,
    countOf,
    effectOf,
    isSheltered,
    yieldMultiplier,
    draw,
    serialize: () => buildings.map((b) => ({ id: b.id, x: b.x, y: b.y })),
    restore(arr) {
      buildings.length = 0;
      if (!Array.isArray(arr)) return;
      for (const b of arr) {
        if (b && MODULE_BY_ID[b.id] && isFinite(b.x) && isFinite(b.y)) {
          buildings.push({ id: b.id, x: +b.x, y: +b.y });
        }
      }
    },
  };
}
