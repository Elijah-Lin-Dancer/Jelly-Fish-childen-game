// ============================================================
//  Bogyó — 私人纪念内容配置
// ============================================================
//  ⚠️ 这个文件是「唯一需要编辑的地方」。改引号里的字就行，
//     不用碰任何其他代码。
//
//  ── 怎么改 ──────────────────────────────────────────────
//  1. passwordHash：解锁口令。想换口令时，把新口令发给开发者重新生成。
//     它存的是 SHA-256 摘要，明文口令不会出现在这里。
//  2. name / nickname：显示用的名字。
//  3. lines：图鉴里逐句浮现的话。想加/删句子，就在数组里加/删一行。
//     每行一句，记得用引号包起来，行末加逗号。
//  4. palette：水母颜色。橘白配色对应他的毛色。
// ============================================================

export const MEMORY = {
  // 解锁口令的 SHA-256 摘要（盐值见 memory.js）
  // 换口令需重新计算摘要，明文不会出现在这里
  passwordHash: '00944d24f86531d5ec016cd72782f890588ee5352f988e0495557c17aeed74b0',

  name: 'Bogyó',          // 主显示名
  nickname: 'Bogyesz',    // 开场白里用的昵称
  epithet: 'Bogyi',       // 图鉴卡片下方的小字标注

  // 橘白配色：上橘下白，对应他身上的花色
  palette: { core: '#f7b06a', glow: '#ff8f3c', tent: '#fff0e0' },

  // 解锁瞬间的开场白（匈牙利语）
  greeting: 'Szia, Bogyesz. Végre hazaértél.',

  // 图鉴里逐句浮现的话（匈牙利语）
  lines: [
    'Tudtam, hogy visszajössz.',
    'A fülkéd mindig félrecsúszott, a nyelvecskéd mindig kilógott —',
    'és a farkad olyan volt, mint egy mosómedvéé.',
    'Most itt úszkálsz. Csendben. Velem.',
    'Jó éjt, Bogyó.',
  ],

  // 图鉴卡片标题
  cardTitle: 'Bogyó',
  // 图鉴卡片副标题
  cardSubtitle: 'Egy kicsi barát, aki hazatalált.',
};
