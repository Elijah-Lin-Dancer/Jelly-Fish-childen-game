// ============================================================
//  远景鲸鱼（体积剪影 + 喷气泡）
// ============================================================

import { rand, TAU } from '../core/config.js';
import { WORLD } from '../systems/terrain.js';
// 期二：鲸鱼虽然只是"远景剪影"，但它仍然是一团有体积的身体。
// 用共享库画，它的受光方向才和地形、水母一致 —— 否则会出现
// 「所有东西都从左上来光，只有鲸鱼是平的」这种破功。
import {
  rgba, shade,
  signals, depthLight, makeCache,
} from '../render/volume.js';

// 鲸鱼是**远洋**生物：出现的地方必须水深足够。
// 否则它（半透明深色剪影）会直接压在浅色岛体上，看着像一块污渍。
// 用 depthAt 作判据 —— 这是地形的权威采样，陆地为负、浅滩接近 0。
const MIN_DEPTH = 260;

/** 由 main 注入地形采样（避免实体反向依赖 main 的单例） */
let depthAtFn = null;
export function setWhaleTerrain(tp) {
  depthAtFn = tp ? (x, y) => tp.depthAt(x, y) : null;
}

export class Whale {
  constructor(onBlow) {
    this.onBlow = onBlow;
    // 期二：剪影基色做成 'R,G,B' 三元组，方便跟随深度与光源。
    //   比初版(14,32,54)略亮，但不追求"亮"—— 鲸鱼是远景剪影，
    //   调太亮会变成一条糊在背景上的灰鱼（实测过 30,56,86 就过头了）。
    this.body = '22,44,72';
    this.belly = '62,96,132';
    // 每帧刷新的水深（0~1）；渲染层可以用它做更细的受光衰减
    this.depthNorm = 0.5;
    this._cache = makeCache();
    this.reset(true);
  }

  /** 在世界的远洋层里找一个水深够的位置（尝试若干次，失败就取最深的） */
  _deepY() {
    // 搜索范围覆盖「远洋层 + 深处」：岛型地形的深水在岛体**下方**，
    // 只扫上半段会找不到够深的位置（实测 slope 下鲸鱼落点 depth=-133）。
    const y0 = WORLD.y0 + WORLD.h * 0.22;
    const y1 = WORLD.y0 + WORLD.h * 0.78;
    if (!depthAtFn) return rand(y0, y1);
    let best = null, bestD = -Infinity;
    for (let i = 0; i < 24; i++) {
      const y = rand(y0, y1);
      const d = depthAtFn(this.x, y);
      if (d >= MIN_DEPTH) return y;
      if (d > bestD) { bestD = d; best = y; }
    }
    return best === null ? rand(y0, y1) : best;
  }

  reset(initial) {
    // 阶段十一：鲸鱼横穿整个世界的远洋层
    this.x = initial ? rand(WORLD.x0, WORLD.x1) : WORLD.x0 - 260;
    this.y = this._deepY();
    this.vx = rand(0.3, 0.6);
    this.size = rand(140, 220);
    this.blowTimer = rand(200, 500);
    this.drift = rand(0, TAU);
  }

  update(dt) {
    const dtScale = dt / 16.667;
    this.x += this.vx * dtScale;
    this.drift += 0.0003 * dt;
    this.y += Math.sin(this.drift) * 0.15 * dtScale;

    // 若飘到浅水/陆地上（岛的外缘、岸边沙滩），往下潜回深水。
    // 用"向下推"而不是瞬移：鲸鱼的可爱之处就是慢慢游。
    if (depthAtFn) {
      const d = depthAtFn(this.x, this.y);
      if (d < MIN_DEPTH) {
        // 分两档：擦到浅滩就慢慢下潜；已经压在陆地/岛体上（depth<0）
        // 说明"慢慢游"救不回来（1.2/帧 相对岛体尺度太慢，玩家会先看到
        // 一条鲸鱼糊在沙滩上），这时候必须干脆地换一个够深的位置。
        if (d < 0) {
          this.y = this._deepY();
        } else {
          this.y += 1.2 * dtScale;
        }
      }
      // 期二：把绝对水深归一化后留给渲染层 —— 鲸鱼在不同深度
      // 该有不同的明度（深处更沉、更融进背景的雾里）
      this.depthNorm = signals.depthNorm(this.x, this.y);
    }

    this.blowTimer -= dtScale;
    if (this.blowTimer <= 0) {
      if (this.onBlow) this.onBlow(this.x + this.size * 0.4, this.y - 20);
      this.blowTimer = rand(400, 800);
    }
    if (this.x > WORLD.x1 + 300) this.reset(false);
    return true;
  }

