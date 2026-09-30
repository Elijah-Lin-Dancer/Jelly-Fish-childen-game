# 阶段七 · 深潜与故事（P2）—— 详细开发方案

> 来源：`RESEARCH-EXTENSION.md` 阶段七（4.5 海域解锁 / 探索与秘密 + 4.6 目标/轻分支 + 环境叙事）
> 目标：补上「目的感」——让玩家有**往下走的理由**：三片海域依次解锁、每片藏有秘密、用环境无声讲一个珊瑚礁的微型故事。
> 状态：✅ 已实施并推送

---

## 1. 设计原则

- **不靠失败驱动**：海域靠「发现/照料累积」解锁，不靠通关或计时。
- **探索奖励好奇心**（马里奥彩蛋 / ABZÛ 隐藏贝壳 / Journey 环境叙事）：隐藏贝壳、冥想点、传送洋流。
- **叙事靠环境**：无对白，用「故事碎片 + 咒语式短句」拼出一个古老珊瑚礁的兴衰。
- **零构建 / ES Module / Canvas**：沿用 `createX` + 调度器 `order`。

---

## 2. 模块拆分

### 2.1 `js/systems/zones.js` — 海域
- 三片海域：`shallow`（阳光浅海）/ `midnight`（微光层）/ `abyss`（深渊）。
- 每片海域定义：背景色调 tint、景深雾强度、光柱强度、可出现的生物。
- 解锁门槛（温和、正向）：`shallow` 默认；`midnight` 需 `speciesFound >= 3 && breeds >= 3`；`abyss` 需 `speciesFound >= 5 && breeds >= 8`。
- `setZone(id)` 平滑过渡（tint 插值），供背景/景深读取。

### 2.2 `js/entities/secret.js` — 秘密实体
- `Secret`：隐藏贝壳 / 冥想点，缓慢脉动，玩家点击可发现。
- 发现后：触发 `onDiscover(secret)` → 记录到 explore + 产出生物荧光 + toast。
- 每片海域布置若干秘密；未被发现时低调可见（引导好奇心）。

### 2.3 `js/gameplay/explore.js` — 探索记录
- 记录已发现的秘密（按 id）、已解锁海域、已读故事碎片。
- 持久化 `localStorage 'ocean.explore'`。
- 提供 `discover(id)`、`has(id)`、`count`、`total`。

### 2.4 `js/gameplay/story.js` — 环境叙事
- 一段「古老珊瑚礁」微型故事，拆成若干碎片，按海域推进逐条解锁。
- data 驱动，中英双语；读到新碎片时用柔和 toast 呈现。

### 2.5 `js/systems/quests.js` — 温和目标
- data 驱动目标：如「发现 3 处秘密」「抵达微光层」「完成 5 次归巢」。
- 完成无惩罚，仅提示 + 奖励生物荧光（与经济系统咬合）。

### 2.6 UI
- HUD 左上角显示**当前海域名**；新增 🧭 按钮打开「探索图鉴」面板（海域解锁进度 / 秘密数量 / 故事碎片）。

---

## 3. 接入点（main.js）

| 位置 | 改动 |
| --- | --- |
| import | `zones`、`explore`、`story`、`quests`、`Secret` |
| 实例 | `zones = createZones(...)`、`explore = createExplore(...)`、`story = createStory(...)`、`quests = createQuests(...)` |
| 调度器 | `secrets`（实体池，order 4）、`quests`（order 14）、`story`（order 15） |
| 点击 | `onTap` 命中秘密 → 发现 |
| 背景 | `createBackground` 读取 `zones.tint` 做色调过渡 |
| HUD | 海域名、🧭 面板、秘密计数 |
| 文案 | 中英双语（海域名 / 故事 / 目标 / 面板） |

---

## 4. 验证

- `node --check` 全部新增/修改 JS。
- 无头 Chromium：加载 → 断言海域名渲染 → 强制发现一处秘密 → 断言 `ocean.explore` 落盘 → 打开面板 → 零 JS 报错。
- 线上 Pages 复测。

---

## 5. 不做（守住范围）

- 不做失败/限时/体力。
- 海域不做独立地图，仍是同一片海，只是「深度氛围 + 解锁内容」变化。
- 故事不做分支结局（留白更契合禅意）。
