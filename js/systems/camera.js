// 相机系统：世界坐标 ↔ 屏幕坐标的唯一转换点。
//
// 设计要点：
//   1. 「铺满 + 溢出」—— scale = max(view.W / WORLD.w, view.H / WORLD.h) * GROW。
//
//      ⚠ 为什么必须乘 GROW（这是 11A 踩过的坑，改这个字段前务必读完）：
//        scale 用纯 max 时，世界会被「恰好铺满」——约束边那条边的可见范围
//        正好等于世界尺寸，余量恒为 0。后果是无论怎么调 WORLD 的 w/h，
//        总有一类设备在某个方向上退化成「一张不能滚动的静态画」：
//          桌面 16:9 → vw 恰好 = w，横向锁死
//          手机竖屏 → vh 恰好 = h，纵向锁死
//        这是 max 的数学性质，不是参数没调好。
//
//        想同时满足 vw < w 且 vh < h，只能让 scale 同时大于两个比值，
//        即 scale > max(...)，所以乘一个 GROW > 1。
//        GROW = 1.15 时：横移 1580~7553，纵移 470，且留边为负
//        —— 世界仍然铺满甚至溢出视口，没有黑边，只是「世界比屏幕大一圈」。
//
//   2. 缓动 + 边界阻尼：拖动是即时的（tx/ty 直接跟随），但渲染值 x/y 用指数
//      缓动追上目标；相机被夹在世界边界内，顶到边界时阻尼会软化。
//   3. 所有实体只认世界坐标，渲染时才通过 toScreen / apply 转换。
import { clamp, damp } from '../core/config.js';
import { WORLD } from './terrain.js';
import { view, camera, camInput, touchAxis, CAM_SPEED, CAM_EASE, CAM_DAMP } from '../core/state.js';

// 世界相对视口的「溢出倍率」。1 = 恰好铺满（会锁死一个方向），
// 1.15 → 两个方向都留出约 13% 的可移动余量，观感上世界比屏幕大一圈。
const GROW = 1.15;

// 单轴「最多占世界多少」的上限 —— 这是 11A/11B 两轮踩坑后的最终形态。
//
// 【为什么还需要它】
//   光有 GROW 不够。scale = max(W/w, H/h) * GROW 的语义是「较紧的那条边放大到铺满」，
//   于是**较松的那条边必然只剩 1/GROW ≈ 87% 的余量**。这在横屏下无所谓
//   （宽是紧边，高度只占 87% 左右，还能上下走）。
//   但手机竖屏时**高变成了紧边**：vh = H/scale ≈ WORLD.h / GROW = 世界高的 87%。
//   后果不是「走不动」这么轻 —— 是**水线整个掉出相机可达范围**：
//     实测竖屏 390×844 时 vh = 2609，而世界高 3000，
//     相机 y 被夹在 [-1100, -709]，可水线在 y≈0 附近，
//     于是玩家一进游戏看到的是「一片没有岸的空海」，怎么拖都拖不到沙滩。
//   这个坑最初表现得像「世界没配好」——我按这个方向试过把 y0 从 -180 拉到 -1100、
//   把 h 从 1400 扩到 3000，全都无效：**世界变大，vh 同比变大，比例不变**。
//   真正的解法是给 scale 加一个下界，让那条「紧边」也不要紧到离谱。
//
// 【取值依据】
//   FILL_MAX = 0.72 表示「任何一条轴上，可见范围最多占世界的 72%」，
//   即至少留 28% 的移动余量。竖屏的 vh 因此从 2609 降到 3000*0.72 = 2160，
//   相机 y 可达区间扩到 [-1100, -260]，水线重新进入可达范围。
//   代价是竖屏下画面比原来「更远」，但这是唯一能保证「看得见岸」的代价。
const FILL_MAX = 0.72;

