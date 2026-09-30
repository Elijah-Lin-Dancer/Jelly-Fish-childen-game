// ============================================================
//  轻量玩法：引水母归巢
//  - 屏幕随机处生成发光目标环（柔和脉冲）
//  - 让 >= NEED 只水母同时进入环内并持续 HOLD 毫秒即达成
//  - 状态机 idle → active → success；可随时开关，不打断沉浸
// ============================================================

import { rand, TAU } from '../core/config.js';
import { view, dayNight } from '../core/state.js';

const NEED = 3;            // 需要的水母数
const HOLD_MS = 2000;      // 持续时长

export function createActivity(getJellyfish, { onSuccess, onStateChange } = {}) {
  let enabled = false;
  let state = 'idle';   // idle | active | success
  let cx = 0, cy = 0, ringR = 90;
  let hold = 0;         // 已持续毫秒
  let pulse = 0;
  let dwell = 0;        // 环内水母数（平滑）
  let successT = 0;     // 成功动画计时

  function placeTarget() {
    ringR = Math.max(70, Math.min(view.W, view.H) * 0.12);
    cx = rand(ringR + 30, view.W - ringR - 30);
    cy = rand(ringR + 60, view.H - ringR - 60);
  }

  function setState(s) {
    if (state === s) return;
    state = s;
    if (onStateChange) onStateChange(s);
  }

  function start() {
    if (state === 'active') return;
    placeTarget();
    hold = 0;
    dwell = 0;
    successT = 0;
    setState('active');
  }

  function stop() {
    setState('idle');
  }

  function toggle() {
    enabled = !enabled;
    if (enabled) start(); else stop();
    return enabled;
  }

  function countInside() {
    const arr = getJellyfish() || [];
    let n = 0;
    const rr = (ringR + 24) * (ringR + 24);
    for (const j of arr) {
      const dx = j.x - cx, dy = j.y - cy;
      if (dx * dx + dy * dy < rr) n++;
    }
    return n;
  }

  /** 供调度器调用（update） */
  function update(dt) {
    pulse += dt;
    if (!enabled || state === 'idle') return;

    if (state === 'success') {
      successT += dt;
      if (successT > 1500) {
        // 成功后换一个新目标，保持可玩
        start();
      }
      return;
    }

    const n = countInside();
    dwell += (n - dwell) * Math.min(1, dt / 200);

    if (n >= NEED) {
      hold += dt;
      if (hold >= HOLD_MS) {
        successT = 0;
        setState('success');
        if (onSuccess) onSuccess();
      }
    } else {
      hold = Math.max(0, hold - dt * 1.5);
    }
  }

  /** 供调度器调用（draw），在最后绘制，浮于实体之上 */
  function draw(ctx) {
    if (!enabled || state === 'idle') return;

    const pr = ringR + Math.sin(pulse * 0.003) * 6;
    const isNight = dayNight.sun < 0.4;
    const baseCol = state === 'success' ? '160, 255, 200' : (isNight ? '150, 200, 255' : '255, 236, 150');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 外圈柔光
    const g = ctx.createRadialGradient(cx, cy, pr * 0.4, cx, cy, pr * 1.5);
    g.addColorStop(0, `rgba(${baseCol}, 0)`);
    g.addColorStop(0.72, `rgba(${baseCol}, 0.10)`);
    g.addColorStop(0.92, `rgba(${baseCol}, 0.22)`);
    g.addColorStop(1, `rgba(${baseCol}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, pr * 1.5, 0, TAU);
    ctx.fill();

    // 主环
    ctx.strokeStyle = `rgba(${baseCol}, ${state === 'success' ? 0.9 : 0.55})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -pulse * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // 进度弧（hold/NEED 达成度）
    if (state === 'active') {
      const p = Math.min(1, hold / HOLD_MS);
      ctx.strokeStyle = `rgba(255, 236, 150, 0.95)`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, pr, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      ctx.stroke();
    }

    ctx.restore();

    // 文案：需要几只 / 当前几只
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 13px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(240, 250, 255, 0.9)';
    const label = state === 'success' ? '' : `${Math.round(dwell)} / ${NEED}`;
    if (label) ctx.fillText(label, cx, cy);
    ctx.restore();
  }

  return {
    update,
    draw,
    toggle,
    start,
    stop,
    get enabled() { return enabled; },
    get state() { return state; },
    // 供测试
    _place: placeTarget,
    _setPos: (x, y) => { cx = x; cy = y; },
    get center() { return { cx, cy, r: ringR }; },
  };
}
