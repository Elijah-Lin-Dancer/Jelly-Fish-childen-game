// ============================================================
//  基础配置 · 工具函数 · 性能等级
// ============================================================

export const TAU = Math.PI * 2;

export const rand = (a, b) => a + Math.random() * (b - a);

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/** 区间映射，借鉴 gsap-utils 的 mapRange */
export const mapRange = (v, inMin, inMax, outMin, outMax) =>
  outMin + ((clamp(v, inMin, inMax) - inMin) / (inMax - inMin)) * (outMax - outMin);

/** 线性插值 */
export const lerp = (a, b, t) => a + (b - a) * t;

/** 帧率无关的指数趋近：每秒收敛速度 rate */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp((-rate * dt) / 1000));

export const isMobile =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768;

export const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 2);

// ============================================================
//  生物尺寸基准（世界单位）
// ------------------------------------------------------------
//  【为什么需要这一组】世界里的「参照物」是陆地：岛直径约 1000~1300，
//  棕榈/灯塔高约 60~90，遮阳伞盘径约 33~44。初版的海洋生物尺寸相对
//  这套参照严重偏大 —— 喂到最大的水母（伞径 176 + 触手）比灯塔还高 2~4 倍，
//  海龟（体长 60~90）比沙滩上的一把伞还长。虽然不是写实游戏，但一眼看出
//  「鱼比岛大」会破坏空间感，玩家会失去对「远近深浅」的判断。
//
//  【目标梯度】
//    成年水母伞径 ≈ 棕榈高        （主角要醒目，但不能压过地标）
//    海龟体长     ≈ 遮阳伞盘径
//    大鱼体长     ≈ 棕榈高的一半
//    鲸全长       ≈ 岛直径的 1/4  （唯一的巨型生物，保留体量感）
//
//  改这里就够了 —— 各实体构造器只引用这些系数，不再散落魔法数字。
// ============================================================
export const CREATURE_SCALE = {
  jellyfish: 0.6,   // 伞径基准 22~48 → 13~29（成长上限同步 1.6 → 1.5）
  turtle: 0.65,     // 体长 30~46 → 20~30
  bigfish: 0.7,     // 体长 34~46 → 24~32
  whale: 0.85,      // 全长 140~220 → 119~187
  eggJelly: 0.55,   // 彩蛋水母的固定半径 64 → 35（同步 0.6 的水母基准）
};

// 性能等级：0 最高画质，越低降级越狠
// life：阶段十一 B 的「人类与生活元素」密度档（0..1）。
//   单独成档而不复用 jellyfish 的理由：这类元素是**岸上静态装饰**，
//   数量多了画面会很吵（实测 1.0 时首屏挤着 3 个泳者 + 3 条船 + 4 把伞），
//   而水母数量影响的是核心玩法密度，两者不该被同一个数字绑死。
//   低画质档直接砍到 0.6，让弱机保留「看得见岸上有人」的叙事感即可。
export const QUALITY_TIERS = {
  desktop: [
    { jellyfish: 20, fishSchools: 3, fishPerSchool: 14, plankton: 100, bubbles: 30, seaweed: 10, rays: 5, life: 1.0 },
    { jellyfish: 15, fishSchools: 3, fishPerSchool: 11, plankton: 70, bubbles: 22, seaweed: 8, rays: 4, life: 0.85 },
    { jellyfish: 11, fishSchools: 2, fishPerSchool: 9, plankton: 50, bubbles: 16, seaweed: 6, rays: 3, life: 0.7 },
  ],
  mobile: [
    { jellyfish: 9, fishSchools: 2, fishPerSchool: 7, plankton: 32, bubbles: 13, seaweed: 5, rays: 3, life: 0.75 },
    { jellyfish: 7, fishSchools: 2, fishPerSchool: 6, plankton: 24, bubbles: 10, seaweed: 4, rays: 2, life: 0.65 },
    { jellyfish: 5, fishSchools: 1, fishPerSchool: 5, plankton: 18, bubbles: 8, seaweed: 3, rays: 2, life: 0.55 },
  ],
};

export const isMobileDevice = isMobile;
