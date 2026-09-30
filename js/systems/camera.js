// 相机系统：世界坐标 ↔ 屏幕坐标的唯一转换点。
//
// 设计要点：
//   1. 「把世界铺满视口」—— scale = max(view.W / WORLD.w, view.H / WORLD.h)。
//      好处是地形常数与分辨率完全解耦，手机和桌面看到的是同一个世界。
//   2. 缓动 + 边界阻尼：拖动是即时的（tx/ty 直接跟随），但渲染值 x/y 用指数
//      缓动追上目标；相机被夹在世界边界内，顶到边界时阻尼会软化。
//   3. 所有实体只认世界坐标，渲染时才通过 toScreen / apply 转换。
import { clamp, damp } from '../core/config.js';
import { WORLD } from './terrain.js';
import { view, camera, camInput, CAM_SPEED, CAM_EASE, CAM_DAMP } from '../core/state.js';

export function createCamera() {
  let vw = WORLD.w;
  let vh = WORLD.h;

  // 重新计算缩放与可见世界范围
  function resize() {
    if (!view.W || !view.H) return;
    camera.scale = Math.max(view.W / WORLD.w, view.H / WORLD.h);
    vw = view.W / camera.scale;
    vh = view.H / camera.scale;
    clampToBounds(true);
  }

  function bounds() {
    return {
      minX: WORLD.x0,
      maxX: Math.max(WORLD.x0, WORLD.x1 - vw),
      minY: WORLD.y0,
      maxY: Math.max(WORLD.y0, WORLD.y1 - vh),
    };
  }

  function clampToBounds(snap) {
    const b = bounds();
    camera.tx = clamp(camera.tx, b.minX, b.maxX);
    camera.ty = clamp(camera.ty, b.minY, b.maxY);
    if (snap) {
      camera.x = camera.tx;
      camera.y = camera.ty;
    }
  }

  // 世界坐标 → 屏幕坐标
  function toScreen(wx, wy) {
    return { x: (wx - camera.x) * camera.scale, y: (wy - camera.y) * camera.scale };
  }

  function toScreenX(wx) {
    return (wx - camera.x) * camera.scale;
  }

  function toScreenY(wy) {
    return (wy - camera.y) * camera.scale;
  }

  // 屏幕坐标 → 世界坐标
  function toWorld(sx, sy) {
    return { x: sx / camera.scale + camera.x, y: sy / camera.scale + camera.y };
  }

  function toWorldX(sx) {
    return sx / camera.scale + camera.x;
  }

  function toWorldY(sy) {
    return sy / camera.scale + camera.y;
  }

  // 可见世界矩形（用于剔除）
  function visibleRect(pad) {
    const pd = pad || 0;
    const b = bounds();
    return {
      x0: Math.max(WORLD.x0, camera.x - pd),
      y0: Math.max(WORLD.y0, camera.y - pd),
      x1: Math.min(WORLD.x1, camera.x + vw + pd),
      y1: Math.min(WORLD.y1, camera.y + vh + pd),
      w: vw + pd * 2,
      h: vh + pd * 2,
    };
  }

  function inView(wx, wy, pad) {
    const pd = pad || 0;
    return (
      wx >= camera.x - pd &&
      wx <= camera.x + vw + pd &&
      wy >= camera.y - pd &&
      wy <= camera.y + vh + pd
    );
  }

  // 拖动平移（dx/dy 是屏幕像素增量）
  function panBy(dx, dy) {
    camera.tx -= dx / camera.scale;
    camera.ty -= dy / camera.scale;
    clampToBounds(false);
  }

  // 直接跳转（出生 / 读档）
  function jumpTo(wx, wy) {
    camera.tx = wx;
    camera.ty = wy;
    clampToBounds(true);
  }

  // 把某个世界点居中（考虑视口中心偏移）
  function centerOn(wx, wy, snap) {
    camera.tx = wx - vw / 2;
    camera.ty = wy - vh / 2;
    clampToBounds(!!snap);
  }

  // 每帧更新：键盘输入 + 缓动
  function update(dt) {
    if (!camera.scale || !view.W) return;
    // 键盘 / 按钮移动
    if (camInput.x || camInput.y) {
      const step = (CAM_SPEED * dt) / 1000;
      camera.tx += camInput.x * step;
      camera.ty += camInput.y * step;
      clampToBounds(false);
    }
    // 缓动：拖完松手后轻微回落，方向键则平滑推进
    const rate = CAM_EASE * (0.6 + CAM_DAMP * 0.6);
    camera.x = damp(camera.x, camera.tx, rate, dt);
    camera.y = damp(camera.y, camera.ty, rate, dt);
    // 兜底：缓动不可能越界，但 resize 后可能残留
    if (camera.x < bounds().minX - 1 || camera.x > bounds().maxX + 1) clampToBounds(false);
  }

  // 把画布变换设为「世界空间」——调用后所有绘制都直接用世界坐标
  function apply(ctx) {
    ctx.setTransform(camera.scale, 0, 0, camera.scale, -camera.x * camera.scale, -camera.y * camera.scale);
  }

  // 复位到画布分辨率变换（DPR 由调用方给定）
  function resetTransform(ctx, dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return {
    resize,
    update,
    apply,
    resetTransform,
    toScreen,
    toScreenX,
    toScreenY,
    toWorld,
    toWorldX,
    toWorldY,
    visibleRect,
    inView,
    panBy,
    jumpTo,
    centerOn,
    bounds,
    get scale() {
      return camera.scale;
    },
    get vw() {
      return vw;
    },
    get vh() {
      return vh;
    },
  };
}
