# 扩展设计方案：让水母海洋成为「完整的游戏」

> 目标：在不破坏现有零构建 / ES Module / Canvas 2D 架构的前提下，补齐让项目从「禅意沙盒」升级为「可长期游玩的游戏」的五大支柱。  
> 原则：每个阶段都可独立上线；新增模块为主、改动现有逻辑为辅；全部沿用已有的 `state / collection / locales / scheduler` 体系。

> **🟢 状态（2025-09-30 更新）：四个阶段已全部完成并上线。** 图鉴面板、池塘存档、变异事件、成就闭环、截图分享、引水母归巢玩法、设置面板、每日稀有客、首次引导、无障碍均已实装，线上经无头浏览器端到端验证零报错。
> 线上地址：<https://elijah-lin-dancer.github.io/Jelly-Fish-childen-game/>

---

## 现状盘点（已具备的钩子）

| 能力           | 位置                                              | 现状                            |
| ------------ | ----------------------------------------------- | ----------------------------- |
| 6 种水母 + 正式名字 | `JELLY_PALETTES` / locales `jelly.*`            | 名字齐全，但只在代码里                   |
| 图鉴计数 `0/6`   | `gameplay/collection.js` + HUD `#dex`           | 只存 `Set<index>`，**点了无反应、无详情** |
| 水母成长         | `jellyfish.update()` `scale→1`                  | 有，但不存档                        |
| 变异机制         | `jellyfish.mutate()`（5 次互动触发）                   | **完全隐形**，仅弹 `dex.new` 小 toast |
| 池塘命名         | `ui/home.js` → `localStorage('ocean.pondName')` | 有，但仅名字留存                      |
| 集齐奖励         | `main.js` `spawnEggJelly()`                     | 有彩蛋水母，无庆祝页                    |
| 昼夜 / 撒饵 / 主题 | 各自 system                                       | 完整                            |

**核心缺口**：图鉴不可看、池塘不留存、变异不可见、无目标闭环、无分享。

---

## ✅ 阶段一 · 图鉴面板 + 池塘存档（P0，最关键一跃）

### 1.1 图鉴详情面板（`js/ui/dex.js` 新增）

- 点击右上角 `#dex` 弹出全屏半透明 modal，6 张物种卡片网格排列。
- 每张卡：水母 emoji/缩略绘制、名字（`t('jelly.<key>')`）、状态。
  - 已发现：显示名字 + 首次发现时间 + 已见次数 + 变异数。
  - 未发现：剪影 + `？` + 占位文案「尚未邂逅」。
- 顶部显示 `{n}/{total}` 进度条；集齐时整卡发光。
- 数据来源：`collection` 升级后的每物种对象（见 1.2）。

### 1.2 图鉴数据升级（`js/gameplay/collection.js` 改）

把 `found: Set` 升级为每物种记录：

```js
// 存档结构（localStorage 'ocean.dex'）
{ "0": { found:true, firstSeen:1717000000000, seen:12, mutated:3 }, ... }
```

- 新增 `see(index)`（每次出现计数）、`mutatedCount(index)`、`firstSeenOf(index)`。
- `unlock` 时写 `firstSeen`（首次）。
- 向后兼容：旧 `Set` 序列化数据读取时自动迁移。

### 1.3 池塘存档（`js/gameplay/save.js` 新增）

- 序列化当前水母数组（节流写入，约每 3s + `visibilitychange` 隐藏时 + `beforeunload`）：

```js
// localStorage 'ocean.pond'
[{ x,y, paletteIndex, scale, mutated, interactions }, ...]   // 上限=quality.jellyfish*2.5
```

- `start()` 时：有存档则 `restorePond()` 重建水母（坐标按视口 `clamp`，避免跨屏越界）；无存档走原 `seedWorld`。
- `softRebuild` / `spawnJellyfish` 后自动纳入存档。
- **重置池塘**：首页或设置加按钮，清空 `ocean.pond`（可选同时清空 `ocean.dex`），二次确认。
- 体积：桌面顶配 ~50 只 × 小 JSON < 50KB，远低于 5MB 配额，安全。

### 改动文件

