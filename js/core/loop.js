// ============================================================
//  统一 systems 调度器
//  契约（除 id 外全部可选）：
//    id        : string
//    order     : number            越小越先绘制
//    update(dt,t)   -> void|false
//    draw(ctx,t)    -> void
//    entities  : Array             池化实体，倒序遍历，update 返回 false 即回收
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
    tick(ctx, dt, t) {
      for (let s = 0; s < systems.length; s++) {
        const sys = systems[s];
        // 1) 单例/纯函数层
        if (sys.update) sys.update(dt, t);
        // 2) 实体增删
        if (sys.reconcile) sys.reconcile(dt, t);
        // 3) 实体层：倒序遍历，就地回收
        if (sys.entities) {
          const arr = sys.entities;
          for (let i = arr.length - 1; i >= 0; i--) {
            const e = arr[i];
            // Seaweed 之类没有 update，视为常驻
            const alive = e.update ? e.update(dt, t) : true;
            if (alive === false) { arr.splice(i, 1); continue; }
            if (e.draw) e.draw(ctx, t);
          }
        } else if (sys.draw) {
          sys.draw(ctx, t);
        }
      }
    },
  };
}
