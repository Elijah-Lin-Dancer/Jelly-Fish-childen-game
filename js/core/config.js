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