  /** 当前位置是否在"水够深"的区域（渲染层用它决定要不要画） */
  _inWater() {
    if (!depthAtFn) return true;
    return depthAtFn(this.x, this.y) >= MIN_DEPTH * 0.6;
  }

  draw(ctx) {
    if (!this._inWater()) return;
    const s = this.size;
    const dn = this.depthNorm;
    const L = depthLight(dn);
    // 鲸鱼是"远景"，远景在水下要更融进背景：深度每增加一点，
    // 整体不透明度就降一点（配合 haze 层做出纵深）。
    // 但衰减不能太狠 —— 初版 1-0.28d 配深色底，深水处基本看不见。
    const fade = 1 - dn * 0.16;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.62 * fade;

    // —— 身体：一整条手工路径 ——
    // 【为什么不用胶囊拼】试过"锥形胶囊 + 月牙尾鳍"两件套，实测截图里：
    //   ① 椭圆亮环贴不住锥形背线（背线是斜线，椭圆弧是曲线，必然脱离）；
    //   ② 尾鳍和尾柄糊成一团，没有"收窄再展开"的鲸类标志轮廓。
    // 剪影类形体最可靠的做法就是一条路径勾完，光沿真实边缘走。
    // 轮廓（面朝右）：圆钝大头 → 平缓背线 → 收窄尾柄 → 月牙尾鳍 → 平腹。
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(s * 0.68, -s * 0.34);                       // 头顶
      ctx.bezierCurveTo(s * 0.98, -s * 0.3, s * 1.0, -s * 0.06, s * 0.96, s * 0.06);  // 圆头
      ctx.bezierCurveTo(s * 0.8, s * 0.3, s * 0.3, s * 0.34, -s * 0.1, s * 0.28);     // 下颌/腹
      ctx.quadraticCurveTo(-s * 0.55, s * 0.22, -s * 0.82, s * 0.1);                  // 腹→尾柄
      ctx.quadraticCurveTo(-s * 0.95, s * 0.06, -s * 1.02, s * 0.03);                 // 尾柄下缘
      ctx.quadraticCurveTo(-s * 1.22, s * 0.3, -s * 1.42, s * 0.26);                  // 下尾鳍尖
      ctx.quadraticCurveTo(-s * 1.16, s * 0.02, -s * 1.1, 0);                         // 尾鳍缺口
      ctx.quadraticCurveTo(-s * 1.16, -s * 0.02, -s * 1.4, -s * 0.24);                // 上尾鳍尖
      ctx.quadraticCurveTo(-s * 1.2, -s * 0.28, -s * 1.0, -s * 0.05);                 // 回到尾柄上缘
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.2, -s * 0.1, -s * 0.3);                   // 背线
      ctx.quadraticCurveTo(s * 0.3, -s * 0.38, s * 0.68, -s * 0.34);                  // 背线→头顶
      ctx.closePath();
    };

    // 主体填充：线性渐变沿 LIGHT 方向（左上亮 → 右下暗），和地形同一套光
    const gl = ctx.createLinearGradient(-s * 0.8, -s * 0.4, s * 0.9, s * 0.4);
    gl.addColorStop(0, rgba(shade(this.body, 0.38 * L.light), 1));
    gl.addColorStop(0.5, rgba(this.body, 1));
    gl.addColorStop(1, rgba(shade(this.body, -0.3), 1));
    bodyPath();
    ctx.fillStyle = gl;
    ctx.fill();

    // —— 背部受光边：沿真实背线描一道亮弧 ——
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(shade(this.body, 0.9), 0.3 * L.light * fade);
    ctx.lineWidth = Math.max(1.4, s * 0.022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.19);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.29, s * 0.42, -s * 0.33);
    ctx.stroke();

    // —— 腹部反光：沿真实腹线描一道（水下回光）——
    ctx.strokeStyle = rgba(this.belly, 0.34 * L.light * fade);
    ctx.lineWidth = Math.max(1.6, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, s * 0.235);
    ctx.bezierCurveTo(s * 0.2, s * 0.31, -s * 0.2, s * 0.27, -s * 0.55, s * 0.16);
    ctx.stroke();
    ctx.restore();

    // —— 背鳍 ——
    ctx.fillStyle = rgba(shade(this.body, -0.05), 0.9);
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.31);
    ctx.quadraticCurveTo(s * 0.04, -s * 0.58, s * 0.22, -s * 0.36);
    ctx.quadraticCurveTo(s * 0.08, -s * 0.3, -s * 0.05, -s * 0.31);
    ctx.closePath();
    ctx.fill();

    // —— 胸鳍 ——
    ctx.fillStyle = rgba(shade(this.body, -0.18), 0.78);
    ctx.beginPath();
    ctx.ellipse(s * 0.38, s * 0.27, s * 0.2, s * 0.08, 0.45, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
