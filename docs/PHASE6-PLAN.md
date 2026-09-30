# 阶段六 · 繁育与成长（P1）—— 详细开发方案

> 来源：`RESEARCH-EXTENSION.md` 阶段六（4.3 基因繁殖 + 4.4 生物荧光经济 / 专长）
> 目标：把「随机变异」升级为**可经营的繁育**，并引入**生物荧光经济 + 专长**，给玩家「明天为什么还来」一个明确答案。
> 状态：✅ 已实施并推送

---

## 1. 设计原则

- **深度收集，不靠失败**：繁育是策略（选亲本、追性状），不是抽卡赌博；无耗时惩罚。
- **系统咬合**：繁育出的稀有性状 → 产出更多生物荧光 → 解锁食物/物种偏好 → 反过来帮助繁育，形成正反馈闭环。
- **向后兼容**：旧存档（无基因字段）自动迁移，不丢池塘。
- **零构建 / ES Module / Canvas**：沿用 `createX` + 调度器 `order`。

---

## 2. 模块拆分

### 2.1 `js/gameplay/genes.js` + `Jellyfish` 扩展 — 4.3 基因模型
- 新增**性状（trait）**基因：`size`（体型）、`glow`（辉光强度）、`speed`（游速）、`tentacles`（触须数）——每只水母持有 `traits = { size, glow, speed, tentacles }`（0..1 归一化 + 等级）。
- 由「配色 `paletteIndex` + 性状」共同构成个体表型。
- `Jellyfish` 构造函数支持 `opts.genes`；`_applyRestore` 支持 `g`（基因）字段；`draw()` 读取 `glow`/`size` 呈现差异。

### 2.2 `js/gameplay/breeding.js` — 4.3 繁育规则
- `tryBreed(a, b)`：两只水母距离足够近时触发结合（需双方 `scale >= 1` 成年）。
- 后代规则：配色 50/50 继承（可发生低频杂交成第三种色，概率约 12%）；每个性状取父母其一并加入 ±`mutate`（约 15% 概率产生性状突变）。
- 冷却：每只水母繁育后有冷却，避免刷屏。
- 产出：繁育成功 → `onBreed(child, { hybrid, mutatedTrait })`，供经济系统 + 成就使用。

### 2.3 `js/gameplay/economy.js` — 4.4 生物荧光经济
- 资源「生物荧光（bioluminescence）」0 起步，上限随专长提升。
- 产出：喂食、繁育、完成归巢目标、水母成年（scale→1）均按数值产出。
- 消费：解锁「发光食物（产更多光）」「物种偏好」「装饰」等。
- 持久化 `localStorage 'ocean.economy'`。

### 2.4 `js/gameplay/specialize.js` — 4.4 专长
- 三系专长（数据驱动）：`breeder`（繁育者｜繁育更快、性状更好）、`explorer`（探索者｜产出更高）、`collector`（收藏家｜图鉴/成就加成）。
- 用生物荧光点数购买专长等级；等级影响 `economy` 的产出倍率与 `breeding` 的突变概率。

### 2.5 UI
- HUD 新增 **生物荧光余额**（💠 n）与 **繁育/经济面板入口**（🧬），复用 dex/settings 的 modal 结构。
- 面板：余额、当前专长等级、可购买的解锁项（按钮）、已繁育统计。
- 图鉴卡片新增「性状」行（体型/辉光/游速/触须等级）。

---

## 3. 接入点（main.js）

| 位置 | 改动 |
| --- | --- |
| import | `genes`、`breeding`、`economy`、`specialize` |
| 实例 | `economy = createEconomy(...)`、`breeding = createBreeding({ jellyfish, onBreed })`、`speclist = createSpecialize(economy)` |
| 喂食回调 | 产出生物荧光 + 计数 |
| 调度器 | `breeding`（order 13，update 检测邻近繁育） |
| HUD | `💠` 余额刷新、`🧬` 打开繁育面板 |
| 统计 | `stats.breeds`、`stats.earned` |
| 存档 | `save.js` 序列化/恢复基因 `g`；`reset` 同步清 economy |
| 文案 | 中英双语 |

---

## 4. 验证

- `node --check` 全部新增/修改 JS。
- 无头 Chromium 端到端：加载 → 触发繁育（脚本注入两只成年水母靠近）→ 打开面板 → 断言 `ocean.economy` / 基因字段写入 → 零 JS 报错。
- 线上 Pages 复测。

---

## 5. 不做（守住范围）

- 不加失败/体力惩罚。
- 不做跨用户交易（静态站无后端）。
- 专长先各 3 级，避免一次铺太大。
