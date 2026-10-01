// ============================================================
//  鱼群（Boids）
// ============================================================

import { rand } from '../core/config.js';
import { pointer, camera, screenToWorld, screenRadius } from '../core/state.js';
import { WORLD } from '../systems/terrain.js';
// 期二：受光与体积走全游戏共享的光照库，鱼才能和地形/水母处在同一套光下
import {
  TAU, hslTriple, rgba, shade, specular, rimLight,
  sphereVolume, capsuleVolume, signals, depthLight, makeCache,
} from '../render/volume.js';

export class Fish {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = rand(-1.5, 1.5);
    this.vy = rand(-1, 1);
    this.size = rand(3, 6);
    // 期二：配色从 hsl 字符串换成 'R,G,B' 三元组 —— 只有三元组能被 shade()
    // 处理，也才能跟着光源走。色相仍是原来的 180~220（青蓝鱼）。
    this.hue = rand(180, 220);
    this.lightness = rand(60, 80);
    this.color = hslTriple(this.hue, 70, this.lightness);
    // 每帧刷新的"我在多深"（0~1），由 FishSchool 统一注入。
    // 存成字段而不是每帧重算：一条鱼的颜色由它自己所在的水深决定。
    this.depthNorm = 0;
    // 尾摆相位（让鱼群里有快有慢，不是一块僵硬的贴片）
    this.phase = rand(0, TAU);
    this.fin = rand(0.7, 1.3);
  }
}

export class FishSchool {
  constructor(cx, cy, count) {
    this.fish = [];
    for (let i = 0; i < count; i++) {
      this.fish.push(new Fish(cx + rand(-80, 80), cy + rand(-50, 50)));
    }
    this.cx = cx; this.cy = cy;
    // 光晕/体积渐变的缓存（按尺寸+颜色做 key，跨帧复用）
    this._cache = makeCache();
    this._phase = 0;
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

      // 期二：刷新"我在多深"。取一次地形采样，钱花在刀刃上 ——
      // 只在移动之后算，而且结果直接决定这条鱼这一帧的颜色。
      f.depthNorm = signals.depthNorm(f.x, f.y);

      if (f.x < x0) f.vx += 0.1;
      if (f.x > W) f.vx -= 0.1;
      if (f.y < y0) f.vy += 0.1;
      if (f.y > H) f.vy -= 0.1;
    }

    this._phase += 0.18 * dtScale;   // 摆尾时钟（与 t 解耦，便于暂停/变速）

    const now = t || 0;
    this.cx += Math.sin(now * 0.0001 + this.cy) * 0.3;
    this.cy += Math.cos(now * 0.00008) * 0.2;
    // 中心在世界里循环（围绕世界宽度取模，而不是视口）
    this.cx = WORLD.w > 0 ? x0 + (((this.cx - x0) % WORLD.w) + WORLD.w) % WORLD.w : this.cx;
    this.cy = Math.max(y0 + WORLD.h * 0.15, Math.min(y0 + WORLD.h * 0.85, this.cy));
  }

  draw(ctx) {
    // 期二：鱼不再是"一个实心三角"，而是「受光的椭球身体 + 摆动的尾鳍 +
    // 一点高光和边缘光」。三条改动都是为了让鱼和地形/水母共享同一套光：
    //   1. 身体用 capsuleVolume —— 亮面朝 LIGHT，暗面沉下去；
    //   2. 深度决定冷色偏移与亮度（浅水保留本色，深海偏蓝）；
    //   3. 高光椭圆 + 上缘亮环 —— 和水母伞盖用的同两个函数。
    const t = this._phase;
    for (const f of this.fish) {
      const ang = Math.atan2(f.vy, f.vx);
      // 摆尾：相位随个体不同，频率跟速度走（游得快摆得快）
      const sp = Math.hypot(f.vx, f.vy);
      const wag = Math.sin(t * f.fin + f.phase) * (0.5 + Math.min(1, sp / 2)) * 0.5;

      const r = f.size;
      if (r < 0.4) continue;      // 太小，画了看不见
      const dn = f.depthNorm || 0;
      const L = depthLight(dn);

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(ang);

      // 尾鳍：绕身体尾端摆动（先画尾，压在身后）
      // 用"两片叉开的薄鳍"而不是一根胶囊 —— 小鱼在屏幕上只有几像素，
      // 一根和身体同色的胶囊完全看不出是尾巴（实测截图里鱼像一根小棒）。
      const tailA = -r * 0.78;
      ctx.save();
      ctx.translate(tailA, 0);
      ctx.rotate(wag);
      ctx.fillStyle = rgba(shade(f.color, -0.34), 0.92);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.5, -r * 0.2, -r * 0.95, -r * 0.62);
      ctx.quadraticCurveTo(-r * 0.6, -r * 0.05, -r * 0.95, r * 0.62);
      ctx.quadraticCurveTo(-r * 0.5, r * 0.2, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 身体：横置胶囊（头略粗、尾略细），受光方向交给共享库
      capsuleVolume(ctx, r * 0.92, 0, -r * 0.82, 0, r * 0.66, r * 0.32,
        f.color, { depth: dn, light: L.light, cache: this._cache, key: 'fb' });

      // 高光：身体背部靠前的位置（与光源同侧）
      if (r > 2.4) {
        specular(ctx, r * 0.18, -r * 0.3, r * 0.4, r * 0.16, { alpha: 0.26 * L.light, rot: -0.16 });
        // 上缘亮环：把鱼从背景里"拎"出来，和水母伞盖同一手法。
        // 身体是长扁胶囊（竖向最高 0.66r），亮环用独立纵向半径贴着背走，
        // 否则正圆弧会飘到身体上方（实测可见小鱼头顶的游离弧线）。
        rimLight(ctx, 0, 0, r, shade(f.color, 0.5), {
          alpha: 0.2 * L.light, width: 1, cy: -0.08, rk: 0.85, ry: 0.55,
          from: Math.PI * 1.2, to: Math.PI * 1.8,
        });
      }

      // 眼睛：黑点 + 一点反光（小鱼的眼睛才是"活"的关键）
      if (r > 3.2) {
        ctx.fillStyle = rgba('12,22,40', 0.82);
        ctx.beginPath();
        ctx.arc(r * 0.52, -r * 0.16, r * 0.15, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba('235,250,255', 0.75);
        ctx.beginPath();
        ctx.arc(r * 0.56, -r * 0.21, r * 0.055, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
