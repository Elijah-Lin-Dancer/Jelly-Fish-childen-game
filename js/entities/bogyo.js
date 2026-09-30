// ============================================================
//  Bogyó — 住在海里的一只小猫
//  （隐藏纪念内容，口令解锁后常驻）
//
//  他不是水母。他是他自己：
//    形态 · 猫脸轮廓 + 两只猫耳（左耳歪）+ 四条小短腿 + 胡须
//           + 吐着的小舌头 + 浣熊环纹长尾
//    行为 · 四肢划水（非脉冲漂浮）/ 跟着指针跑 / 会歪头 /
//           没人理就打盹 / 点他附近会扑一下
//    光   · 专属暖橘白配色 + 星屑 + 夜间更暖
//
//  他不参与经济 / 繁育 / 图鉴，只是安静地陪着。
// ============================================================

import { TAU, rand, clamp, damp } from '../core/config.js';
import { view, pointer, dayNight } from '../core/state.js';

const PERIOD = 16.667;

/** 状态机 */
const S_IDLE = 'idle';     // 悠然划水
const S_FOLLOW = 'follow'; // 追指针
const S_NAP = 'nap';       // 打盹
const S_POUNCE = 'pounce'; // 扑

export class Bogyo {
  constructor(x, y, opts = {}) {
    this.isMemory = true;
    this.name = opts.name || 'Bogyó';
    this.palette = opts.palette || { core: '#f7b06a', glow: '#ff8f3c', tent: '#fff0e0' };

    this.x = x ?? view.W * 0.5;
    this.y = y ?? view.H * 0.45;
    // 体型：比水母小一号（他还是只 4 岁的小猫）
    this.baseR = clamp(Math.min(view.W, view.H) * 0.052, 26, 46);
    this.r = this.baseR;
    this.scale = 0.5;      // 出场成长动画
    this.age = 0;

    this.vx = 0;
    this.vy = 0;
    this.face = 1;         // 朝向：1 右 / -1 左
    this.sway = rand(0, TAU);

    // 行为状态
    this.state = S_IDLE;
    this.stateT = 0;
    this.headTilt = 0;     // 歪头角度（目标值）
    this.headTiltCur = 0;
    this.pawPhase = rand(0, TAU);   // 划水相位
    this.tonguePhase = rand(0, TAU);
    this.blinkT = rand(2000, 5000);
    this.blink = 0;
    this.pounceT = 0;
    this.idleSince = 0;
    this.nuzzle = 0;       // 长按撒娇：蹭一蹭
    this.purr = 0;

    // 星屑
    this.sparks = [];
    this.sparkT = 0;

    // 点击名字浮现
    this.nameShow = 0;
    this.flash = 0;
  }

  /* ================= 行为 ================= */

