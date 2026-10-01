// ============================================================
//  温和大鱼（阶段五 · 4.2） / 饥饿大鱼（阶段八 8B 冒险模式）
//  - 和平模式：非捕食者，缓慢好奇，靠近水母群时令其温和散开（复用 scare）
//  - 冒险模式：掠食者，加速逼近，接触时叼走一只水母（中档失败）
//  - 读取 current.sample() 施加到自身速度 → 玩家洋流可把它推开
//  - 状态机：wander（漂移/趋向水母群中心） → approach（靠近并轻散水母）
// ============================================================

import { rand, TAU } from '../core/config.js';
import { camera } from '../core/state.js';
import { WORLD } from '../systems/terrain.js';
// 期二：大鱼同样接入共享光照。它是最"贴脸"的水下生物（会来叼水母），
// 一旦它还是平涂，玩家对"这个世界有立体感"的信任就会崩。
import {
  hslTriple, rgba, shade, specular, rimLight,
  sphereVolume, capsuleVolume, signals, depthLight, makeCache,
} from '../render/volume.js';

export class BigFish {
  constructor(mode = 'peace') {
    // 【期二修正】历史上大鱼的 x/y 是**屏幕坐标**（rand(0, view.W)），
    // 世界坐标化之后其它实体都在世界里游，只有它在屏幕空间 →
    // 相机一移动它就跟世界脱钩（贴着屏幕漂）。
    // 这里统一迁到世界坐标：出生在当前视口的水域里，之后按世界边界环绕。
    this.x = camera.x + rand(0.15, 0.85) * camera.vw;
    this.y = camera.y + rand(0.2, 0.8) * camera.vh;
    this.vx = rand(-0.4, 0.4);
    this.vy = rand(-0.2, 0.2);
    this.size = rand(34, 46);
    this.hue = rand(200, 260);
    // 期二：受光颜色用 'R,G,B'（旧版是 hsla 字符串，shade() 处理不了）
    this.base = hslTriple(this.hue, 55, 62);
    // 掠食者的体色：往红里推（保留原设计"一眼看出是掠食者"的意图）
    this.predBase = hslTriple((this.hue - 180 + 360) % 360, 60, 52);
    this.state = 'wander';
    this.wob = rand(0, TAU);
    this.flash = 0;          // 靠近水母时的微光
    this.nearJellies = false; // 供 ecosystem 检测上升沿
    this.mode = mode;         // 'peace' | 'adventure'
    this.snatchCooldown = 0;  // 叼走后冷却，避免连吃
    this.hunting = 0;         // 冒险模式下捕捉时的高亮
    this.depthNorm = 0;       // 每帧刷新，决定受光
    this._cache = makeCache();
  }

  setMode(m) { this.mode = m; }
  get isPredator() { return this.mode === 'adventure'; }

  update(dt, t, jellyArray, current, opts = {}) {
    const dtScale = dt / 16.667;
    const predator = this.mode === 'adventure';
    // 冒险模式更凶：加速上限与逼近力度都提高
    const max = predator ? 2.6 : 1.6;
    const onSnatch = opts.onSnatch;      // 回调：(jelly) => void

    if (this.snatchCooldown > 0) this.snatchCooldown = Math.max(0, this.snatchCooldown - dt);

    // 玩家洋流对大鱼生效（技巧落点：用洋流把它引开）
    if (current) {
      const c = current.sample(this.x, this.y, t);
      this.vx += c.vx * 0.5 * dtScale;
      this.vy += c.vy * 0.5 * dtScale;
    }

    // 水母群中心 & 最近个体
    let cx = 0, cy = 0, n = 0, nearest = Infinity, nx = 0, ny = 0, nearJ = null;
    for (const j of jellyArray) {
      cx += j.x; cy += j.y; n++;
      const d = Math.hypot(j.x - this.x, j.y - this.y);
      if (d < nearest) { nearest = d; nx = j.x; ny = j.y; nearJ = j; }
    }
    if (n > 0) { cx /= n; cy /= n; }

    const approachR = predator ? 300 : 320;

    if (nearest < approachR) {
      this.state = 'approach';
      this.nearJellies = true;
      const dx = nx - this.x, dy = ny - this.y, d = Math.hypot(dx, dy) || 1;
      // 冒险模式逼近更猛
      const push = predator ? 0.16 : 0.06;
      this.vx += (dx / d) * push * dtScale;
      this.vy += (dy / d) * push * dtScale;

      if (predator) {
        this.hunting = Math.min(1, this.hunting + 0.05 * dtScale);
        // 接触 → 叼走一只（若目标不在礁石庇护内、且未被玩家"抱住"）
        const dist = Math.hypot(nearJ.x - this.x, nearJ.y - this.y);
        const sheltered = opts.isSheltered ? opts.isSheltered(nearJ.x, nearJ.y) : false;
        if (dist < this.size * 1.1 && !sheltered && this.snatchCooldown <= 0 && onSnatch) {
          const taken = onSnatch(nearJ);
          if (taken) {
            this.snatchCooldown = 2600;
            this.flash = 1;
          }
        }
      } else {
        // 和平模式：温和令附近水母散开（非暴力）
        for (const j of jellyArray) {
          if (Math.hypot(j.x - this.x, j.y - this.y) < 150 && j.scare) j.scare();
        }
      }
      this.flash = Math.min(1, this.flash + 0.04 * dtScale);
    } else {
      this.state = 'wander';
      this.nearJellies = false;
      this.hunting = Math.max(0, this.hunting - 0.02 * dtScale);
      if (n > 0) {
        const dx = cx - this.x, dy = cy - this.y, d = Math.hypot(dx, dy) || 1;
        this.vx += (dx / d) * 0.012 * dtScale;
        this.vy += (dy / d) * 0.012 * dtScale;
      }
      // 缓慢环绕漂移
      this.vx += Math.cos(t * 0.0003 + this.wob) * 0.01 * dtScale;
      this.vy += Math.sin(t * 0.0003 + this.wob) * 0.01 * dtScale;
      this.flash *= Math.pow(0.95, dtScale);
    }

    this.vx *= Math.pow(0.97, dtScale);
    this.vy *= Math.pow(0.98, dtScale);
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > max) { this.vx = (this.vx / sp) * max; this.vy = (this.vy / sp) * max; }

    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;

