// ============================================================
//  图鉴面板：点击 HUD 的 #dex 弹出六物种详情
//  - 已发现：名字 + 首次发现日期 + 已遇次数 + 变异数 + 配色缩略图
//  - 未发现：剪影 + ？
// ============================================================

import { t } from './i18n.js';
import { collection } from '../core/state.js';
import { JELLY_PALETTES, Jellyfish } from '../entities/jellyfish.js';
import { JELLY_KEYS } from './locales.js';

export function createDex({ onClose } = {}) {
  const el = {
    overlay: document.getElementById('dex-modal'),
    grid: document.getElementById('dex-grid'),
    progress: document.getElementById('dex-progress'),
    close: document.getElementById('dex-close'),
    title: document.getElementById('dex-title'),
  };

  let open = false;

  /** 日期格式化（yyyy-mm-dd，跟随语言粗略处理） */
  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** 在卡片 canvas 上画一只水母（复用 Jellyfish.draw） */
  function drawThumb(canvas, paletteIndex, found, mutated) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth || 84;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);

    const p = JELLY_PALETTES[paletteIndex];
    const r = size * 0.26;

    // 外发光
    const glow = found ? p.glow : 'rgba(150,180,210,0.5)';
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2);
    g.addColorStop(0, (found ? glow : '#5a708a') + (found ? 'aa' : '55'));
    g.addColorStop(1, (found ? glow : '#5a708a') + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
    ctx.fill();

    // 触须
    ctx.lineCap = 'round';
    const nT = mutated ? 9 : 7;
    for (let i = 0; i < nT; i++) {
      const baseX = (i / (nT - 1) - 0.5) * r * 1.4;
      ctx.beginPath();
      ctx.moveTo(baseX, r * 0.3);
      const len = r * (1.6 + (i % 3) * 0.3);
      for (let s = 1; s <= 10; s++) {
        const f = s / 10;
        const wave = Math.sin(i + s * 0.6) * 6 * f;
        ctx.lineTo(baseX + wave, r * 0.3 + len * f);
      }
      ctx.strokeStyle = found ? (p.tent + (i % 2 === 0 ? 'cc' : '88')) : 'rgba(120,150,180,0.5)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // 伞盖
    const bodyG = ctx.createRadialGradient(0, -r * 0.2, 0, 0, 0, r);
    if (found) {
      bodyG.addColorStop(0, p.core + 'ee');
      bodyG.addColorStop(0.55, p.core + '99');
      bodyG.addColorStop(1, p.glow + '44');
    } else {
      bodyG.addColorStop(0, 'rgba(90,112,138,0.85)');
      bodyG.addColorStop(1, 'rgba(60,80,105,0.5)');
    }
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r, -r * 1.3, r, -r * 1.3, r, 0);
    for (let i = 0; i <= 5; i++) {
      const f = i / 5;
      ctx.lineTo(r - f * r * 2, r * 0.15);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.5, r * 0.35, r * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 渲染整个网格 */
  function render() {
    if (!el.grid) return;

    // 进度条
    if (el.progress) {
      el.progress.textContent = t('dex.progress', {
        n: collection.found.size,
        total: collection.total,
      });
      el.progress.classList.toggle(
        'complete',
        collection.found.size >= collection.total
      );
    }
    if (el.title) el.title.textContent = t('dex.title');

    el.grid.innerHTML = '';

    const recs = collection.records || {};
    for (let i = 0; i < collection.total; i++) {
      const key = JELLY_KEYS[i];
      const rec = recs[i] || { found: false, seen: 0, mutated: 0, firstSeen: 0 };
      const found = !!rec.found;

      const card = document.createElement('div');
      card.className = 'dex-card' + (found ? ' found' : ' locked') + (rec.mutated ? ' has-mut' : '');

      const cv = document.createElement('canvas');
      cv.className = 'dex-thumb';
      card.appendChild(cv);

      const name = document.createElement('div');
      name.className = 'dex-name';
      name.textContent = found ? t('jelly.' + key) : t('dex.unknown');
      card.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'dex-meta';
      if (found) {
        meta.innerHTML =
          `<span>${t('dex.first', { d: fmtDate(rec.firstSeen) })}</span>` +
          `<span>${t('dex.seen', { n: rec.seen || 1 })}</span>` +
          (rec.mutated ? `<span class="mut">${t('dex.mut', { n: rec.mutated })}</span>` : '');
      } else {
        meta.innerHTML = `<span class="dim">${t('dex.hint')}</span>`;
      }
      card.appendChild(meta);

      el.grid.appendChild(card);

      // 尺寸依赖布局，下一帧再画
      const idx = i;
      requestAnimationFrame(() => drawThumb(cv, idx, found, !!rec.mutated));
    }
  }

  function show() {
    if (!el.overlay) return;
    render();
    el.overlay.classList.remove('hide');
    open = true;
  }

  function hide() {
    if (!el.overlay) return;
    el.overlay.classList.add('hide');
    open = false;
    if (onClose) onClose();
  }

  function toggle() {
    if (open) hide();
    else show();
  }

  function bind() {
    if (el.close) el.close.addEventListener('click', hide);
    if (el.overlay) {
      el.overlay.addEventListener('click', (e) => {
        if (e.target === el.overlay) hide();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) hide();
    });
  }

  return { show, hide, toggle, render, bind, get isOpen() { return open; } };
}