`index.html`(+dex modal 容器)、`css/main.css`(+dex 样式)、`ui/hud.js`(+#dex 点击)、`gameplay/collection.js`(升级)、`main.js`(restore/save 接线)、`ui/locales.js`(+dex 文案)。

---

## ✅ 阶段二 · 激活变异 + 成就闭环（P1）

### 2.1 把变异做成事件

- `main.onTap` 中 `j.interact()` 返回 `true`（即本次变异）时：
  - 醒目 toast：`你的 {old} 变异成了 {new}！`（取变异前后 palette key）。
  - 触发更强 `flash` + 短暂光圈扩散动画（复用 `Ripple`）。
  - 计入图鉴 `mutatedCount`。

### 2.2 成就系统（`js/gameplay/achievements.js` 新增）

- 成就定义（data 驱动，易扩展）：
  | id             | 触发      | toast  |
  | -------------- | ------- | ------ |
  | `first_mutate` | 首次变异    | 初次变异！  |
  | `dex_done`     | 集齐图鉴    | 图鉴全收集！ |
  | `breeder`      | 养大 30 只 | 养育大师   |
  | `midnight`     | 夜间邂逅新种  | 午夜访客   |
  | `summoner`     | 召唤 25 只 | 召唤者    |
  | `feeder`       | 投喂 50 次 | 投饵达人   |
- 存储 `localStorage('ocean.ach')` = `{ id: unlockedAt }`。
- HUD 显示已解锁星数 `⭐ n/6`；解锁时弹成就 toast（带图标）。
- 统计埋点：在 `spawnJellyfish / feeding.drop / unlockJelly / mutate` 处 +1 计数。

### 改动文件

`ui/hud.js`(+星标)、`main.js`(变异 toast + 计数埋点)、`entities/jellyfish.js`(interact 返回新旧 palette)、`ui/locales.js`(+成就文案)。

---

## ✅ 阶段三 · 截图分享 + 轻量玩法（P2）

### 3.1 明信片分享（`js/ui/share.js` 新增）

- HUD 加 📸 按钮：离屏 canvas 把主画布 `toDataURL` + 叠加池塘名 + 日期，生成 PNG。
- 优先 `navigator.share({files})`（移动端直接分享）；不支持则触发下载 `<a download>`。
- 导出前暂停 1 帧确保画面干净。

### 3.2 轻量目标玩法（`js/systems/activity.js` 新增）

- 「引水母归巢」：屏幕随机位置生成发光目标环（柔和脉冲，符合平静基调）。
- 目标：让 ≥ N 只水母同时进入环内持续 T 秒 → 达成奖励（toast + 小礼花气泡）。
- 简单状态机：`idle → active → success`，可随时在 HUD 开关；不强制、不打断沉浸。
- 复用 `feeding.nearest` 式的邻近判断，零新依赖。

### 改动文件

`index.html`(+📸 按钮)、`css/main.css`(+分享/活动环样式)、`ui/hud.js`(按钮接线)、`main.js`(调度 activity)、`ui/locales.js`(+分享/活动文案)。

---

## ✅ 阶段四 · 打磨项（P3）

| 功能    | 说明                                     | 位置                                     |
| ----- | -------------------------------------- | -------------------------------------- |
| 设置面板  | 手动画质档（复用 `setTier`）、减弱动效、静音持久化         | `ui/settings.js` 新增 + HUD ⚙ 按钮         |
| 每日稀有客 | 按日期种子确定当日限定配色水母（确定性、可复现）               | `main.spawnJellyfish` 加 `dailyRare` 判定 |
| 首次引导  | 首页加一句目标文案；首次进入 2 步 coach mark          | `ui/home.js` / `locales`               |
| 无障碍   | 按钮 `aria-label` 已部分有；补足键盘可达 + focus 样式 | `css/main.css`                         |



---

## 文件改动总览

**新增（6 个）**

- `js/ui/dex.js`、`js/gameplay/save.js`、`js/gameplay/achievements.js`、`js/ui/share.js`、`js/systems/activity.js`、`js/ui/settings.js`

**修改（8 处）**

- `js/gameplay/collection.js`（图鉴数据升级 + 迁移）
- `js/entities/jellyfish.js`（`interact` 返回变异前后 palette）
- `js/ui/hud.js`（#dex 点击、星标、📸/⚙ 按钮）
- `js/ui/home.js`（重置池塘入口、引导文案）
- `js/main.js`（restore/save、变异 toast、计数埋点、activity 调度）
- `js/ui/locales.js`（dex / 成就 / 分享 / 活动 / 设置 文案，中英双语）
- `index.html`（dex modal、📸、⚙、活动环容器）
- `css/main.css`（对应样式）

**存储键约定**

- `ocean.pondName`（已有）、`ocean.dex`（升级）、`ocean.pond`（新增）、`ocean.ach`（新增）、`ocean.settings`（新增）

---

## 推荐实施顺序

1. **阶段一** → 立刻让「收集」与「养成」显形并留存，是体验质变点。
2. **阶段二** → 用变异事件 + 成就给「为什么一直玩」一个答案。
3. **阶段三** → 分享带来传播，轻玩法带来短期目标。
4. **阶段四** → 设置 / 每日客 / 引导做长期打磨。

每阶段结束即 commit + 推 Pages，保证线上随时可玩、可回滚。

---

## 总体进度看板

| 阶段 | 内容 | 状态 | 新增文件 |
| --- | --- | --- | --- |
| 阶段一 | 图鉴面板 + 池塘存档 | ✅ 已完成 | `ui/dex.js`、`gameplay/save.js` |
| 阶段二 | 变异事件 + 成就闭环 | ✅ 已完成 | `gameplay/achievements.js`、`entities/env.js`(Celebrate) |
| 阶段三 | 截图分享 + 引水母归巢 | ✅ 已完成 | `ui/share.js`、`systems/activity.js` |
| 阶段四 | 设置 / 每日稀有客 / 引导 / 无障碍 | ✅ 已完成 | `ui/settings.js`、`gameplay/daily.js`、`ui/coach.js` |
| 阶段五 | 活的海：洋流 + 生态链 + 温和大鱼 | ✅ 已完成 | `systems/current.js`、`systems/ecosystem.js`、`entities/bigfish.js` |
| 阶段六 | 繁育与成长：基因 + 生物荧光经济 + 专长 | ✅ 已完成 | `gameplay/genes.js`、`gameplay/breeding.js`、`gameplay/economy.js`、`gameplay/specialize.js`、`ui/lab.js` |
| 阶段七 | 深潜与故事：海域 + 秘密 + 环境叙事 + 目标 | ✅ 已完成 | `systems/zones.js`、`gameplay/explore.js`、`entities/secret.js`、`gameplay/story.js`、`systems/quests.js`、`ui/atlas.js` |
| 阶段八 A | 双模式 + 建造轴：和平/冒险自选 + 珊瑚工坊 | ✅ 已完成 | `systems/mode.js`、`systems/build.js`、`ui/buildPad.js`、`ui/modeSelect.js` |
| 阶段八 B | 冒险成长轴：吃→长大 + 缺氧休眠 + 大鱼调凶 | ✅ 已完成 | 复用 `entities/bigfish.js`、`entities/jellyfish.js`、`systems/ecosystem.js` |
| 隐藏内容 | Bogyó · 隐藏猫猫水母（口令解锁，私人） | ✅ 已完成 | `js/memory.config.js`、`gameplay/memory.js`、`ui/memoryPad.js`、`entities/bogyo.js` |

**交付物清单**（相比原方案的设计，全部落地，无缩水）

- 图鉴可看：点 `#dex` 弹全屏 modal，6 张物种卡显示名字 / 首次发现 / 已见次数 / 变异数，未发现的显示剪影 + `？`。
- 池塘留存：水母数组节流写入 `ocean.pond`，刷新自动重建；首页 / 设置可二次确认重置。
- 变异显形：`interact()` 触发时弹「旧 → 新」toast + 光圈扩散，并计入图鉴 `mutatedCount`。
- 成就闭环：6 个 data 驱动成就写入 `ocean.ach`，HUD 显示 `⭐ n/6`，解锁弹 toast。
- 截图分享：📸 按钮离屏合成「主画布 + 池塘名 + 日期」PNG，优先 `navigator.share` 否则下载。
- 轻量玩法：「引水母归巢」发光目标环，≥3 只入环持续 2s 触发成功奖励。
- 打磨项：⚙ 设置面板（画质档 / 减弱动效 / 静音）、按日期种子的每日稀有客（金色光环）、首次 2 步引导、键盘可达 + focus 样式。
- **活的海**（阶段五）：拖拽生成洋流推力与流线可视化，浮游→鱼群→水母的生态链，一条温和大鱼巡游并会「吓退」靠近的水母。
- **繁育与成长**（阶段六）：水母带 4 项基因（体型 / 荧光 / 速度 / 触手），邻近成年自动繁育并遗传 + 变异；生物荧光货币与繁育 / 探索 / 收藏三系专长。
- **深潜与故事**（阶段七）：三个深度海域（微光层 / 午夜层 / 深渊）按探索进度解锁并平滑过渡色调；海域内散布可点击的秘密（贝壳 / 神殿）；6 段环境叙事碎片随探索浮现；4 条目标串起长期动机。
- **双模式 + 建造轴**（阶段八 A）：新池塘开局自选「和平 / 冒险」（MC 式，模式锁进存档）；珊瑚工坊可布置珊瑚丛 / 礁石 / 灯塔 / 海草带四种预设构件，消耗生物荧光，各自产生生态效果（繁育倾向 / 庇护 / 产出提升 / 削弱洋流）。
- **冒险成长轴**（阶段八 B）：冒险模式下喂食浮游使水母持续长大；深海（微光 / 深渊）耗氧，缺氧归零则休眠沉底、返回浅海自动苏醒；大鱼化为掠食者（暗红 + 利齿），会叼走一只水母（中档失败，优先保护稀有 / 杂交个体，礁石庇护范围内安全）；和平模式一切照旧温和。
- **矢量图标**（阶段七后修）：HUD 全部改用内联 SVG，去除对 emoji 字体的依赖（此前无字体环境会渲染成空方块）。
- **隐藏纪念内容**：设置面板标题连点 5 次浮出口令框，口令正确后一只名为 **Bogyó** 的橘白猫猫水母常驻海洋（歪耳 / 吐舌 / 浣熊环纹尾），并浮现一段匈牙利语微型故事。口令只存 SHA-256 摘要，明文不入库；内容文案集中在 `js/memory.config.js`，改字不碰逻辑。

**质量保障**：每阶段均通过单测 + 无头 Chromium 端到端验证（含下载事件、`localStorage` 断言），线上复测零 JS 报错。阶段七起本地 + 线上各跑 8 项 e2e 全绿（洋流 / 实验室 / 繁育 / 海域解锁 / 图鉴 / 秘密 / 专长 / 隐藏纪念）。