    const m = this.size;
    // 期二：环绕边界改用**世界**边界（原来是 view.W/view.H 的屏幕边界）。
    // 走出左边界就从右边界回来 —— 和 FishSchool / Turtle 同一套约定。
    if (this.x < WORLD.x0 - m) this.x = WORLD.x1 + m;
    if (this.x > WORLD.x1 + m) this.x = WORLD.x0 - m;
    if (this.y < WORLD.y0 - m) this.y = WORLD.y1 + m;
    if (this.y > WORLD.y1 + m) this.y = WORLD.y0 - m;

    // 期二：刷新水深 → 决定体色的水色偏移与受光强度
    this.depthNorm = signals.depthNorm(this.x, this.y);

    this.wob += 0.02 * dtScale;
    return true;
  }

  draw(ctx) {
    const ang = Math.atan2(this.vy, this.vx);
    const predator = this.mode === 'adventure';
    const s = this.size;
    const dn = this.depthNorm || 0;
    const L = depthLight(dn);
    // 掠食与和平时用不同基色，但走同一套受光
    const base = predator ? this.predBase : this.base;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(ang);

    // —— 尾鳍（压在身后）——
    // 身体胶囊到 -s*0.9 收圆，所以尾鳍必须从 -s*0.86 起、与身体重叠一点，
    // 中间不能留缝。（试过单独加一段"尾柄"，但那个方块在屏幕上读作
    //  一块独立的矩形，比留缝还难看；正确做法是让尾鳍直接咬住身体。）
    ctx.fillStyle = rgba(shade(base, -0.2), 0.9);
    ctx.beginPath();
    ctx.moveTo(-s * 0.86, 0);
    ctx.quadraticCurveTo(-s * 1.24, -s * 0.3, -s * 1.46, -s * 0.44);
    ctx.quadraticCurveTo(-s * 1.18, -s * 0.06, -s * 1.34, 0);
    ctx.quadraticCurveTo(-s * 1.18, s * 0.06, -s * 1.46, s * 0.44);
    ctx.quadraticCurveTo(-s * 1.24, s * 0.3, -s * 0.86, 0);
    ctx.closePath();
    ctx.fill();

    // —— 背鳍 ——
    ctx.fillStyle = rgba(shade(base, -0.1), 0.85);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.42);
    ctx.quadraticCurveTo(s * 0.0, -s * 0.92, s * 0.3, -s * 0.4);
    ctx.quadraticCurveTo(s * 0.05, -s * 0.44, -s * 0.2, -s * 0.42);
    ctx.closePath();
    ctx.fill();

    // —— 身体：受光胶囊（头钝尾细）——
    capsuleVolume(ctx, s * 0.92, 0, -s * 0.9, 0, s * 0.56, s * 0.3,
      base, { depth: dn, light: L.light, cache: this._cache, key: 'bfb' });

    // —— 腹部回光（下方水面反射上来的光）——
    sphereVolume(ctx, s * 0.12, s * 0.2, s * 0.5, shade(base, 0.34), {
      ry: 0.32, depth: dn, light: L.light * 0.8, alpha: 0.34,
      cache: this._cache, key: 'bfv',
    });

    // —— 背脊高光 + 上缘亮环 ——
    // 亮环用独立纵向半径（o.ry）：身体是"长而扁"的（竖向只有 0.56s），
    // 正圆亮环会飘到身体上方（实测截图里大鱼头顶的游离弧线）。
    specular(ctx, s * 0.1, -s * 0.3, s * 0.42, s * 0.13,
      { alpha: 0.22 * L.light, rot: -0.12 });
    rimLight(ctx, 0, 0, s * 0.95, shade(base, 0.6), {
      alpha: 0.24 * L.light, width: 1.4, cy: -0.05, rk: 0.9, ry: 0.5,
      from: Math.PI * 1.18, to: Math.PI * 1.82,
    });

    // —— 靠近水母时的柔光 / 捕捉时的红光（语义完全保留）——
    const glow = predator ? Math.max(this.flash, this.hunting) : this.flash;
    if (glow > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = predator
        ? `rgba(255, 90, 90, ${glow * 0.6})`
        : `rgba(255, 180, 140, ${glow * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.3, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    // —— 眼睛（黑瞳 + 反光点）——
    ctx.fillStyle = rgba('10,20,36', 0.85);
    ctx.beginPath();
    ctx.arc(s * 0.58, -s * 0.14, s * 0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba('240,252,255', 0.9);
    ctx.beginPath();
    ctx.arc(s * 0.62, -s * 0.19, s * 0.045, 0, TAU);
    ctx.fill();

    // —— 牙齿（仅冒险模式，强化"掠食"感）——
    if (predator) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.moveTo(this.size * 0.62, this.size * 0.16);
      ctx.lineTo(this.size * 0.78, this.size * 0.34);
      ctx.lineTo(this.size * 0.86, this.size * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
