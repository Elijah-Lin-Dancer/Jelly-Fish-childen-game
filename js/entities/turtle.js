// ============================================================
//  海龟
// ============================================================

import { rand, TAU, CREATURE_SCALE } from '../core/config.js';
import { WORLD } from '../systems/terrain.js';
// 期二：龟壳做成真正的"穹顶"（受光球体），而不是一块椭圆平涂
import {
  hslTriple, rgba, shade, specular, rimLight,
  sphereVolume, capsuleVolume, signals, depthLight, makeCache,
} from '../render/volume.js';

export class Turtle {
  // 阶段十一：海龟改为世界坐标，在整张地图上巡游（不再只在一个视口里打转）
  constructor(x, y) {
    this.x = x ?? rand(WORLD.x0, WORLD.x1);
    this.y = y ?? rand(WORLD.y0 + WORLD.h * 0.25, WORLD.y0 + WORLD.h * 0.6);
    this.vx = rand(0.4, 0.9) * (Math.random() < 0.5 ? 1 : -1);
    this.dir = this.vx > 0 ? 1 : -1;
    this.flap = 0;
    // 尺寸相对陆地参照校准（见 config.CREATURE_SCALE）：
    // 体长 30~46 → 约 20~30，与遮阳伞盘径同量级。
    this.size = rand(30, 46) * CREATURE_SCALE.turtle;
    // 期二：龟甲做成 'R,G,B' 三元组（旧版是 rgba 字符串，shade() 处理不了）
    //   亮度比初版调高：初版 34% 明度在深水背景里糊成一团灰，看不出甲色。
    this.shell = hslTriple(rand(178, 205), 32, 44);   // 深青褐甲
    this.skin = hslTriple(rand(170, 195), 26, 54);    // 鳍/头
    this.depthNorm = 0;
    this._cache = makeCache();
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.flap += 0.06 * dtScale;
    this.x += this.vx * dtScale;
    this.y += Math.sin(this.flap * 0.5) * 0.2 * dtScale;
    // 期二：刷新水深，供 draw() 算受光
    this.depthNorm = signals.depthNorm(this.x, this.y);
    // 环绕边界用「可见世界」的两端，走出左边界就从右边界回来
    if (this.x < WORLD.x0 - 120) { this.x = WORLD.x1 + 120; this.dir = 1; this.vx = Math.abs(this.vx); }
    if (this.x > WORLD.x1 + 120) { this.x = WORLD.x0 - 120; this.dir = -1; this.vx = -Math.abs(this.vx); }
    return true;
  }

  draw(ctx) {
    const s = this.size;
    const dn = this.depthNorm || 0;
    const L = depthLight(dn);
    // 摆鳍：正弦在 [-1,1]，映射成上下拍动
    const flap = Math.sin(this.flap) * 0.5;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);

    // —— 后鳍（压在壳下，先画）——
    drawFlipper(ctx, -s * 0.5, 0, s, -flap, this.skin, dn, L, this._cache);

    // —— 头与颈：胶囊斜向前 ——
    capsuleVolume(ctx, s * 0.7, -s * 0.02, s * 1.15, -s * 0.06, s * 0.2, s * 0.15,
      this.skin, { depth: dn, light: L.light, cache: this._cache, key: 'th' });
    // 眼睛
    ctx.fillStyle = rgba('10,20,34', 0.8);
    ctx.beginPath();
    ctx.arc(s * 1.05, -s * 0.14, Math.max(0.8, s * 0.055), 0, TAU);
    ctx.fill();

    // —— 龟甲：受光穹顶 ——
    // 用 sphereVolume 的压扁椭圆（ry=0.62），光源朝上 → 甲面自然分出明暗。
    // 深度为 0 时甲色保留原样（浅水），深海自动偏蓝 —— 走 coldFactor。
    sphereVolume(ctx, 0, 0, s, this.shell, {
      ry: 0.62, depth: dn, light: L.light, cache: this._cache, key: 'sh',
    });
    // 甲面高光（穹顶最亮点，位置朝光源）
    specular(ctx, -s * 0.24, -s * 0.28, s * 0.36, s * 0.17,
      { alpha: 0.24 * L.light, rot: -0.28 });
    // 甲缘亮环（上缘被海面来的光扫到）
    // ⚠ 龟甲是压扁椭圆（ry=0.62），亮环必须用独立纵向半径贴着甲面走，
    //   否则正圆弧会飘到壳上方（实测截图里海龟头顶的游离弧线）。
    rimLight(ctx, 0, 0, s, shade(this.shell, 0.55), {
      alpha: 0.26 * L.light, width: 1.4, cy: 0, rk: 0.94, ry: 0.58,
      from: Math.PI * 1.1, to: Math.PI * 1.9,
    });

    // —— 甲纹：5 道纵向脊线，沿穹顶的明暗走（不再是等亮度描边）——
    ctx.save();
    ctx.lineWidth = Math.max(0.9, s * 0.045);
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const fx = i * s * 0.25;
      // 脊线亮度跟着穹顶明暗：左半边（受光侧）更亮
      const lit = 1 - Math.abs(i + 2) / 4;
      const a = (0.16 + lit * 0.3) * (0.5 + L.light * 0.5);
      ctx.strokeStyle = rgba(shade(this.shell, 0.5), a);
      ctx.beginPath();
      ctx.ellipse(fx, -s * 0.02, s * 0.15, s * 0.44, 0, 0, TAU);
      ctx.stroke();
    }
    // 甲纹的暗侧：让每道脊有"两侧一明一暗"的浮雕感
    ctx.strokeStyle = rgba(shade(this.shell, -0.5), 0.22);
    ctx.lineWidth = Math.max(0.7, s * 0.03);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * s * 0.25 + s * 0.045, -s * 0.02, s * 0.15, s * 0.44, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // —— 前鳍（拍动，盖在壳上缘）——
    drawFlipper(ctx, s * 0.5, 0, s, flap, this.skin, dn, L, this._cache);

    // —— 腹部接地暗边 ——
    // 初版用 earthVolume 画了一条矩形的横带，结果从压扁的龟甲两侧"露出角"，
    // 像贴了一条黑胶布。改成沿甲形压一道柔和的暗弧（跟着椭圆走）。
    ctx.save();
    ctx.globalAlpha = 0.3 * (0.4 + L.light * 0.6);
    ctx.strokeStyle = rgba(shade(this.shell, -0.55), 0.8);
    ctx.lineWidth = Math.max(1.2, s * 0.09);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.06, s * 0.9, s * 0.56, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}

/** 一只鳍：受光胶囊 + 鳍尖亮边（两处调用共用，避免两段重复代码） */
function drawFlipper(ctx, ox, oy, s, flap, skin, dn, L, cache) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(flap);
  const dirX = ox >= 0 ? 1 : -1;
  capsuleVolume(ctx, 0, 0, dirX * s * 0.42, 0, s * 0.17, s * 0.1,
    skin, { depth: dn, light: L.light, alpha: 0.9, cache, key: 'fl' + dirX });
  // 鳍尖亮边（鳍是细长胶囊，正圆环刚好贴边）
  rimLight(ctx, dirX * s * 0.42, 0, s * 0.16, shade(skin, 0.5),
    { alpha: 0.2 * L.light, width: 1, cy: -0.05, rk: 0.9 });
  ctx.restore();
}
