// ============================================================
//  温和目标（阶段七）
//  - data 驱动，完成无惩罚，仅提示 + 奖励生物荧光
//  - 与 explore / zones / economy 咬合
// ============================================================

const QUESTS = [
  {
    id: 'q_secrets3',
    label: 'quest.secrets3',
    reward: 30,
    test: (ctx) => ctx.secrets >= 3,
  },
  {
    id: 'q_midnight',
    label: 'quest.midnight',
    reward: 40,
    test: (ctx) => ctx.zone === 'midnight' || ctx.zone === 'abyss',
  },
  {
    id: 'q_shrine',
    label: 'quest.shrine',
    reward: 25,
    test: (ctx) => ctx.shrines >= 1,
  },
  {
    id: 'q_story',
    label: 'quest.story',
    reward: 50,
    test: (ctx) => ctx.storyRead >= 4,
  },
];

export function createQuests({ onComplete }) {
  const done = {};

  function check(ctx) {
    const finished = [];
    for (const q of QUESTS) {
      if (done[q.id]) continue;
      let ok = false;
      try { ok = !!q.test(ctx); } catch (e) { ok = false; }
      if (ok) {
        done[q.id] = Date.now();
        finished.push(q);
      }
    }
    if (finished.length && onComplete) finished.forEach((q) => onComplete(q));
    return finished;
  }

  return {
    check,
    get list() { return QUESTS; },
    has(id) { return !!done[id]; },
    get count() { return Object.keys(done).length; },
    get total() { return QUESTS.length; },
    reset() { for (const k in done) delete done[k]; },
  };
}