export function createCamera() {
  // 注意：vw/vh 必须「从第一帧起就是数字」。它们存在 camera 对象上而不是闭包变量，
  // 否则相机 resize 之前任何读取都会拿到 undefined，NaN 会顺着渲染管线一路扩散
  // （曾经导致 createLinearGradient 的 addColorStop 抛异常）。
  if (!Number.isFinite(camera.vw)) camera.vw = WORLD.w;
  if (!Number.isFinite(camera.vh)) camera.vh = WORLD.h;

  // 重新计算缩放与可见世界范围
  function resize() {
    if (!view.W || !view.H) return;
    const fit = Math.max(view.W / WORLD.w, view.H / WORLD.h);
    let scale = fit > 0 ? fit * GROW : 1;
    // 下界：保证可见范围不超过世界的 FILL_MAX。
    // 取两轴所需的最小 scale，谁超限就按谁收 —— 用 max 而不是分别处理，
    // 是因为 scale 是全局唯一的，必须同时满足两个方向的约束。
    const minScale = Math.max(view.W / (WORLD.w * FILL_MAX), view.H / (WORLD.h * FILL_MAX));
    if (scale < minScale) scale = minScale;
    camera.scale = scale;
    camera.vw = view.W / camera.scale;
    camera.vh = view.H / camera.scale;
    clampToBounds(true);
  }

  function bounds() {
    // maxX/maxY 用 max(..., min) 兜住「可见范围比世界还大」的极端视口
    // （GROW 不够大或窗口特别窄时可能出现），此时相机只能停在左上角，
    // 而不是让 tx 变成负数把世界推出画面。
    return {
      minX: WORLD.x0,
      maxX: Math.max(WORLD.x0, WORLD.x1 - camera.vw),
      minY: WORLD.y0,
      maxY: Math.max(WORLD.y0, WORLD.y1 - camera.vh),
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
      x1: Math.min(WORLD.x1, camera.x + camera.vw + pd),
      y1: Math.min(WORLD.y1, camera.y + camera.vh + pd),
      w: camera.vw + pd * 2,
      h: camera.vh + pd * 2,
    };
  }

  function inView(wx, wy, pad) {
    const pd = pad || 0;
    return (
      wx >= camera.x - pd &&
      wx <= camera.x + camera.vw + pd &&
      wy >= camera.y - pd &&
      wy <= camera.y + camera.vh + pd
    );
  }

  // 拖动平移（dx/dy 是屏幕像素增量）
  function panBy(dx, dy) {
    camera.tx -= dx / camera.scale;
    camera.ty -= dy / camera.scale;
    clampToBounds(false);
  }

  /** 拖视角期间置为 true：实体靠它决定「别追指针、别把这个手势当点击」 */
  function setDragging(on) {
    camera.dragging = !!on;
  }

  // 直接跳转（出生 / 读档）
  function jumpTo(wx, wy) {
    camera.tx = wx;
    camera.ty = wy;
    clampToBounds(true);
  }

  // 把某个世界点居中（考虑视口中心偏移）
  function centerOn(wx, wy, snap) {
    camera.tx = wx - camera.vw / 2;
    camera.ty = wy - camera.vh / 2;
    clampToBounds(!!snap);
  }

  // 兜底：任何一次 NaN 污染都必须在这里被掐死。
  // 不写这段的话后果非常隐蔽 —— ctx.setTransform(NaN, ...) 会被浏览器「静默忽略」，
  // 于是世界层退化成屏幕坐标，画面看起来一切正常（只是再也走不动了），
  // 直到某天有人去读 camera.x 才发现它是 NaN。判断必须用 isFinite，
  // 因为 NaN 的比较运算符恒为 false，`x < min` 这类写法拦不住 NaN。
  function sanitize() {
    if (!Number.isFinite(camera.vw) || camera.vw <= 0) camera.vw = WORLD.w;
    if (!Number.isFinite(camera.vh) || camera.vh <= 0) camera.vh = WORLD.h;
    if (!Number.isFinite(camera.scale) || camera.scale <= 0) camera.scale = 1;
    const b = bounds();
    if (!Number.isFinite(camera.tx)) camera.tx = b.minX;
    if (!Number.isFinite(camera.ty)) camera.ty = b.minY;
    camera.tx = clamp(camera.tx, b.minX, b.maxX);
    camera.ty = clamp(camera.ty, b.minY, b.maxY);
    if (!Number.isFinite(camera.x) || camera.x < b.minX - 1 || camera.x > b.maxX + 1) camera.x = camera.tx;
    if (!Number.isFinite(camera.y) || camera.y < b.minY - 1 || camera.y > b.maxY + 1) camera.y = camera.ty;
  }

  // 每帧更新：键盘输入 + 缓动
  function update(dt) {
    if (!view.W || !view.H) return;
    // 第一帧兜底：scale 还没算出来就直接补一次（不依赖 start() 的调用顺序）
    if (!Number.isFinite(camera.scale) || camera.scale <= 0) resize();
    sanitize();
    // 键盘 / 按钮移动：与触屏摇杆 touchAxis 合成（并存，互不覆盖）
    const ix = clamp(camInput.x + touchAxis.x, -1, 1);
    const iy = clamp(camInput.y + touchAxis.y, -1, 1);
    if (ix || iy) {
      const step = (CAM_SPEED * dt) / 1000;
      camera.tx += ix * step;
      camera.ty += iy * step;
      clampToBounds(false);
    }
    // 缓动：拖完松手后轻微回落，方向键则平滑推进
    const rate = CAM_EASE * (0.6 + CAM_DAMP * 0.6);
    camera.x = damp(camera.x, camera.tx, rate, dt);
    camera.y = damp(camera.y, camera.ty, rate, dt);
    sanitize();
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
    setDragging,
    jumpTo,
    centerOn,
    bounds,
    get scale() {
      return camera.scale;
    },
    get vw() {
      return camera.vw;
    },
    get vh() {
      return camera.vh;
    },
  };
}
