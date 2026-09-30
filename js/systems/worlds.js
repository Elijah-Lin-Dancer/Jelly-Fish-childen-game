// ============================================================
//  生物群系 / 世界系统（阶段十）
//  - 5 个群系：coral / polar / vent / neon / mycelium
//  - 每个群系 = 水色偏移 baseTint + 氛围 haze/rays + 标志结构 feature
//    + 权重物种 speciesWeight + 小机制 mechanics
//  - 叠加在现有"深度海域"（浅海/午夜/深渊）之上；深度层继续当进度解锁
//  水色参照真实 MC 海洋群系（Warm #43D5EE / Frozen #3938C9 / Mushroom #8a8997）
//  参考：https://minecraft.wiki/w/Biome  https://minecraft.wiki/w/Water
// ============================================================

import { makeRng, rollMushroom, rangeFrom } from '../core/seed.js';

/** 群系定义表 */
export const WORLDS = [
  {
    id: 'coral',
    label: 'world.coral',
    desc: 'world.coral.desc',
    mcRef: 'Warm Ocean #43D5EE',
    baseTint: [10, 22, -14],   // 暖青绿
    haze: 1.05,
    rays: 1.10,
    feature: 'coral',
    predatorSafe: false,
    mechanics: { calm: 0.0, dtScale: 1.0, oxBonus: 0, bioMult: 1.0 },
    // 权重：索引对应 JELLY_PALETTES [pink,cyan,orange,green,violet,yellow]
    weight: [1.4, 1.5, 1.6, 1.2, 0.9, 1.3],
  },
  {
    id: 'polar',
    label: 'world.polar',
    desc: 'world.polar.desc',
    mcRef: 'Frozen Ocean #3938C9',
    baseTint: [-18, -6, 26],   // 冷白蓝
    haze: 0.95,
    rays: 1.00,
    feature: 'ice',
    predatorSafe: false,
    mechanics: { calm: 0.0, dtScale: 0.85, oxBonus: 0.0006, bioMult: 1.0 },
    weight: [0.8, 1.6, 0.9, 1.1, 1.4, 1.2],
  },
  {
    id: 'vent',
    label: 'world.vent',
    desc: 'world.vent.desc',
    mcRef: 'Deep Ocean + 暗红火山微光',
    baseTint: [-30, -22, -10], // 暗 + 红辉
    haze: 0.60,
    rays: 0.30,
    feature: 'vent',
    predatorSafe: false,
    mechanics: { calm: 0.0, dtScale: 1.0, oxBonus: -0.0018, bioMult: 1.15 },
    weight: [0.9, 1.1, 1.3, 1.0, 1.6, 1.4],
  },
  {
    id: 'neon',
    label: 'world.neon',
    desc: 'world.neon.desc',
    mcRef: '原创梦幻·荧光湾',
    baseTint: [6, 20, 10],     // 霓虹
    haze: 0.90,
    rays: 0.85,
    feature: 'neon',
    predatorSafe: false,
    mechanics: { calm: 0.0, dtScale: 1.0, oxBonus: 0, bioMult: 1.25 },
    weight: [1.2, 1.6, 1.1, 1.7, 1.3, 1.2],
  },
  {
    id: 'mycelium',
    label: 'world.mycelium',
    desc: 'world.mycelium.desc',
    mcRef: 'Mushroom Fields #8a8997（罕见·无掠食）',
    baseTint: [14, 10, 14],    // 粉彩灰
    haze: 1.10,
    rays: 1.15,
    feature: 'mycelium',
    predatorSafe: true,        // 无掠食者（对应蘑菇岛无敌对生物）
    mechanics: { calm: 0.15, dtScale: 1.0, oxBonus: 0.0010, bioMult: 1.1 },
    weight: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  },
];

/** 常规可选群系（不含罕见蘑菇海，蘑菇海仅由种子开出） */
export const PICKABLE_WORLDS = WORLDS.filter((w) => w.id !== 'mycelium');

export function worldById(id) {
  return WORLDS.find((w) => w.id === id) || WORLDS[0];
}

/**
 * 创建世界实例。
 * @param {{ type?:string, seed?:string }} opts
 *   - type：玩家选择的群系 id；若种子开出蘑菇海，会被强制覆盖
 *   - seed：种子字符串（空 -> 随机，可复现）
 */
export function createWorld({ type = 'coral', seed = '' } = {}) {
  const { seed: seedNum, seedStr, rng } = makeRng(seed);

  // 种子开出蘑菇海（罕见）：覆盖玩家选择
  const forcedMushroom = rollMushroom(seedNum);
  const resolvedId = forcedMushroom ? 'mycelium' : (worldById(type).id);
  let def = worldById(resolvedId);

  // 装饰散布：由 PRNG 派生，保证同种子同布局
  const decor = [];
  const decorCount = 6 + Math.floor(rng() * 4); // 6..9
  for (let i = 0; i < decorCount; i++) {
    decor.push({
      x: rangeFrom(rng, 0.06, 0.94),  // 相对坐标（渲染时乘 view.W/H）
      y: rangeFrom(rng, 0.12, 0.9),
      s: rangeFrom(rng, 0.7, 1.35),
      ph: rangeFrom(rng, 0, Math.PI * 2),
    });
  }

  return {
    get id() { return def.id; },
    get def() { return def; },
    get seed() { return seedNum; },
    get seedStr() { return seedStr; },
    get forcedMushroom() { return forcedMushroom; },
    get baseTint() { return def.baseTint; },
    get haze() { return def.haze; },
    get rays() { return def.rays; },
    get feature() { return def.feature; },
    get predatorSafe() { return def.predatorSafe; },
    get mechanics() { return def.mechanics; },
    get decor() { return decor; },

    /** 该群系下某配色水母的出现权重（越界回落到 1） */
    speciesWeight(idx) {
      const w = def.weight;
      return w && w[idx] != null ? w[idx] : 1;
    },

    /** 切换群系（呼吸式，运行中一般不改；供重置/预览用） */
    apply(nextType) {
      if (nextType) def = worldById(nextType);
      return def.id;
    },

    serialize() {
      return { worldType: def.id, seed: seedStr };
    },
  };
}