  update(dt, t) {
    const k = dt / PERIOD;
    this.age += dt;
    this.stateT += dt;
    this.sway += 0.008 * k;
    this.pawPhase += 0.05 * k;
    this.tonguePhase += 0.0025 * k;

    // 出场成长
    if (this.scale < 1) {
      this.scale = damp(this.scale, 1, 0.3, dt);
      if (this.scale > 0.995) this.scale = 1;
    }

    // 眨眼
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = rand(2200, 6000); }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt / 160);

    // 名字浮现淡出
    if (this.nameShow > 0) this.nameShow = Math.max(0, this.nameShow - dt / 2600);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 600);

    // 撒娇（长按触发后衰减）
    if (this.nuzzle > 0) this.nuzzle = Math.max(0, this.nuzzle - dt / 1400);
    if (this.purr > 0) this.purr = Math.max(0, this.purr - dt / 1800);

    this._decide(dt, t);
    this._move(dt, k);
    this._spawnSparks(dt);

    // 星屑更新
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.x += s.vx * k;
      s.y += s.vy * k;
      s.vy -= 0.004 * k;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    // 边界
    const rr = this.r * this.scale * 2;
    if (this.y < -rr) this.y = view.H + rr;
    if (this.y > view.H + rr) this.y = -rr;
    if (this.x < -rr * 2) this.x = view.W + rr * 2;
    if (this.x > view.W + rr * 2) this.x = -rr * 2;

    return true;
  }

  /** 状态决策：指针靠近追，久无人理打盹，点他附近扑 */
  _decide(dt, t) {
    const dx = pointer.x - this.x;
    const dy = pointer.y - this.y;
    const d = Math.hypot(dx, dy);

    if (this.state === S_POUNCE) {
      this.pounceT -= dt;
      if (this.pounceT <= 0) this._setState(S_IDLE);
      return;
    }

    // 指针在水里且不太远 -> 跟随（像猫追着人）
    if (pointer.active && d < 460 && d > 40) {
      this.idleSince = 0;
      if (this.state !== S_FOLLOW && this.state !== S_NAP) this._setState(S_FOLLOW);
      else if (this.state === S_NAP) this._setState(S_FOLLOW);   // 被叫醒
    } else if (pointer.active && d <= 40) {
      // 贴到指针了：停下看你，偶尔歪头
      this.idleSince = 0;
      if (this.state === S_FOLLOW) {
        this._setState(S_IDLE);
        this.headTilt = rand(-0.45, 0.45);   // 歪头看你
      }
    } else {
      this.idleSince += dt;
      if (this.state === S_FOLLOW) this._setState(S_IDLE);
    }

    // 长时间没人理 -> 打盹
    if (this.idleSince > 9000 && this.state !== S_NAP) {
      this._setState(S_NAP);
    }
    // 打盹时被指针靠近会醒
    if (this.state === S_NAP && pointer.active && d < 300) {
      this._setState(S_FOLLOW);
    }

    // 歪头：非跟随状态下偶尔歪一下（猫的招牌）
    if (this.state !== S_FOLLOW && this.state !== S_NAP) {
      if (Math.random() < 0.0025 * (dt / PERIOD) * 60) {
        this.headTilt = rand(-0.5, 0.5);
      }
    }
    if (this.state === S_NAP) this.headTilt = -0.2;
  }

  _setState(s) {
    this.state = s;
    this.stateT = 0;
    if (s === S_FOLLOW) this.headTilt = 0;
    if (s === S_POUNCE) { this.pounceT = 420; this.headTilt = 0.15; }
  }

  /** 位移：四肢划水的推进感，而非水母脉冲 */
  _move(dt, k) {
    const dtS = dt / PERIOD;
    let ax = 0, ay = 0;

    if (this.state === S_FOLLOW) {
      const dx = pointer.x - this.x, dy = pointer.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = clamp(d / 200, 0.35, 1.15);
      ax += (dx / d) * 0.16 * f;
      ay += (dy / d) * 0.16 * f;
    } else if (this.state === S_POUNCE) {
      const p = 1 - this.pounceT / 420;
      const burst = Math.sin(p * Math.PI) * 0.55;
      ax += this.face * burst;
      ay -= burst * 0.5;
    } else if (this.state === S_NAP) {
      // 打盹：缓慢下沉，微微起伏
      ay += Math.sin(this.age * 0.0012) * 0.012;
      ax += Math.sin(this.sway * 0.6) * 0.01;
    } else {
      // 悠然：轻微漂移 + 划水划出的小推力
      ax += Math.sin(this.sway) * 0.02;
      ay += Math.sin(this.sway * 0.7 + 1.3) * 0.014;
      const midY = view.H * 0.5;
      ay += Math.sign(midY - this.y) * 0.006;
    }

    this.vx += ax * dtS;
    this.vy += ay * dtS;

    // 阻尼（打盹时更黏，像懒懒地悬着）
    const drag = this.state === S_NAP ? 0.9 : 0.955;
    this.vx *= Math.pow(drag, dtS);
    this.vy *= Math.pow(drag, dtS);

    // 速度上限：猫比水母利落
    const maxSp = this.state === S_FOLLOW ? 4.2 : (this.state === S_POUNCE ? 6 : 2.2);
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > maxSp) { this.vx = (this.vx / sp) * maxSp; this.vy = (this.vy / sp) * maxSp; }

    this.x += this.vx * dtS;
    this.y += this.vy * dtS;

    // 朝向：跟随指针方向
    if (this.state === S_FOLLOW) {
      const dx = pointer.x - this.x;
      if (Math.abs(dx) > 12) this.face = dx >= 0 ? 1 : -1;
    } else if (Math.abs(this.vx) > 0.15) {
      this.face = this.vx >= 0 ? 1 : -1;
    }

    // 歪头缓动
    this.headTiltCur = damp(this.headTiltCur, this.headTilt, 0.006, dt);
  }

  /** 星屑：解锁后的他自带的小小光点 */
  _spawnSparks(dt) {
    this.sparkT -= dt;
    if (this.sparkT <= 0 && this.sparks.length < 14) {
      this.sparkT = rand(260, 700);
      const a = rand(0, TAU);
      const rr = this.r * this.scale * rand(0.5, 1.2);
      this.sparks.push({
        x: this.x + Math.cos(a) * rr,
        y: this.y + Math.sin(a) * rr,
        vx: rand(-0.25, 0.25),
        vy: rand(0.1, 0.5),
        life: rand(900, 1900),
        max: 1900,
      });
    }
  }

  /* ================= 交互（由 main 调用） ================= */

  /** 被点一下：回应 + 浮现名字 + 扑一下 */
  tap() {
    this.flash = 1;
    this.nameShow = 1;
    this._setState(S_POUNCE);
    return true;
  }

  /** 长按：撒娇，蹭一蹭 */
  nuzzleMe() {
    this.nuzzle = 1;
    this.purr = 1;
    this.flash = 1;
    return true;
  }

  /* ================= 绘制 ================= */

  draw(ctx) {
    const night = 1 - dayNight.sun;    // 0 白天 .. 1 夜
    const r = this.r * this.scale;
    const p = this.palette;

    this._drawAura(ctx, r, night);
    this._drawSparks(ctx);

    ctx.save();
    ctx.translate(this.x, this.y);

    // 打盹：整体缩起 + 眯眼，轻微上下呼吸
    const napping = this.state === S_NAP;
    const breathe = 1 + Math.sin(this.age * 0.0016) * 0.03;
    ctx.scale(this.face, 1);
    ctx.rotate(clamp(this.vx * 0.02, -0.12, 0.12) + (napping ? -0.06 : 0));

    // 尾巴（浣熊环纹），画在身体后面
    this._drawTail(ctx, r, napping);

    // 四条小短腿（划水）
    this._drawLegs(ctx, r, napping);

    // 身体 + 猫脸
    this._drawBody(ctx, r, p, night, napping);

    // 头（含耳朵 / 胡须 / 舌头 / 眼）
    this._drawHead(ctx, r, p, night, napping);

    ctx.restore();
  }

  /** 常驻柔光（暖色，夜间更暖更亮） */
  _drawAura(ctx, r, night) {
    const breathe = (Math.sin(this.age * 0.0012) + 1) * 0.5;
    const warm = 1 + night * 0.7;
    const R = r * (2.1 + breathe * 0.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, r * 0.5, this.x, this.y, R);
    g.addColorStop(0, 'rgba(255, 214, 150, 0)');
    g.addColorStop(0.68, `rgba(255, 200, 130, ${(0.1 + breathe * 0.07) * warm})`);
    g.addColorStop(1, 'rgba(255, 180, 110, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = (0.2 + breathe * 0.12) * warm;
    ctx.strokeStyle = 'rgba(255, 226, 180, 0.9)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([5, 8]);
    ctx.lineDashOffset = -this.age * 0.011;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R * 0.9, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawSparks(ctx) {
    if (!this.sparks.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      const a = clamp(s.life / s.max, 0, 1);
      ctx.fillStyle = `rgba(255, 226, 170, ${a * 0.8})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.6 * a + 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 浣熊环纹长尾 */
  _drawTail(ctx, r, napping) {
    const wag = Math.sin(this.age * (napping ? 0.0008 : 0.0022)) * (napping ? 0.1 : 0.32);
    const curl = napping ? 0.9 : 0.4;      // 打盹时尾巴圈起来
    const len = r * (napping ? 1.1 : 1.7);
    const baseX = -r * 0.85;
    const baseY = r * 0.15;
    const pts = [];
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const ang = -1.15 + curl * f + wag * f;
      pts.push([
        baseX - Math.cos(ang) * len * f * 1.05,
        baseY + Math.sin(ang) * len * f - r * 0.1 * f,
      ]);
    }
    // 尾身
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = this.palette.core;
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts) ctx.lineTo(q[0], q[1]);
    ctx.stroke();
    // 尾尖白
    ctx.strokeStyle = '#fff7ee';
    ctx.lineWidth = r * 0.28;
    ctx.beginPath();
    ctx.moveTo(pts[9][0], pts[9][1]);
    for (let i = 10; i <= segs; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    // 环纹（浣熊）
    ctx.strokeStyle = 'rgba(150, 96, 46, 0.72)';
    ctx.lineWidth = r * 0.3;
    for (const qi of [3, 5, 7]) {
      const q = pts[qi];
      ctx.beginPath();
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(q[0] + 0.5, q[1] + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 四条小短腿：划水动作（前后错开，避免糊成一团白） */
  _drawLegs(ctx, r, napping) {
    const p = this.palette;
    const legBase = napping ? 0.55 : 1;
    // 四条腿分两排：后腿（远）暗一点、位置高一点；前腿（近）亮
    const legs = [
      { x: -r * 0.66, y: r * 0.38, back: true },   // 后左
      { x: r * 0.6, y: r * 0.36, back: true },     // 后右
      { x: -r * 0.42, y: r * 0.56, back: false },  // 前左
      { x: r * 0.42, y: r * 0.56, back: false },   // 前右
    ];
    for (let i = 0; i < 4; i++) {
      const L = legs[i];
      const ph = this.pawPhase + i * 1.9;
      const kick = napping ? 0 : Math.sin(ph) * 0.5;
      const len = r * (L.back ? 0.42 : 0.5) * legBase;
      const tipX = L.x + kick * r * 0.24;
      const tipY = L.y + len;

      ctx.save();
      ctx.lineCap = 'round';
      // 白袜：腿下半截白色
      ctx.strokeStyle = L.back ? '#eee4d8' : p.core;
      ctx.lineWidth = r * (L.back ? 0.2 : 0.23);
      ctx.beginPath();
      ctx.moveTo(L.x, L.y);
      ctx.quadraticCurveTo(L.x, L.y + len * 0.6, tipX, tipY);
      ctx.stroke();
      // 爪垫
      ctx.fillStyle = L.back ? '#e8ddd0' : '#fff7ee';
      ctx.beginPath();
      ctx.arc(tipX, tipY, r * (L.back ? 0.1 : 0.12), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 猫身 + 猫脸 */
  _drawBody(ctx, r, p, night, napping) {
    // 身体：圆润的猫身（比水母伞盖更"实"），上橘下白
    const bodyG = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.7);
    bodyG.addColorStop(0, p.core);
    bodyG.addColorStop(0.55, p.core);
    bodyG.addColorStop(0.75, '#fff7ee');
    bodyG.addColorStop(1, '#ffffff');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.98, r * 0.82, 0, 0, TAU);
    ctx.fill();

    // 胸口白毛
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(r * 0.08, r * 0.35, r * 0.42, r * 0.3, 0.15, 0, TAU);
    ctx.fill();

    // 暖光提亮（lighter 叠一层本色，抵消暗背景）
    ctx.globalCompositeOperation = 'lighter';
    const hueG = ctx.createRadialGradient(0, -r * 0.2, 0, 0, 0, r * 1.1);
    hueG.addColorStop(0, p.core + '33');
    hueG.addColorStop(1, p.glow + '00');
    ctx.fillStyle = hueG;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.98, r * 0.82, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  /** 头：耳朵 / 眼 / 鼻 / 胡须 / 舌头 */
  _drawHead(ctx, r, p, night, napping) {
    const hy = -r * 0.62;
    const tilt = this.headTiltCur;

    ctx.save();
    ctx.translate(0, hy);
    ctx.rotate(tilt);

    const hr = r * 0.78;   // 头半径

    // --- 耳朵（画在头后）---
    // 左耳：歪的（折角明显、比右耳矮）
    this._drawEar(ctx, -hr * 0.62, -hr * 0.72, hr, -0.95, true, p);
    // 右耳：正常直立
    this._drawEar(ctx, hr * 0.62, -hr * 0.8, hr, 0.28, false, p);

    // --- 头 ---
    const headG = ctx.createLinearGradient(0, -hr, 0, hr);
    headG.addColorStop(0, p.core);
    headG.addColorStop(0.6, p.core);
    headG.addColorStop(0.82, '#fff7ee');
    headG.addColorStop(1, '#ffffff');
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.ellipse(0, 0, hr, hr * 0.92, 0, 0, TAU);
    ctx.fill();

    // 面部白斑（他脸上那块白）
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(hr * 0.08, hr * 0.28, hr * 0.62, hr * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -hr * 0.62, hr * 0.34, hr * 0.5, 0, 0, TAU);
    ctx.fill();

    // --- 胡须 ---
    this._drawWhiskers(ctx, hr, napping);

    // --- 眼睛 ---
    const eyeX = hr * 0.36;
    const eyeY = -hr * 0.02;
    if (napping) {
      // 眯眼：一条弧线
      ctx.strokeStyle = '#2a2320';
      ctx.lineWidth = hr * 0.09;
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * eyeX, eyeY, hr * 0.22, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    } else {
      const closed = this.blink > 0.5;
      for (const sx of [-1, 1]) {
        if (closed) {
          ctx.strokeStyle = '#2a2320';
          ctx.lineWidth = hr * 0.08;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx * eyeX - hr * 0.16, eyeY);
          ctx.lineTo(sx * eyeX + hr * 0.16, eyeY);
          ctx.stroke();
        } else {
          // 眼白
          ctx.fillStyle = '#fbf7f0';
          ctx.beginPath();
          ctx.ellipse(sx * eyeX, eyeY, hr * 0.18, hr * 0.2, 0, 0, TAU);
          ctx.fill();
          // 虹膜：绿黄（像他）
          const eyeG = ctx.createRadialGradient(sx * eyeX, eyeY, 0, sx * eyeX, eyeY, hr * 0.17);
          eyeG.addColorStop(0, '#d8e86a');
          eyeG.addColorStop(0.7, '#a9c23f');
          eyeG.addColorStop(1, '#7c9a2c');
          ctx.fillStyle = eyeG;
          ctx.beginPath();
          ctx.arc(sx * eyeX, eyeY + hr * 0.005, hr * 0.155, 0, TAU);
          ctx.fill();
          // 瞳孔
          ctx.fillStyle = '#1c1714';
          ctx.beginPath();
          ctx.ellipse(sx * eyeX, eyeY + hr * 0.005, hr * 0.055, hr * 0.12, 0, 0, TAU);
          ctx.fill();
          // 高光
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(sx * eyeX - hr * 0.05, eyeY - hr * 0.06, hr * 0.04, 0, TAU);
          ctx.fill();
        }
      }
    }

    // --- 鼻子 + 嘴 ---
    ctx.fillStyle = '#ff9ab0';
    ctx.beginPath();
    ctx.moveTo(-hr * 0.09, hr * 0.3);
    ctx.lineTo(hr * 0.09, hr * 0.3);
    ctx.lineTo(0, hr * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,45,40,0.55)';
    ctx.lineWidth = hr * 0.03;
    ctx.beginPath();
    ctx.moveTo(0, hr * 0.42);
    ctx.lineTo(0, hr * 0.5);
    ctx.moveTo(0, hr * 0.5);
    ctx.arc(-hr * 0.1, hr * 0.5, hr * 0.1, 0, Math.PI * 0.5);
    ctx.moveTo(0, hr * 0.5);
    ctx.arc(hr * 0.1, hr * 0.5, hr * 0.1, Math.PI * 0.5, Math.PI);
    ctx.stroke();

    // --- 吐舌头（他的招牌之一，一直在） ---
    const tl = (Math.sin(this.tonguePhase) + 1) * 0.5;
    const tongueLen = hr * (0.28 + tl * 0.12);
    ctx.fillStyle = 'rgba(255, 140, 168, 0.95)';
    ctx.beginPath();
    ctx.moveTo(-hr * 0.1, hr * 0.62);
    ctx.quadraticCurveTo(0, hr * 0.62 + tongueLen, hr * 0.1, hr * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 100, 132, 0.7)';
    ctx.lineWidth = hr * 0.025;
    ctx.beginPath();
    ctx.moveTo(0, hr * 0.7);
    ctx.lineTo(0, hr * 0.62 + tongueLen * 0.78);
    ctx.stroke();

    // 撒娇时的腮红
    if (this.nuzzle > 0) {
      ctx.fillStyle = `rgba(255, 150, 170, ${this.nuzzle * 0.5})`;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * hr * 0.62, hr * 0.32, hr * 0.16, hr * 0.1, 0, 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawEar(ctx, x, y, hr, rot, crooked, p) {
    ctx.save();
    ctx.translate(x, y);
    // 歪耳朵额外摆动，显得"歪得更明显"
    const flick = crooked ? Math.sin(this.age * 0.002) * 0.16 : 0;
    ctx.rotate(rot + flick);
    const s = crooked ? 0.78 : 1;    // 歪耳小一点
    ctx.fillStyle = p.core;
    ctx.beginPath();
    if (crooked) {
      // 折耳：耳尖朝内折断，画成两段——这是他的招牌
      ctx.moveTo(0, 0);
      ctx.lineTo(-hr * 0.22 * s, -hr * 0.6 * s);
      ctx.lineTo(hr * 0.06 * s, -hr * 0.72 * s);   // 竖起的下半
      ctx.lineTo(hr * 0.02 * s, -hr * 0.46 * s);   // 折点
      ctx.lineTo(hr * 0.38 * s, -hr * 0.5 * s);    // 折下来的耳尖（朝外趴）
      ctx.closePath();
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(-hr * 0.2 * s, -hr * 0.72 * s);
      ctx.lineTo(hr * 0.34 * s, -hr * 0.78 * s);
      ctx.closePath();
    }
    ctx.fill();
    // 耳内粉
    ctx.fillStyle = 'rgba(255, 168, 188, 0.75)';
    ctx.beginPath();
    if (crooked) {
      ctx.moveTo(hr * 0.02, -hr * 0.12 * s);
      ctx.lineTo(-hr * 0.06 * s, -hr * 0.42 * s);
      ctx.lineTo(hr * 0.05 * s, -hr * 0.44 * s);
      ctx.lineTo(hr * 0.22 * s, -hr * 0.36 * s);
      ctx.closePath();
    } else {
      ctx.moveTo(hr * 0.02, -hr * 0.12 * s);
      ctx.lineTo(-hr * 0.08 * s, -hr * 0.5 * s);
      ctx.lineTo(hr * 0.2 * s, -hr * 0.56 * s);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  _drawWhiskers(ctx, hr, napping) {
    const sway = Math.sin(this.sway * 2 + 1) * hr * 0.02;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = hr * 0.028;
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y = hr * (0.28 + i * 0.12);
        const len = hr * (0.62 - i * 0.06);
        const droop = napping ? 0.35 : (i - 1) * 0.12;
        ctx.beginPath();
        ctx.moveTo(sx * hr * 0.5, y);
        ctx.quadraticCurveTo(
          sx * (hr * 0.5 + len * 0.6),
          y + droop * hr * 0.3 + sway,
          sx * (hr * 0.5 + len),
          y + droop * hr * 0.6 + sway * 1.6
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ================= 图鉴卡片插画 ================= */
  drawThumbAt(ctx, cx, cy, R) {
    ctx.save();
    ctx.translate(cx, cy);
    const p = this.palette;

    // 光晕
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2.2);
    g.addColorStop(0, p.glow + 'aa');
    g.addColorStop(1, p.glow + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.2, 0, TAU);
    ctx.fill();

    // 尾巴（环纹）
    ctx.save();
    ctx.lineCap = 'round';
    const tp = [];
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      const ang = -1.15 + 0.55 * f;
      tp.push([-R * 0.85 - Math.cos(ang) * R * 1.5 * f, R * 0.35 + Math.sin(ang) * R * 1.4 * f]);
    }
    ctx.strokeStyle = p.core;
    ctx.lineWidth = R * 0.3;
    ctx.beginPath();
    ctx.moveTo(tp[0][0], tp[0][1]);
    for (const q of tp) ctx.lineTo(q[0], q[1]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 96, 46, 0.72)';
    ctx.lineWidth = R * 0.3;
    for (const qi of [3, 5, 7]) {
      ctx.beginPath();
      ctx.moveTo(tp[qi][0], tp[qi][1]);
      ctx.lineTo(tp[qi][0] + 0.5, tp[qi][1] + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // 四条小短腿
    for (let i = 0; i < 4; i++) {
      const lx = [-R * 0.62, -R * 0.3, R * 0.3, R * 0.62][i];
      const len = R * 0.5;
      ctx.strokeStyle = i === 0 || i === 3 ? '#fff7ee' : p.core;
      ctx.lineWidth = R * 0.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx, R * 0.55);
      ctx.lineTo(lx, R * 0.55 + len);
      ctx.stroke();
      ctx.fillStyle = '#fff7ee';
      ctx.beginPath();
      ctx.arc(lx, R * 0.55 + len, R * 0.11, 0, TAU);
      ctx.fill();
    }

    // 身体
    const bodyG = ctx.createLinearGradient(0, -R * 0.7, 0, R * 0.7);
    bodyG.addColorStop(0, p.core);
    bodyG.addColorStop(0.6, p.core);
    bodyG.addColorStop(0.8, '#fff7ee');
    bodyG.addColorStop(1, '#fff');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(0, R * 0.15, R * 0.92, R * 0.78, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(R * 0.08, R * 0.45, R * 0.4, R * 0.28, 0.15, 0, TAU);
    ctx.fill();

    // 头
    const hy = -R * 0.62;
    const hr = R * 0.76;
    // 耳朵
    this._thumbEar(ctx, -hr * 0.62 + 0, hy - hr * 0.72, hr, -0.95, true, p);
    this._thumbEar(ctx, hr * 0.62, hy - hr * 0.8, hr, 0.28, false, p);
    const headG = ctx.createLinearGradient(0, hy - hr, 0, hy + hr);
    headG.addColorStop(0, p.core);
    headG.addColorStop(0.62, p.core);
    headG.addColorStop(0.84, '#fff7ee');
    headG.addColorStop(1, '#fff');
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.ellipse(0, hy, hr, hr * 0.92, 0, 0, TAU);
    ctx.fill();
    // 白斑
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(hr * 0.08, hy + hr * 0.28, hr * 0.62, hr * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, hy - hr * 0.62, hr * 0.34, hr * 0.5, 0, 0, TAU);
    ctx.fill();
    // 眼睛
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#fbf7f0';
      ctx.beginPath();
      ctx.ellipse(sx * hr * 0.36, hy - hr * 0.02, hr * 0.18, hr * 0.2, 0, 0, TAU);
      ctx.fill();
      const eg = ctx.createRadialGradient(sx * hr * 0.36, hy, 0, sx * hr * 0.36, hy, hr * 0.17);
      eg.addColorStop(0, '#d8e86a');
      eg.addColorStop(0.7, '#a9c23f');
      eg.addColorStop(1, '#7c9a2c');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(sx * hr * 0.36, hy, hr * 0.155, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1c1714';
      ctx.beginPath();
      ctx.ellipse(sx * hr * 0.36, hy, hr * 0.055, hr * 0.12, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(sx * hr * 0.36 - hr * 0.05, hy - hr * 0.06, hr * 0.04, 0, TAU);
      ctx.fill();
    }
    // 鼻子
    ctx.fillStyle = '#ff9ab0';
    ctx.beginPath();
    ctx.moveTo(-hr * 0.09, hy + hr * 0.3);
    ctx.lineTo(hr * 0.09, hy + hr * 0.3);
    ctx.lineTo(0, hy + hr * 0.42);
    ctx.closePath();
    ctx.fill();
    // 舌头
    ctx.fillStyle = 'rgba(255,140,168,0.95)';
    ctx.beginPath();
    ctx.moveTo(-hr * 0.1, hy + hr * 0.6);
    ctx.quadraticCurveTo(0, hy + hr * 0.92, hr * 0.1, hy + hr * 0.6);
    ctx.closePath();
    ctx.fill();
    // 胡须
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = hr * 0.028;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y = hy + hr * (0.28 + i * 0.12);
        const len = hr * (0.6 - i * 0.05);
        ctx.beginPath();
        ctx.moveTo(sx * hr * 0.5, y);
        ctx.quadraticCurveTo(sx * (hr * 0.5 + len * 0.6), y + (i - 1) * hr * 0.08, sx * (hr * 0.5 + len), y + (i - 1) * hr * 0.14);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  _thumbEar(ctx, x, y, hr, rot, crooked, p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const s = crooked ? 0.78 : 1;
    ctx.fillStyle = p.core;
    ctx.beginPath();
    if (crooked) {
      ctx.moveTo(0, 0);
      ctx.lineTo(-hr * 0.22 * s, -hr * 0.6 * s);
      ctx.lineTo(hr * 0.06 * s, -hr * 0.72 * s);
      ctx.lineTo(hr * 0.02 * s, -hr * 0.46 * s);
      ctx.lineTo(hr * 0.38 * s, -hr * 0.5 * s);
      ctx.closePath();
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(-hr * 0.2 * s, -hr * 0.72 * s);
      ctx.lineTo(hr * 0.34 * s, -hr * 0.78 * s);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,168,188,0.75)';
    ctx.beginPath();
    if (crooked) {
      ctx.moveTo(hr * 0.02, -hr * 0.12 * s);
      ctx.lineTo(-hr * 0.06 * s, -hr * 0.42 * s);
      ctx.lineTo(hr * 0.05 * s, -hr * 0.44 * s);
      ctx.lineTo(hr * 0.22 * s, -hr * 0.36 * s);
      ctx.closePath();
    } else {
      ctx.moveTo(hr * 0.02, -hr * 0.12 * s);
      ctx.lineTo(-hr * 0.08 * s, -hr * 0.5 * s);
      ctx.lineTo(hr * 0.2 * s, -hr * 0.56 * s);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
}
