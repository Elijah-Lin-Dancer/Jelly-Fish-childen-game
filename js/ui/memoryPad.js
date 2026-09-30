// ============================================================
//  隐藏入口 · 口令面板 + 纪念卡片
//  - 隐蔽手势：连点设置面板标题 5 次，才浮出输入框
//  - 口令正确 -> 解锁动画 + 逐句浮现的纪念卡片
//  - 错误只给中性提示，不暴露"是否存在内容"
// ============================================================

import { t } from './i18n.js';

export function createMemoryPad(memory, { onUnlock } = {}) {
  const el = {
    // 输入面板（复用 dex-modal 结构）
    pad: document.getElementById('memory-modal'),
    padClose: document.getElementById('memory-close'),
    padTitle: document.getElementById('memory-title'),
    input: document.getElementById('memory-input'),
    submit: document.getElementById('memory-submit'),
    err: document.getElementById('memory-err'),

    // 纪念卡片
    card: document.getElementById('memory-card-modal'),
    cardClose: document.getElementById('memory-card-close'),
    cardName: document.getElementById('memory-card-name'),
    cardSub: document.getElementById('memory-card-sub'),
    cardCanvas: document.getElementById('memory-card-canvas'),
    cardLines: document.getElementById('memory-card-lines'),

    // 隐蔽手势触发点
    gesture: document.getElementById('settings-title'),
  };

  let padOpen = false;
  let cardOpen = false;
  let tapCount = 0;
  let tapTimer = null;
  let lineTimer = null;

  /* ---------- 口令面板 ---------- */

  function showErr(key) {
    if (!el.err) return;
    el.err.textContent = t(key);
    el.err.classList.add('show');
  }

  function clearErr() {
    if (el.err) { el.err.textContent = ''; el.err.classList.remove('show'); }
  }

  function showPad() {
    if (!el.pad) return;
    clearErr();
    if (el.input) el.input.value = '';
    if (el.padTitle) el.padTitle.textContent = t('memory.pad.title');
    if (el.submit) el.submit.textContent = t('memory.pad.submit');
    el.pad.classList.remove('hide');
    padOpen = true;
    setTimeout(() => { if (el.input) el.input.focus(); }, 60);
  }

  function hidePad() {
    if (!el.pad) return;
    el.pad.classList.add('hide');
    padOpen = false;
    clearErr();
  }

  async function submit() {
    if (!el.input) return;
    const value = el.input.value;
    if (!value) { showErr('memory.pad.empty'); return; }
    if (el.submit) el.submit.classList.add('busy');
    const res = await memory.attempt(value);
    if (el.submit) el.submit.classList.remove('busy');
    if (res === 'ok') {
      hidePad();
      openCard();
      if (onUnlock) onUnlock();
    } else if (res === 'bad') {
      showErr('memory.pad.bad');
      if (el.input) el.input.value = '';
    }
  }

  /* ---------- 纪念卡片 ---------- */

  function renderCardCanvas() {
    const cv = el.cardCanvas;
    if (!cv) return;
    const c = memory.content;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = cv.clientWidth || 150;
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawCat(ctx, size / 2, size / 2, size * 0.28, c.palette);
  }

  /** 卡片插画：用纯 Canvas 画出带他特征的小猫水母 */
  function drawCat(ctx, cx, cy, R, p) {
    ctx.save();
    ctx.translate(cx, cy);

    // 光晕
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2.2);
    g.addColorStop(0, p.glow + 'aa');
    g.addColorStop(1, p.glow + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 环纹触须（浣熊尾）
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const bx = (i / 6 - 0.5) * R * 1.4;
      const len = R * (1.6 + (i % 3) * 0.25);
      ctx.beginPath();
      ctx.moveTo(bx, R * 0.3);
      for (let s = 1; s <= 10; s++) {
        const f = s / 10;
        ctx.lineTo(bx + Math.sin(i + s * 0.6) * 6 * f, R * 0.3 + len * f);
      }
      ctx.strokeStyle = p.tent + (i % 2 === 0 ? 'cc' : '88');
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120, 78, 40, 0.6)';
      ctx.lineWidth = 1.1;
      for (let k = 0; k < 4; k++) {
        const f = 0.55 + (k / 4) * 0.4;
        const y = R * 0.3 + len * f;
        const x = bx + Math.sin(i + f * 6) * 6 * f;
        ctx.beginPath();
        ctx.moveTo(x - 2.5, y);
        ctx.lineTo(x + 2.5, y);
        ctx.stroke();
      }
    }

    // 伞盖（上橘下白）
    const bodyG = ctx.createLinearGradient(0, -R * 1.1, 0, R * 0.2);
    bodyG.addColorStop(0, p.core);
    bodyG.addColorStop(0.62, p.core);
    bodyG.addColorStop(1, '#ffffff');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-R, 0);
    ctx.bezierCurveTo(-R, -R * 1.32, R, -R * 1.32, R, 0);
    // 下缘微波
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      ctx.lineTo(R - f * R * 2, R * 0.14 + Math.sin(f * Math.PI) * R * 0.05);
    }
    ctx.closePath();
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-R * 0.25, -R * 0.55, R * 0.32, R * 0.16, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 歪耳朵（左）——他的招牌：明显向内折，且比右耳矮一截
    ctx.save();
    ctx.translate(-R * 0.5, -R * 1.02);
    ctx.rotate(-1.02);
    ctx.fillStyle = p.core;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-R * 0.2, -R * 0.42);
    ctx.lineTo(R * 0.34, -R * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,190,0.7)';
    ctx.beginPath();
    ctx.moveTo(R * 0.02, -R * 0.08);
    ctx.lineTo(-R * 0.08, -R * 0.32);
    ctx.lineTo(R * 0.26, -R * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 右耳（正常直立，做对比）
    ctx.save();
    ctx.translate(R * 0.52, -R * 0.96);
    ctx.rotate(0.26);
    ctx.fillStyle = p.core;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-R * 0.16, -R * 0.56);
    ctx.lineTo(R * 0.24, -R * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,190,0.6)';
    ctx.beginPath();
    ctx.moveTo(R * 0.0, -R * 0.1);
    ctx.lineTo(-R * 0.06, -R * 0.42);
    ctx.lineTo(R * 0.18, -R * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 眼睛（绿黄）
    ctx.fillStyle = '#1c1c22';
    ctx.beginPath();
    ctx.ellipse(-R * 0.28, -R * 0.18, R * 0.07, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.28, -R * 0.18, R * 0.07, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9d24a';
    ctx.beginPath();
    ctx.arc(-R * 0.28, -R * 0.2, R * 0.032, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(R * 0.28, -R * 0.2, R * 0.032, 0, Math.PI * 2);
    ctx.fill();

    // 粉鼻子
    ctx.fillStyle = '#ff9ab0';
    ctx.beginPath();
    ctx.moveTo(-R * 0.06, R * 0.02);
    ctx.lineTo(R * 0.06, R * 0.02);
    ctx.lineTo(0, R * 0.1);
    ctx.closePath();
    ctx.fill();

    // 吐舌头
    ctx.fillStyle = 'rgba(255,140,168,0.95)';
    ctx.beginPath();
    ctx.moveTo(-R * 0.08, R * 0.14);
    ctx.quadraticCurveTo(0, R * 0.4, R * 0.08, R * 0.14);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function openCard() {
    if (!el.card) return;
    const c = memory.content;
    if (el.cardName) el.cardName.textContent = c.cardTitle || c.name;
    if (el.cardSub) el.cardSub.textContent = c.cardSubtitle || '';
    if (el.cardLines) {
      el.cardLines.innerHTML = '';
      let i = 0;
      const reveal = () => {
        if (i >= c.lines.length) return;
        const p = document.createElement('p');
        p.className = 'memory-line';
        p.textContent = c.lines[i];
        el.cardLines.appendChild(p);
        requestAnimationFrame(() => p.classList.add('show'));
        i++;
        lineTimer = setTimeout(reveal, 1150);
      };
      reveal();
    }
    el.card.classList.remove('hide');
    cardOpen = true;
    requestAnimationFrame(renderCardCanvas);
  }

  function hideCard() {
    if (!el.card) return;
    el.card.classList.add('hide');
    cardOpen = false;
    if (lineTimer) { clearTimeout(lineTimer); lineTimer = null; }
  }

  /* ---------- 隐蔽手势 ---------- */

  function bindGesture() {
    if (!el.gesture) return;
    const tap = () => {
      tapCount++;
      if (tapTimer) clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 1200);
      if (tapCount >= 5) {
        tapCount = 0;
        showPad();
      }
    };
    el.gesture.addEventListener('click', tap);
    el.gesture.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); }
    });
  }

  function bind() {
    bindGesture();
    if (el.padClose) el.padClose.addEventListener('click', hidePad);
    if (el.pad) el.pad.addEventListener('click', (e) => { if (e.target === el.pad) hidePad(); });
    if (el.submit) {
      el.submit.addEventListener('click', submit);
      el.submit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); submit(); }
      });
    }
    if (el.input) {
      el.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      el.input.addEventListener('input', clearErr);
    }
    if (el.cardClose) el.cardClose.addEventListener('click', hideCard);
    if (el.card) el.card.addEventListener('click', (e) => { if (e.target === el.card) hideCard(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (padOpen) hidePad();
        if (cardOpen) hideCard();
      }
    });
  }

  return {
    bind,
    showPad,
    openCard,
    get isUnlocked() { return memory.unlocked; },
  };
}
