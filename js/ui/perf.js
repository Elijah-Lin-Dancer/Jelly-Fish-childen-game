// ============================================================
//  FPS 采样 + 自适应画质降级
//  连续 2s < 45fps 降一档；连续 10s > 55fps 升一档（防抖）
// ============================================================

import { perf, setTier } from '../core/state.js';

const LOW_FPS = 45;
const HIGH_FPS = 55;
const LOW_SECONDS = 2;
const HIGH_SECONDS = 10;
const MAX_TIER = 2;

export function createPerf() {
  let acc = 0;          // 累计时间 ms
  let frames = 0;
  let lowTime = 0;
  let highTime = 0;
  let enabled = true;

  return {
    get fps() { return perf.fps; },
    disable() { enabled = false; },
    enable() { enabled = true; },

    /** 每帧调用，dt 单位 ms */
    sample(dt) {
      if (!enabled) return;
      acc += dt;
      frames++;
      if (acc < 500) return;

      const fps = (frames * 1000) / acc;
      perf.fps = Math.round(fps);
      acc = 0;
      frames = 0;

      if (fps < LOW_FPS) { lowTime += 0.5; highTime = 0; }
      else if (fps > HIGH_FPS) { highTime += 0.5; lowTime = 0; }
      else { lowTime = 0; highTime = 0; }

      if (lowTime >= LOW_SECONDS && perf.tier < MAX_TIER) {
        setTier(perf.tier + 1);
        lowTime = 0;
      } else if (highTime >= HIGH_SECONDS && perf.tier > 0) {
        setTier(perf.tier - 1);
        highTime = 0;
      }
    },
  };
}
