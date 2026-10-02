# Phase 10 方案 · 向「我的世界」看齐的开篇体验

> 目标：把水母海洋的开篇从"命名卡"升级为 MC 式体验——**标题屏 + 新建世界（选模式 / 选群系 / 输种子 / 选伴随水母）+ 5 种可探索地图 + 专属伴随水母外观**。
> 沿用零构建 / ES Module / Canvas2D 架构，不破坏已上线的 Phase 1–9。

> 本方案所有"向 MC 看齐"的判断均来自真实 MC 设计文档（见末尾「调研来源」），非凭空脑补。关键数值（水色/雾色 hex、创建界面字段、种子算法、美西螈变体概率）已逐条对齐。

---

## 0. 调研结论（MC 真实设计，作为本方案依据）

### 0.1 标题屏 + 新建世界界面（MC Java/Bedrock 真实结构）
来源：[Create New World](https://minecraft.wiki/w/Create_New_World) · [Menu screen (Java)](https://minecraft.wiki/w/Tutorial:Menu_screen_(Java_Edition))

- **主菜单**：大 Logo + 缓慢旋转的 panorama 全景背景 + 竖排菜单（`单人 / 多人 / Realms / 设置 / 退出`）。
  → 我们对应：**优雅海洋风**标题屏（活海洋全景漂移 + 大标题 + 竖排菜单 `继续 / 新建世界 / 设置 / 语言`）。不用像素方块，保留水母海洋的唯美调性。
- **新建世界（Create New World）**是个独立面板，Java 版分 3 个标签页、选项多为"可循环切换的按钮"：
  - **Game 标签页**：`世界名称`（输入框，默认 "New World"）、`游戏模式`（循环：生存/极限/创造，默认生存）、`难度`（循环：和平/简单/普通/困难，默认普通）、`允许命令`。
  - **World 标签页**：`世界类型`（Default / Superflat / Large Biomes / AMPLIFIED / Single Biome / 调试）、`种子码`（**任意字符串，留空=随机**）、`生成结构`（默认开）、`奖励箱`（默认关）。
  - **More 标签页**：数据包 / 实验性内容 / 游戏规则。
  - Bedrock 版更简洁：左侧缩略图预览 + `世界名称 / 默认游戏模式(下拉) / 难度(下拉) / 世界类型 / 种子码 / 起始地图开关 / 奖励箱开关` + `创建` 按钮。
- **关键模式借鉴**：
  1. 模式用"循环按钮"切换 → 我们 `和平 / 冒险` 用循环按钮（已实装于 `modeSelect`）。
  2. **种子可留空=随机、可抄写分享**（seed 在 Bedrock 编辑界面可见、Java 用 `/seed` 查看）→ 我们种子框留空随机生成、生成后显示可抄。
  3. **奖励箱**=出生点附近给新手物资 → 我们做 `起始礼包` 开关：开则额外送 1 个初始建筑 + 一点生物荧光。
  4. **Bedrock 缩略图预览**=选完选项实时显示世界缩略图 → 我们做"**实时预览**：选不同群系，背景活海洋立即换水色/氛围/标志结构"。

### 0.2 生物群系模型（MC 真实颜色数据）
来源：[Water（水体颜色/雾色 hex）](https://minecraft.wiki/w/Water) · [Biome（海洋变体特征）](https://minecraft.wiki/w/Biome) · [Ocean Biome 指南](https://minecraft.archive.fandom.com/wiki/Ocean)

MC Java 版**海洋类群系**的水色/雾色（已核实 hex）：

| MC 群系 | 水体颜色 water | 水下雾色 fog | 标志性结构 / 物种 |
| --- | --- | --- | --- |
| Warm Ocean 暖水海洋 | `#43D5EE` | `#041F33` | 浅绿清水、珊瑚礁 + 海泡菜(发光)、河豚+热带鱼、沙底、**无海带**、无鳕鱼 |
| Lukewarm Ocean 温水海洋 | `#45ADF2` | `#041633` | 青蓝、海带+海草、沙底、鳕鱼+鲑鱼 |
| Ocean 普通海洋 | `#3F76E4` | `#050533` | 砾石底、海带+海草、鳕鱼+鱿鱼、夜间溺尸 |
| Cold Ocean 冷水海洋 | `#3D57D6` | `#050533` | 暗靛蓝、砾石底、鲑鱼+鳕鱼、海豚 |
| Frozen Ocean 冻洋 | `#3938C9` | `#050533` | 暗紫、浮冰 + **冰山(蓝冰/ packed ice)**、流浪者+北极熊+溺尸、无海豚 |
| Deep 系列 | 同表色 | 同上 | 深度翻倍、海底神殿、守卫者 |
| **Mushroom Fields 蘑菇岛** | `#8a8997` | `#8a8997` | **菌丝地、巨型蘑菇、仅哞菇/蝙蝠/荧光鱿生成、无夜间敌对生物（安全）** |

> 这些 hex 是**水色本身**（水体叠加色），我们的水母海洋是 Canvas 渐变背景，不直接套 hex，而是把"相对色相/亮度差"作为 `baseTint` 偏移量（见 §2 表）。蘑菇岛的"无敌对生物"直接对应我们 `predatorSafe` 机制。

### 0.3 种子系统（MC 真实算法）
来源：[World seed](https://minecraft.wiki/w/World_seeds) · [种子(世界生成)](https://zh.minecraft.wiki/w/种子（世界生成）)

- 种子是**任意字符串或整数**；含非数字字符时，MC 用 `String.hashCode()` 转成 **32-bit 整数**（即世界总数被限制在 2³²）。
- 世界生成调用 **Perlin noise**（伪随机），**相同种子 → 完全相同地形**（可复现、可分享）。
- **留空 → 自动随机**（用系统时间）；Java 输入框显示默认数字，但若不改就用随机种子。
- 我们采用等价实现：`xfnv1a(str) → uint32` 作为种子；`mulberry32(seed)` 作为可复现 PRNG；所有"世界差异"（装饰散布、当日稀有、蘑菇海概率、幻紫解锁）**全部从 PRNG 派生**，确保同种子同世界。

### 0.4 伴随生物范本：美西螈（MC 真实 5 变体 + "装桶即归属"）
来源：[Axolotl（美西螈）](https://minecraft.wiki/w/Axolotl) · [Mob Menagerie: Axolotl](https://www.minecraft.net/fr-fr/article/axolotl)

- 美西螈是 MC 里**可装桶带在身边**的水生被动生物，最贴"你的专属伴随水母"。
- **5 个颜色变体**（已核实概率）：Leucistic 粉(常见~25%) / Wild 棕(常见~25%) / Gold 金(常见~25%) / Cyan 冰蓝(常见~25%) / **Blue 靛蓝(稀有，仅繁殖 1/1200 = 0.083%，野外无法自然生成)**。
- **"装桶 = 归属"**：用桶捞起再放下即 `persistent`，永不消失；野生未捞的会 despawn。→ 我们**伴随水母在"新建世界"被选定时即写入存档**，等价于"已归属"，持久存在。
- **跟随**：美西螈会跟随手持热带鱼的玩家（用引饵）；我们简化为伴随水母**缓动跟随光标**（光标 = 玩家吸引点）。
- 注意：美西螈**没有"驯服"状态**（不坐下/不传送），只有"信任/持久"——我们伴随水母同理：只是跟随 + 身份标识，不参与战斗/繁育。

---

## 1. 范围（已与用户确认）

1. **标题屏**：优雅海洋风（神似 MC，非像素方块）。缓慢漂移的活海洋全景 + 大标题 + 竖排菜单（继续 / 新建世界 / 设置 / 语言）。
2. **新建世界面板**：世界名 + 模式(和平/冒险) + 生物群系(5 选) + 种子码 + 你的水母(外观 5 选) + 起始礼包开关。一次走完，MC 式（含实时预览）。
3. **生物群系（5 个）**：珊瑚礁 / 极地冰海 / 深海热泉 / 荧光湾 + 罕见**蘑菇海**（种子极小概率开出，安全无掠食）。
4. **伴随水母外观（5 变体）**：樱粉 / 焦糖棕 / 流金 / 冰蓝 / **幻紫(稀有，仅特定种子开出)**，长期跟随光标，HUD 显示小头像。

---

## 2. 生物群系定义（`js/systems/worlds.js` 新增）

每个群系 = 水色基调 `baseTint` + 氛围(雾度 haze / 光柱 rays) + 标志结构 `feature` + 权重物种 + 一个小机制。叠加在现有**深度海域**（浅海/午夜/深渊）之上，深度层继续当进度解锁用。

> `baseTint` 为对背景渐变的 **[R,G,B] 相对偏移**（非 MC 绝对 hex，因我们是 Canvas 渐变；数值方向参考 §0.2 的色相差：暖洋偏青绿、冻洋偏暗紫、蘑菇岛偏粉灰）。

| id | 名称 | MC 原型 | baseTint[r,g,b] | haze / rays | 标志结构 feature | 机制 | 权重物种 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `coral` | 珊瑚礁 | Warm Ocean `#43D5EE` | `[+10,+22,−14]` 暖青绿 | 1.05 / 1.10 | 珊瑚丛 coral（多色扇珊瑚 + 海泡菜光点） | 平静（水流更稳） | 热带系水母↑ |
| `polar` | 极地冰海 | Frozen Ocean `#3938C9` | `[−18,−6,+26]` 冷白蓝 | 0.95 / 1.00 | 浮冰 ice（蓝冰反光 + 缓慢飘落雪粒） | 节奏慢（生物更新 dt×0.85） | 蓝系水母↑ |
| `vent` | 深海热泉 | Deep Ocean + 洞穴暗红辉 | `[−30,−22,−10]` 暗 + 红辉 | 0.60 / 0.30 | 火山微光 vent（底部暗红脉动 + 上升气泡） | 缺氧更快（oxRate −0.0018） | 发光稀有水母偏多 |
| `neon` | 荧光湾 | 原创梦幻 | `[+6,+20,+10]` 霓虹 | 0.90 / 0.85 | 荧光粒子 neon（悬浮发光浮游 + 海泡菜） | 生物荧光经济 ×1.25 | 荧光系水母↑ |
| `mycelium` | 蘑菇海（罕见） | Mushroom Fields `#8a8997` | `[+14,+10,+14]` 粉彩灰 | 1.10 / 1.15 | 菌丝微光 mycelium（巨型蘑菇剪影 +  spores） | **无掠食者** `predatorSafe` | 均匀 + 偏 peace 治愈 |

- `createWorld({ type, seed })` 返回世界实例，暴露：
  - `baseTint / haze / rays / feature / predatorSafe`（布尔）
  - `mechanics`：`{ calm, dtScale, oxRate, bioMult }`
  - `speciesWeight(paletteIndex)` → 该群系下各配色水母的出现权重
- **种子驱动的世界差异（确定性）**：装饰散布坐标（珊瑚/浮冰/热泉/荧光粒子位置）由 `prng` 派生；当日稀有水母种类由 `prng` 派生；蘑菇海概率与幻紫解锁见 §3。

---

## 3. 种子系统（`js/core/seed.js` 新增）

```js
// 任意字符串 -> 32bit 整数（xfnv1a，等价 MC 的 String.hashCode 思路）
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// 可复现 PRNG（mulberry32）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(str) {
  const seed = str && str.trim() ? hashSeed(str.trim()) : (Math.random() * 2 ** 32) >>> 0;
  return { seed, rng: mulberry32(seed) };
}
```

- **留空=随机**：`makeRng('')` 用 `Math.random` 生成 32bit 种子，创建后把该 `seed` 显示出来供抄写（MC 同款"默认数字但可分享"）。
- `rollMushroom(seed)`：用 `mulberry32(seed)()` **首抽 `< 0.005`**（0.5%）→ 强制群系为蘑菇海（惊喜，对应蘑菇岛"罕见"）。
- `rareCompanionUnlocked(seed)`：PRNG 另一抽 `< 0.01`（1%）或命中"魔法种子表" → 新建面板里**幻紫**变体从灰变可选（美西螈蓝变体"野外无法自然生成、仅特殊途径"的等值映射，我们选"种子开出"路线）。
- **可复现保证**：装饰坐标、当日稀有、蘑菇海、幻紫——全部从同一 `rng` 按顺序派生；同种子 ⇒ 同世界，可抄种子复现。

---

## 4. 伴随水母（`js/entities/companion.js` 新增）

遵循美西螈模型（§0.4）：**常见×4 + 1 稀有**、**"选定即归属"持久**、**跟随光标**。

| variant | 名称 | 配色 | 钟体花纹 pattern | MC 原型 |
| --- | --- | --- | --- | --- |
| `lucy` | 樱粉 | 粉 `#F7B7CE` | spots 点 | Leucistic 粉(~25%) |
| `wild` | 焦糖棕 | 棕 `#C98A4B` | plain 素 | Wild 棕(~25%) |
| `gold` | 流金 | 金 `#F2C14E` | stripes 纹 | Gold 金(~25%) |
| `cyan` | 冰蓝 | 冰蓝 `#7FD8E8` | rings 环 | Cyan 冰蓝(~25%) |
| `rare` | 幻紫 | 紫 `#B98CFF` | star 星 | Blue 靛蓝(稀有 0.083%，仅特殊途径) |

- `createCompanion({ variant })`：类水母实体，`update(dt, pointer)` 缓动跟随光标（lerp + 轻微漂浮），`draw(ctx)` 带专属花纹 + 柔光晕。
- **区别于 Bogyó**：companion 为**玩家身份标识**，仅跟随光标、不参与生态/繁育/可被叼走；Bogyó 为隐藏纪念（猫），独立逻辑不变。两者可同时存在于海洋。
- **HUD 头像**：池塘名旁新增 `#companion-portrait` 小圆头像（缩绘 companion 配色+花纹）。

---

## 5. 存档升级（`js/gameplay/save.js` 改）

```js
// v3
{ v:3, mode, worldType, seed, companion, name, buildings, jelly }
```

- 旧数组 / v2 → 迁移为 `peace + coral(默认群系) + 随机 companion + 随机 seed`。
- `readMeta()` 返回 `{ mode, worldType, seed, companion, name }` 供标题屏"继续"恢复（不重置世界）。
- `readRaw()` 在 serialize 时把 `companion` 一并落盘。

---

## 6. 接线点（`js/main.js` 改）

- 启动先显示**标题屏**（`home.js` 重构为 `title.js` 控制器）：有存档 → "继续"直接 `restorePond()` + 应用 `world`/`companion`；无存档 / 点"新建世界" → 打开**新建世界面板**（`ui/createWorld.js` 新增）。
- 面板确认后：`mode.set(m)` + `world.apply(type, seed)` + `spawnCompanion(variant)` + 写 save v3 → 进入（原 `modeSelect` 自动弹窗改为仅兜底，正常走面板）。
- `zones` 叠加世界 `baseTint`（`zones.setZone` 时合并 `world.baseTint`）。
- 背景绘制读取 `world.feature` 画标志结构（coral / ice / vent / neon / mycelium）。
- 物种刷新权重读取 `world.speciesWeight`；蘑菇海 `predatorSafe` 时 `ecosystem` 不生成捕食大鱼。
- 缺氧机制：`world.mechanics.oxRate` 叠加到现有 `zones` 的氧气速率（vent 群系更快见底）。
- 经济加成：`build.yieldMultiplier()` 与 `world.mechanics.bioMult` 相乘（neon 群系 ×1.25）。

---

## 7. 新建世界面板（`js/ui/createWorld.js` 新增）字段

对齐 MC 创建界面（§0.1），竖排/卡片式、含**实时预览**：

| 字段 | MC 对应 | 实现 |
| --- | --- | --- |
| 世界名称 | 世界名称(输入框, 默认"新的世界") | 文本输入，默认 `Ocean N`（N 自增） |
| 游戏模式 | 游戏模式(循环按钮) | 和平 / 冒险 循环按钮（复用现有） |
| 生物群系 | 世界类型(卡片选择) | 5 张群系卡片，选中即切换**背景实时预览** |
| 种子码 | 种子码(任意字符串, 留空随机) | 文本输入；留空→随机并显示；含"🎲随机"按钮 |
| 你的水母 | （无 MC 直接对应，身份标识） | 5 变体头像选择；幻紫仅种子解锁后可选 |
| 起始礼包 | 奖励箱(开关, 默认关) | 开关：开→额外 1 建筑 + 初始生物荧光 |
| 创建 | 创建 按钮 | 落盘 v3 并进入 |

- **实时预览**：面板右侧/背景用同一个 `renderOcean` 管线，传入当前选中的 `world.apply(type, seed)` 结果，立即换水色/氛围/标志结构——对应 Bedrock 的缩略图预览。

---

## 8. 文案（`js/ui/locales.js` 改）

新增 `world.*`（5 群系名+描述）、`create.*`（面板文案）、`companion.*`（5 变体名），中英双语。

---

## 9. 文件改动总览

**新增（6）**
- `js/systems/worlds.js`、`js/core/seed.js`、`js/entities/companion.js`、`js/ui/createWorld.js`、`js/ui/title.js`（或重构 `home.js`）、`docs/PHASE10-PLAN.md`

**修改（6）**
- `js/main.js`（标题/新建世界/世界叠加/伴随接线）、`js/gameplay/save.js`（v3）、`js/systems/zones.js`（叠加 baseTint）、`js/ui/locales.js`、`index.html`（标题屏+新建面板+伴随头像）、`css/main.css`（标题屏/面板/头像样式）

**风险与对策**
- 吸取 Phase 9 教训：标题屏 / 新建面板遮罩必须带 `.hide` 规则且 `pointer-events:none`，避免选完卡死（同 `mode-select` bug）。
- 种子确定性：装饰 / 稀有全部走 `mulberry32` PRNG，保证同种子同世界、可分享。
- 旧存档迁移：v3 读取向下兼容，不破坏现有存档。
- 性能：实时预览复用现有渲染管线，不新建 Canvas，避免双缓冲开销。

---

## 10. 验证

- `node --check` 全量语法。
- 本地 + 线上 Playwright 冒烟：标题屏零报错 → 新建世界（选群系+种子+伴随）→ 进入后背景水色随群系变化、伴随水母跟随光标、存档 v3 写入、刷新"继续"恢复。
- 蘑菇海稀有路径：固定"魔法种子"验证群系强制为蘑菇海 + 无掠食者。
- 幻紫路径：命中 `rareCompanionUnlocked` 的种子验证新建面板里幻紫可选。
- 旧存档：Phase 1–9 的 v2/数组存档刷新后自动迁移、不丢水母/建筑。

---

## 调研来源（真实 MC 文档）

- [Create New World — Minecraft Wiki](https://minecraft.wiki/w/Create_New_World)
- [Menu screen (Java Edition) — Minecraft Wiki](https://minecraft.wiki/w/Tutorial:Menu_screen_(Java_Edition))
- [Water（水体颜色/雾色 hex）— Minecraft Wiki](https://minecraft.wiki/w/Water)
- [Biome（海洋变体特征）— Minecraft Wiki](https://minecraft.wiki/w/Biome)
- [Ocean Biome 指南](https://minecraft.archive.fandom.com/wiki/Ocean)
- [World seed（种子算法）— Minecraft Wiki](https://minecraft.wiki/w/World_seeds)
- [种子(世界生成) — 中文 Minecraft Wiki](https://zh.minecraft.wiki/w/种子（世界生成）)
- [Axolotl（美西螈 5 变体 + 装桶归属）— Minecraft Wiki](https://minecraft.wiki/w/Axolotl)
- [Mob Menagerie: Axolotl — minecraft.net](https://www.minecraft.net/fr-fr/article/axolotl)
