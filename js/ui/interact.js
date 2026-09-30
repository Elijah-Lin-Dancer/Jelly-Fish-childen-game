// ============================================================
//  交互：鼠标 / 触摸 / 长按（带进度反馈）
//  修复原版问题：
//   1. 长按无视觉反馈
//   2. 混合输入设备 mousedown+touchstart 双触发
//   3. 音频解锁挂在 canvas 上且 once，点 HUD 不解锁
//   4. iOS 长按弹系统菜单
// ============================================================

import { pointer } from '../core/state.js';

const HOLD_MS = 500;

export function createInteract(canvas, handlers) {
  const { onHold, onTap, onMoveStart, onMoveEnd, onDrag } = handlers;

  let timer = null;
  let longPressed = false;
  let holdStart = 0;
  let lastInput = '';
  let lastInputTime = 0;
  let holding = false;
  let holdX = 0, holdY = 0;
  let moved = false;          // 拖拽超过阈值后抑制误触 tap
  let lastX = 0, lastY = 0;

  function setPointer(e) {
    const t = e.touches ? e.touches[0] : e;
    const r = canvas.getBoundingClientRect();
    pointer.x = t.clientX - r.left;
    pointer.y = t.clientY - r.top;
    pointer.active = true;
  }

  function clearPointer() {
    pointer.active = false;
    pointer.x = -9999;
    pointer.y = -9999;
  }

  /** 指针按下且移动时调用：累积 moved 标记，并按需回调 onDrag */
  function dragMove() {
    const dx = pointer.x - lastX, dy = pointer.y - lastY;
    lastX = pointer.x;
    lastY = pointer.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.01) return;
    moved = true;
    if (!longPressed && onDrag) onDrag(pointer.x, pointer.y, dx, dy);
  }

  /** 幂等：同一时刻只允许一次 press 开始 */
  function pressStart(e, type) {
    const now = performance.now();
    // 抑制混合设备重复触发
    if (type === 'touch' && lastInput === 'mouse' && now - lastInputTime < 300) return;
    if (type === 'mouse' && lastInput === 'touch' && now - lastInputTime < 300) return;
    if (pointer.down) return;
    lastInput = type;
    lastInputTime = now;

    setPointer(e);
    pointer.down = true;
    longPressed = false;
    holding = true;
    holdStart = now;
    holdX = pointer.x;
    holdY = pointer.y;
    lastX = pointer.x;
    lastY = pointer.y;
    moved = false;

    if (onMoveStart) onMoveStart(pointer.x, pointer.y);

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      longPressed = true;
      holding = false;
      if (onHold) onHold(pointer.x, pointer.y);
    }, HOLD_MS);
  }

  function pressEnd() {
    if (timer) { clearTimeout(timer); timer = null; }
    holding = false;
    pointer.down = false;
    if (onMoveEnd) onMoveEnd();
    if (!longPressed && !moved && onTap) onTap(pointer.x, pointer.y);
    longPressed = false;
  }

  // ---- 鼠标 ----
  canvas.addEventListener('mousemove', (e) => {
    setPointer(e);
    if (pointer.down) dragMove();
  });
  canvas.addEventListener('mouseleave', () => { clearPointer(); });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    pressStart(e, 'mouse');
  });
  window.addEventListener('mouseup', (e) => {
    if (!pointer.down) return;
    // 在画布上按下、拖到 HUD 上释放时，不应在旧坐标误触发 onTap
    const r = canvas.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside) pressEnd();
    else {
      if (timer) { clearTimeout(timer); timer = null; }
      holding = false;
      longPressed = false;
      pointer.down = false;
      if (onMoveEnd) onMoveEnd();
    }
  });

  // ---- 触摸 ----
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    pressStart(e, 'touch');
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    setPointer(e);
    dragMove();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    pressEnd();
    if (!e.touches || !e.touches.length) clearPointer();
  }, { passive: false });
  canvas.addEventListener('touchcancel', () => {
    if (timer) { clearTimeout(timer); timer = null; }
    holding = false;
    pointer.down = false;
    clearPointer();
  });

  /** 长按进度 0..1，供渲染层画进度环 */
  function holdProgress() {
    if (!holding) return 0;
    return Math.min(1, (performance.now() - holdStart) / HOLD_MS);
  }

  return {
    holdProgress,
    get holding() { return holding; },
    get holdPos() { return { x: holdX, y: holdY }; },
    clearPointer,
  };
}

/** 画长按进度环 */
export function drawHoldRing(ctx, x, y, progress) {
  if (progress <= 0 || progress >= 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const r = 34;
  ctx.strokeStyle = 'rgba(200, 240, 255, 0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 240, 180, 0.95)';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();

  ctx.restore();
}
