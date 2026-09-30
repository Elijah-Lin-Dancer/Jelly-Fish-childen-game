# 阶段五 · 活的海（P0）—— 详细开发方案

> 来源：`RESEARCH-EXTENSION.md` 阶段五（4.1 洋流与浮力 + 4.2 生态系统 / 食物网）
> 目标：把现有「布景」实体（鱼群 / 浮游 / 水母）变成**互相影响的系统**，并引入玩家可练习的「引导」技巧，让游戏第一次出现**局面与温和挑战**，同时保持无失败、非暴力的禅意基调。
> 状态：✅ 已实施并推送

---

## 1. 设计原则

- **技巧来自物理，不来自失败**：洋流是玩家用拖拽注入的矢量场，水母/大鱼受浮力与惯性影响。没有血量、没有输。
- **系统咬合优先**：浮游 → 鱼群 → 水母 形成食物链；大鱼靠近时水母温和散开（复用 `scare()`），玩家用洋流把它引开 → 形成「保护」循环。
- **零构建 / ES Module / Canvas** 架构不变；新模块用 `createX` 工厂 + 调度器 `order` 接入。
- **不存档**：洋流与大鱼是会话内环境，不写入 `ocean.pond`。

---

## 2. 模块拆分

### 2.1 `js/systems/current.js`（洋流矢量场） — 4.1
- 状态：`puffs[]`（玩家注入的局部洋流，带位置/方向/半径/寿命衰减）+ 极轻的全局环境流（让海洋始终「呼吸」）。
- `push(x,y,dx,dy)`：拖拽时按拖拽方向/速度注入或合并到附近 puff。
- `sample(x,y,t)` → `{vx,vy}`：累加附近 puff 的衰减贡献 + 环境流。
- `update(dt)`：puff 寿命衰减、影响半径缓慢扩张。
- `draw(ctx)`：用 `lighter` 混合画淡蓝短流线与柔环，作为「手感反馈」。
- `mode / toggle / setMode`：洋流模式开关（仿 feed 模式）。

### 2.2 `js/entities/bigfish.js`（温和大鱼） — 4.2
- 大型、缓慢、非捕食者。简单状态机：`wander`（环绕漂移、缓慢趋向水母群中心）→ `approach`（靠近水母群，温和令附近水母 `scare()` 散开）。
- 读取 `current.sample()` 施加到自身速度 → **玩家洋流能把它推开**（这是技巧落点）。
- 边界环绕；`nearJellies` 上升沿供 ecosystem 触发首次提示。

### 2.3 `js/systems/ecosystem.js`（食物链调度） — 4.2
- 持有 `bigFish` 实例。
- `update(dt,t)`：
  1. 浮游 → 鱼群：把每群 `cx,cy` 朝最近浮游缓慢靠拢（复用 `FishSchool.update` 的「绕中心」力，不重复 update）。
  2. 鱼群 → 水母：水母朝最近鱼群轻微聚集（食物链视觉）。
  3. `bigFish.update(dt,t,jellyfish,current)`。
  4. 大鱼首次 `approach` 时 `onEvent('eco.bigfish')` 提示一次。
- `draw(ctx)`：画大鱼。

---

## 3. 接入点（main.js）

| 位置 | 改动 |
| --- | --- |
| import | 引入 `createCurrent`、`createEcosystem`、`BigFish` |
| 实例 | `const current = createCurrent(); const ecosystem = createEcosystem({ plankton, schools, jellyfish, current, onEvent: k=>hud.toast(k) });` |
| 调度器 | `current`（order 6，update+draw）、`ecosystem`（order 12，update+draw） |
| 水母循环 | 在 `Jellyfish.update` 前用 `current.sample()` 给 `j.vx/j.vy` 加力（dtScale 缩放） |
| HUD | 新增 `current-btn`（🌊），`toggleCurrent / isCurrentMode`；`body.current-mode` 切十字光标 |
| 交互 | `interact` 新增 `onDrag(x,y,dx,dy)` + `moved` 标记（拖拽抑制误触 tap） |
| 文案 | `locales.js` 增 `btn.current` / `eco.bigfish`（中英） |
| HTML/CSS | 加 `#current-btn`；`.hint.current` 与 `body.current-mode #ocean-canvas` 样式 |

---

## 4. 验证

- `node --check` 全部新增/修改 JS。
- 无头 Chromium（playwright）端到端：加载页面、开启洋流模式拖拽、关闭、确认控制台零 JS 报错。
- 线上 Pages 复测。

---

## 5. 不做（守住范围）

- 不加失败/血量/计时（保持禅意）。
- 阶段五不加新成就（避免范围蔓延；成就在阶段六统一设计）。
- 大鱼仅 1 只、环境流极轻，控制性能预算。
