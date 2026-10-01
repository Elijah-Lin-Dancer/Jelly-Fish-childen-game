// ============================================================
//  手机端虚拟摇杆（仿 Minecraft 左摇杆）
//  - 仅在触屏设备显示（isMobile || pointer:coarse），桌面鼠标不出现
//  - 拖动方向写入 touchAxis{x,y}，与键盘 camInput 并存，相机每帧合成
//  - 方向语义与键盘一致：上推 = 负 y = 相机向上（看陆地），右推 = 正 x = 向右
//  - 纯 DOM + pointer 事件，不参与任何游戏逻辑，松手自动归零
// ============================================================

import { isMobile } from '../core/config.js';

const RADIUS = 58;       // 旋钮可偏离基地中心的最大像素
const BASE_SIZE = 124;   // 基地直径
const KNOB_SIZE = 56;    // 旋钮直径

export function createTouchPad(touchAxis) {
  // 非触屏设备：直接不创建任何 DOM，零开销
  const coarse = typeof window !== 'undefined' &&
    window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!(isMobile || coarse)) return { mount() {}, show() {}, hide() {} };

  let el = null;
  let knob = null;
  let origin = null;     // pointerdown 时的基地中心（屏幕坐标）
  let activeId = null;

  function build() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'touch-pad';
    el.setAttribute('aria-hidden', 'true');
    knob = document.createElement('div');
    knob.className = 'touch-pad-knob';
    el.appendChild(knob);
    document.body.appendChild(el);

    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    // 阻止摇杆区域的浏览器默认手势（滚动/缩放）
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return el;
  }

  function setKnob(dx, dy) {
    if (!knob) return;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function onDown(e) {
    e.preventDefault();
    activeId = e.pointerId;
    const r = el.getBoundingClientRect();
    origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    onMove(e);
  }

  function onMove(e) {
    if (activeId !== null && e.pointerId !== activeId) return;
    if (!origin) return;
    e.preventDefault();
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      const k = RADIUS / dist;
      dx *= k; dy *= k;
    }
    setKnob(dx, dy);
    // 归一化到 [-1, 1]：上推 dy<0 → 负 y（与键盘 W 一致）
    touchAxis.x = dx / RADIUS;
    touchAxis.y = dy / RADIUS;
  }

  function onUp(e) {
    if (activeId !== null && e.pointerId !== activeId) return;
    activeId = null;
    origin = null;
    touchAxis.x = 0;
    touchAxis.y = 0;
    setKnob(0, 0);
  }

  return {
    mount() { build(); },
    show() { if (el) el.classList.add('show'); },
    hide() { if (el) el.classList.remove('show'); },
  };
}

export const TOUCH_PAD_SIZES = { RADIUS, BASE_SIZE, KNOB_SIZE };
