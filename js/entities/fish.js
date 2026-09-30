// ============================================================
//  鱼群（Boids）
// ============================================================

import { rand } from '../core/config.js';
import { pointer, camera, screenToWorld, screenRadius } from '../core/state.js';
import { WORLD } from '../systems/terrain.js';

export class Fish {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = rand(-1.5, 1.5);
    this.vy = rand(-1, 1);
    this.size = rand(3, 6);
    this.color = `hsl(${rand(180, 220)}, 70%, ${rand(60, 80)}%)`;
  }
}

export class FishSchool {
  constructor(cx, cy, count) {
    this.fish = [];
    for (let i = 0; i < count; i++) {
      this.fish.push(new Fish(cx + rand(-80, 80), cy + rand(-50, 50)));
    }
    this.cx = cx; this.cy = cy;
  }

  /** bait 可选：饵料对象 {x,y}，用于聚集 */
  update(dt, t, bait) {
    const dtScale = dt / 16.667;
    // 阶段十一：鱼群在世界坐标里游动，边界 = 世界边界
    const W = WORLD.x1, H = WORLD.y1;
    const x0 = WORLD.x0, y0 = WORLD.y0;
    const max = 2.5;

    for (const f of this.fish) {
      let cohX = 0, cohY = 0, sepX = 0, sepY = 0, aliX = 0, aliY = 0, count = 0;
      for (const o of this.fish) {
        if (o === f) continue;
        const dx = o.x - f.x, dy = o.y - f.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 60 * 60) {
          cohX += o.x; cohY += o.y; aliX += o.vx; aliY += o.vy; count++;
          if (d2 < 20 * 20 && d2 > 0) {
            const d = Math.sqrt(d2);
            sepX -= dx / d; sepY -= dy / d;
          }
        }
      }
      if (count > 0) {
        cohX = (cohX / count - f.x) * 0.005;
        cohY = (cohY / count - f.y) * 0.005;
        aliX = (aliX / count - f.vx) * 0.05;
        aliY = (aliY / count - f.vy) * 0.05;
      }
      let ax = cohX + sepX * 0.3 + aliX;
      let ay = cohY + sepY * 0.3 + aliY;

      // 绕中心
      ax += (this.cx - f.x) * 0.0003;
      ay += (this.cy - f.y) * 0.0003;

      // 躲避指针（指针是屏幕坐标，先转到世界；半径按相机缩放折算）
      if (pointer.active && !camera.dragging) {
        const pw = screenToWorld(pointer.x, pointer.y);
        const reach = screenRadius(120);
        const dx = f.x - pw.x, dy = f.y - pw.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach * reach) {
          const d = Math.sqrt(d2) || 1;
          ax += (dx / d) * 0.8;
          ay += (dy / d) * 0.8;
        }
      }

      // 追饵
      if (bait) {
        const dx = bait.x - f.x, dy = bait.y - f.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 340) {
          const strength = (1 - d / 340) * 0.45;
          ax += (dx / d) * strength;
          ay += (dy / d) * strength;
        }
      }

      f.vx += ax * dtScale; f.vy += ay * dtScale;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > max) { f.vx = (f.vx / sp) * max; f.vy = (f.vy / sp) * max; }
      f.x += f.vx * dtScale; f.y += f.vy * dtScale;

      if (f.x < x0) f.vx += 0.1;
      if (f.x > W) f.vx -= 0.1;
      if (f.y < y0) f.vy += 0.1;
      if (f.y > H) f.vy -= 0.1;
    }

    const now = t || 0;
    this.cx += Math.sin(now * 0.0001 + this.cy) * 0.3;
    this.cy += Math.cos(now * 0.00008) * 0.2;
    // 中心在世界里循环（围绕世界宽度取模，而不是视口）
    this.cx = WORLD.w > 0 ? x0 + (((this.cx - x0) % WORLD.w) + WORLD.w) % WORLD.w : this.cx;
    this.cy = Math.max(y0 + WORLD.h * 0.15, Math.min(y0 + WORLD.h * 0.85, this.cy));
  }

  draw(ctx) {
    for (const f of this.fish) {
      const ang = Math.atan2(f.vy, f.vx);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(ang);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(f.size, 0);
      ctx.lineTo(-f.size, f.size * 0.5);
      ctx.lineTo(-f.size * 0.6, 0);
      ctx.lineTo(-f.size, -f.size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
