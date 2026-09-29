// ============================================================
//  尺寸管理：防抖 + 软重建
//  修复原版问题：
//   1. resize 双监听（原 L166 + L770）未防抖
//   2. initWorld() 清空全部水母
//   3. bubbles 只 push 不清空 -> 内存累积
//   4. iOS 地址栏收缩触发全量重建 -> 卡顿
// ============================================================

import { DPR } from './config.js';
import { view } from './state.js';

export function createResize(canvas, ctx, onHardRebuild) {
  let timer = null;
  let lastW = 0;
  let lastH = 0;

  function applySize() {
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    view.W = vw;
    view.H = vh;
    canvas.width = Math.round(vw * DPR);
    canvas.height = Math.round(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function handle() {
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    if (lastW > 0) {
      const dw = Math.abs(vw - lastW) / lastW;
      const dh = Math.abs(vh - lastH) / lastH;
      // 变化小于 8% 视为地址栏抖动，只重设尺寸不重建世界
      if (dw < 0.08 && dh < 0.08) {
        applySize();
        return;
      }
    }

    applySize();
    lastW = vw;
    lastH = vh;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (onHardRebuild) onHardRebuild();
    }, 200);
  }

  applySize();
  lastW = view.W;
  lastH = view.H;

  window.addEventListener('resize', handle);
  window.addEventListener('orientationchange', () => setTimeout(handle, 200));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handle);
  }

  return { handle, applySize };
}
