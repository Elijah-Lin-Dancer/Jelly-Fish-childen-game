// ============================================================
//  首次进入引导（coach marks）
//  - 只显示一次（localStorage 'ocean.coach' 标记）
//  - 2 步：移动吸引水母 / 长按召唤
// ============================================================

import { t } from './i18n.js';

const STORAGE_KEY = 'ocean.coach';

function seen() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return true; }
}
function markSeen() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* 忽略 */ }
}

export function createCoach() {
  let el = null;
  let step = 0;
  // 步骤三（期三）：FAB 收纳引导 —— 玩法按钮收进了右下角泡泡钮，
  // 不提示一句孩子会以为功能没了
  const steps = ['coach.step1', 'coach.step2', 'coach.step3'];

  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'coach hide';
    el.innerHTML =
      '<div class="coach-card">' +
      '  <div class="coach-text" id="coach-text"></div>' +
      '  <div class="coach-actions">' +
      '    <span class="coach-skip" id="coach-skip"></span>' +
      '    <span class="coach-next" id="coach-next" role="button" tabindex="0"></span>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#coach-next').addEventListener('click', next);
    el.querySelector('#coach-skip').addEventListener('click', finish);
    document.addEventListener('keydown', (e) => {
      if (el && !el.classList.contains('hide') && e.key === 'Escape') finish();
    });
    return el;
  }

  function paint() {
    ensure();
    el.querySelector('#coach-text').textContent = t(steps[step]);
    el.querySelector('#coach-skip').textContent = t('coach.skip');
    el.querySelector('#coach-next').textContent =
      step < steps.length - 1 ? t('coach.next') : t('coach.got');
    el.classList.toggle('step-last', step === steps.length - 1);
  }

  function start() {
    if (seen()) return;
    step = 0;
    paint();
    ensure().classList.remove('hide');
  }

  function next() {
    step++;
    if (step >= steps.length) { finish(); return; }
    paint();
  }

  function finish() {
    if (el) el.classList.add('hide');
    markSeen();
  }

  return { start, next, finish, get active() { return el && !el.classList.contains('hide'); } };
}
