// ============================================================
//  环境叙事（阶段七）
//  - 一段「古老珊瑚礁」的微型故事，按海域推进逐条解锁
//  - data 驱动，中英双语；无对白台词，只有留白的短句
// ============================================================

export const STORY_FRAGMENTS = [
  { id: 'f1', zone: 'shallow', key: 'story.f1' },
  { id: 'f2', zone: 'shallow', key: 'story.f2' },
  { id: 'f3', zone: 'midnight', key: 'story.f3' },
  { id: 'f4', zone: 'midnight', key: 'story.f4' },
  { id: 'f5', zone: 'abyss', key: 'story.f5' },
  { id: 'f6', zone: 'abyss', key: 'story.f6' },
];

export function createStory(explore, onReveal) {
  /** 按海域推进：进入某海域时解锁该海域尚未读到的碎片 */
  function advance(zoneId) {
    const revealed = [];
    for (const f of STORY_FRAGMENTS) {
      if (f.zone !== zoneId) continue;
      if (explore.hasStory(f.id)) continue;
      explore.readStory(f.id);
      revealed.push(f);
      if (onReveal) onReveal(f);
    }
    return revealed;
  }

  return {
    get list() { return STORY_FRAGMENTS; },
    advance,
    get readCount() { return STORY_FRAGMENTS.filter((f) => explore.hasStory(f.id)).length; },
    get total() { return STORY_FRAGMENTS.length; },
  };
}
