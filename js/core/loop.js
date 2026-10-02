// ============================================================
//  统一 systems 调度器
//  契约（除 id 外全部可选）：
//    id        : string
//    order     : number            越小越先绘制
//    space     : 'world' | 'screen'
//                'world'  → 绘制前套上相机变换，draw 里直接用世界坐标
//                'screen' → 默认，画布坐标（HUD / 全屏遮罩 / 长按环）
//                update 阶段始终不套相机变换（逻辑一律在世界坐标里算）
//    update(dt,t)   -> void|false
//    draw(ctx,t)    -> void
//    entities  : Array             池化实体，倒序遍历，update 返回 false 即回收
//    noDraw    : true              实体仍更新/回收，但绘制让给别的层
//                                  （深度分层：中景实体按 z-lane 在 swim 带里排序画）
//    reconcile(dt,t) -> void        实体增删
// ============================================================

export function createScheduler() {
  const systems = [];

  return {
    add(s) {
      systems.push(s);
      systems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return s;
    },
    get all() { return systems; },
    clear() { systems.length = 0; },
    // camera 可选：给了就启用地形的世界坐标空间支持
    tick(ctx, dt, t, camera) {
      for (let s = 0; s < systems.length; s++) {
        const sys = systems[s];
        // 1) 单例/纯函数层
        if (sys.update) sys.update(dt, t);
        // 2) 实体增删
        if (sys.reconcile) sys.reconcile(dt, t);

        // 3) 绘制：按 space 决定要不要套相机变换（noDraw 的层只更新不画）
        //
        // ⚠ 变换顺序必须「先 scale 后 translate」，不能反过来（这是个真改过 bug）。
        //   Canvas 的变换是「后声明先作用」：这里两行的实际语义是
        //     先 translate(-cam) 再 scale(s)  →  屏幕 = s·p - cam   （错）
        //     先 scale(s) 再 translate(-cam)  →  屏幕 = s·(p - cam) （对）
        //   权威模型（state.js 注释 / screenToWorld / camera.toScreen /
        //   地形层 scenery.js 的逐列换算）全都是 s·(p - cam)。
        //   两者相差 (1 - scale)·camera —— 出生点附近相机约 (0, -300)、
        //   scale≈0.556，偏差仅约 130px 不易察觉；相机拖到岛附近
        //   （cam.y≈-1050）偏差就涨到约 466px，表现为「岸上建筑漂到岛外」
        //   「点击位置与所见不符」。所有世界实体都受影响。
        const world = sys.space === 'world' && camera && !sys.noDraw;
        if (world) {
          ctx.save();
          ctx.scale(camera.scale, camera.scale);
          ctx.translate(-camera.x, -camera.y);
        }

        if (sys.entities) {
          const arr = sys.entities;
          for (let i = arr.length - 1; i >= 0; i--) {
            const e = arr[i];
            // Seaweed 之类没有 update，视为常驻
            const alive = e.update ? e.update(dt, t) : true;
            if (alive === false) { arr.splice(i, 1); continue; }
            if (!sys.noDraw && e.draw) e.draw(ctx, t);
          }
        } else if (sys.draw) {
          sys.draw(ctx, t);
        }

        if (world) ctx.restore();
      }
    },
  };
}
