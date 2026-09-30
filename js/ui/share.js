// ============================================================
//  明信片分享
//  - 把当前画布 + 池塘名 + 日期 合成为 PNG
//  - 优先 navigator.share({ files })，不支持则触发下载
// ============================================================

import { t } from './i18n.js';

/** 把主画布拖到一张带底栏的离屏 canvas 上 */
function compose(srcCanvas, pondName) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  const scale = Math.min(1, 1600 / srcW); // 限制最大宽度，控制体积
  const W = Math.round(srcW * scale);
  const H = Math.round(srcH * scale);
  const barH = Math.round(84 * scale);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H + barH;
  const ctx = out.getContext('2d');

  // 主画面
  ctx.drawImage(srcCanvas, 0, 0, W, H);

  // 底部渐隐 + 底栏
  const fadeH = Math.round(120 * scale);
  const fade = ctx.createLinearGradient(0, H - fadeH, 0, H);
  fade.addColorStop(0, 'rgba(3, 14, 32, 0)');
  fade.addColorStop(1, 'rgba(3, 14, 32, 0.85)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, H - fadeH, W, fadeH);

  ctx.fillStyle = 'rgba(3, 14, 32, 0.92)';
  ctx.fillRect(0, H, W, barH);

  // 池塘名
  ctx.fillStyle = '#eaf6ff';
  ctx.font = `600 ${Math.round(26 * scale)}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(pondName || t('pond.default'), Math.round(24 * scale), H + barH * 0.42);

  // 品牌 + 日期
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  ctx.fillStyle = 'rgba(200, 230, 255, 0.6)';
  ctx.font = `400 ${Math.round(15 * scale)}px -apple-system, sans-serif`;
  ctx.fillText('~ ' + t('brand') + '  ·  ' + dateStr, Math.round(24 * scale), H + barH * 0.76);

  return out;
}

export function createShare(getCanvas, getPondName, onToast) {
  async function capture() {
    const src = getCanvas();
    if (!src) return;
    const out = compose(src, getPondName());
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    if (!blob) { if (onToast) onToast('share.fail'); return; }

    const d = new Date();
    const name = `jellyfish-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Date.now()}.png`;
    const file = new File([blob], name, { type: 'image/png' });

    // 优先系统分享（移动端）
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: getPondName() || t('pond.default') });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 用户取消
        // 其它错误 -> 回退下载
      }
    }

    // 回退：下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (onToast) onToast('share.saved');
  }

  return { capture };
}
