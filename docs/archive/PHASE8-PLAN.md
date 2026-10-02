# 阶段八 · 双模式（和平 / 冒险）与建造轴 — 实施计划

> 状态：**方案定稿，待实施**（8A 建造轴 → 8B 冒险轴）
> 关联文档：`RESEARCH-EXTENSION.md`（扩展方向）、`ROADMAP.md`（总体进度）
> 参考原型：**Minecraft**（创造/生存双模式 + 建造 + 程序化世界）、**Hungry Shark**（吃→长大→解锁 + 食物链风险回报）

---

## 0. 背景与目标

阶段五~七交付后，游戏已有：收集图鉴、基因繁育、生物荧光经济、洋流/生态、三海域深度、探索秘密/故事/目标。
但**玩法仍偏"观看/养成"**，缺两样东西：

1. **成长张力**：只有温柔变大，没有"做错会怎样"的反馈回路。
2. **玩家自主构建**：海域是程序解锁的，玩家是参观者而非建造者。

本阶段目标：**用"双模式"容纳两种调性，用"建造轴"补沙盒可玩性**。

- **和平模式** = 现有游戏 + 建造轴（MC 式布置）。0 压力，Bogyó 在此最自在。
- **冒险模式** = 现有游戏 + 成长张力轴（饥饿鲨式吃大解锁 + 环境风险）。中档失败，不 game over。

两条共享 90% 系统（图鉴/基因/经济/海域/探索/故事/目标），只在"建造自由"与"风险回报"上分叉。

---

## 1. 决策记录（用户拍板，2025）

| # | 决策 | 落地含义 |
| --- | --- | --- |
| 1 | 模式自选，像 MC | 新存档开始时让玩家选 和平/冒险（不选不开始） |
| 2 | 每存档独立 | `mode` 锁进存档元数据；当前单存档下"切存档=切模式"天然成立 |
| 3 | 中档失败 | 冒险里被大掠食者**叼走一只**水母，不 game over、不回退经济 |
| 4 | Bogyó 只在和平模式 | `spawnBogyo` 加 `mode !== 'peace'` 守卫，冒险模式不生成 |
| 5 | 建造两模式都有 | 预设模块布置两模式均开放；动机不同（和平为美 / 冒险为庇护） |

---

## 2. 设计原则

- **共享底子，分叉在张力**：模式不是"两套游戏"，是同一套实体在 `mode` 下启用/禁用不同行为分支。
- **建造用"预设模块"而非格子世界**：纯 Canvas 零构建架构做自由方块网格既丑又超工作量；预设模块（点槽位放置）+ 每模块"生态效果"，以 1/5 成本拿到"我的海洋和别人不同"的核心爽点。
- **风险有上限**：中档失败（丢一只）是天花板，不做成生存恐怖；Bogyó 永远在和平里安睡。
- **零破坏回归**：所有改动对现有 9 项 e2e 透明——和平模式行为须与阶段七完全一致。

---

## 3. 架构总览

```
                      ┌─────────────────────────────────────┐
                      │            createMode()              │
                      │  state: 'peace' | 'adventure'        │
                      │  mode 锁进 ocean.pond 元数据          │
                      └───────────────┬─────────────────────┘
                                      │ mode 贯穿
        ┌─────────────────────────────┼─────────────────────────────┐
        │ 和平模式（默认）              │ 冒险模式                      │
        ├─────────────────────────────┼─────────────────────────────┤
        │ 建造轴 build（8A）           │ 成长轴（8B）                  │
        │  · 珊瑚/礁石/灯塔/海草       │  · 吃浮游→长大→解锁形态        │
        │  · 点击空位放置              │  · 深海缺氧                    │
        │  · 模块生态效果              │  · BigFish 调凶（叼走一只）    │
        │  · 0 压力                    │  · 洋流过强卷离                │
        └─────────────────────────────┴─────────────────────────────┘
        共享：图鉴 collection · 基因 genes · 经济 economy · 海域 zones
              · 探索 explore · 故事 story · 目标 quests · Bogyó(仅和平)
```

---

## 4. 模块设计

### 4.1 模式管理 `js/systems/mode.js`（新）

```js
export function createMode({ onMode } = {}) {
  let mode = 'peace';
  return {
    get current() { return mode; },
    isPeace()  { return mode === 'peace'; },
    isAdventure() { return mode === 'adventure'; },
    /** 仅在新存档引导时调用；之后锁死 */
    set(m) {
      if (m !== 'peace' && m !== 'adventure') return;
      mode = m;
      if (onMode) onMode(mode);
    },
    /** 从存档元数据恢复（不触发 onMode 的"切换"语义） */
    restore(m) { if (m === 'adventure' || m === 'peace') mode = m; },
    serialize() { return mode; },
  };
}
```

### 4.2 存档元数据升级 `js/gameplay/save.js`（改）

当前 `ocean.pond` 是**纯数组**。升级为带 `mode` 的对象，并**向后兼容旧纯数组格式**：

```js
// 旧：JSON.stringify([ {x,y,p,s,...}, ... ])
// 新：JSON.stringify({ v: 2, mode: 'peace', jelly: [ ... ] })

function read() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = raw && JSON.parse(raw);
  if (Array.isArray(data)) return { v: 1, mode: 'peace', jelly: data }; // 兼容
  if (!data || !Array.isArray(data.jelly)) return null;
  return data;
}
function snapshot() {
  return { v: 2, mode: mode.current, jelly: arr.filter(j => !j.isMemory).slice(0, cap).map(serialize) };
}
function restoreParams() {
  const data = read();
  // ... data.jelly 走现有映射；mode 由 main 调 mode.restore(data.mode)
}
```

> 注意：`createSave` 需接收 `mode` 引用（或 main 在 `restorePond` 后单独 `mode.restore(data.mode)`）。推荐后者，避免 save 反向依赖 mode。

### 4.3 新存档选模式（接入 `createHome` / `coach`）

- **入口**：`home`（首页欢迎 + 池塘命名）的"开始"流程。新存档（无 `ocean.pond` 或 `hasSave()===false`）首次开始时，在命名之后插一步**选模式**卡片。
- **复用**：`coach` 的卡片样式（`coach-card` / `coach-text` / `coach-next`），新增 `coach.mode` 步骤或独立 `modeSelect` 模块。
- **已存在存档**：从 `ocean.pond.mode` 恢复，不弹选择（符合"每存档独立"）。

```js
// js/ui/modeSelect.js（新）或在 coach 内扩展
createModeSelect({ onPick: (m) => { mode.set(m); /* 继续建存档 */ } })
```

### 4.4 建造系统 `js/systems/build.js`（新，8A）

**模块类型**（预设，首个版本 4 种）：

| id | 名称 | 花费(荧光) | 效果 |
| --- | --- | --- | --- |
| `coral` | 珊瑚丛 | 30 | 提升附近水母**繁育倾向** / 吸引特定基因表达 |
| `reef` | 礁石 | 50 | 冒险模式**庇护所**：靠近的水母不被 scare / 不被叼走 |
| `beacon` | 灯塔 | 80 | 全局**荧光产出 +15%**（乘进 `economy.gain`） |
| `kelp` | 海草带 | 40 | **削弱局部洋流**（jellyfish 循环里 `current.sample` 乘 1−kelpFactor） |

**状态与持久化**：

```js
// buildings 存进存档元数据（与 mode 同层）：
// { v:2, mode, buildings:[{id,x,y}], jelly:[...] }
const BUILD_MODULES = [ /* 上表 */ ];
export function createBuild({ economy, onPlaced, onError } = {}) {
  const buildings = [];                 // {id,x,y}
  function place(id, x, y) {
    const mod = BUILD_MODULES.find(m => m.id === id);
    if (!mod) return false;
    if (!economy.spend(mod.cost)) { onError?.('build.broke'); return false; }
    buildings.push({ id, x: Math.round(x), y: Math.round(y) });
    onPlaced?.(id, x, y);
    return true;
  }
  function effectOf(type) { /* 遍历 buildings 累加某类型效果，返回系数 */ }
  function draw(ctx) { /* 画珊瑚/礁石/灯塔/海草 */ }
  function reset() { buildings.length = 0; }
  return { buildings, place, remove, effectOf, draw, reset,
           get list() { return buildings; },
           serialize: () => buildings.slice(),
           restore: (arr) => { buildings.length = 0; (arr||[]).forEach(b => buildings.push(b)); } };
}
```

**效果接入点**（精确）：

| 效果 | 接入位置（main.js / 现有模块） |
| --- | --- |
| 灯塔 +15% 产出 | `economy.gain(add)` 前乘 `1 + build.effectOf('beacon')*0.15`（在 `feeding` 回调或 economy 注入 `getMultiplier` 扩展） |
| 海草削弱洋流 | `jellyfish` 循环：`const cur = current.sample(j.x,j.y,t); const f = 1 - build.effectOf('kelp', j.x,j.y)*0.6; j.vx += cur.vx*f*0.8*dtScale` |
| 珊瑚繁育倾向 | `breeding.update` 内：靠近 coral 的水母 `lastBredAt` 冷却缩短 |
| 礁石庇护 | `bigfish.js` adventure：`nearest < 150` 且目标在 reef 半径内 → 跳过 scare / 跳过"叼走" |

### 4.5 建造面板 `js/ui/buildPad.js`（新，8A）

- 复用 `dex-modal` 结构（`build-modal` / `build-close` / `build-list` / `build-item`）。
- 每个模块一行：图标（内联 SVG，沿用阶段七的字体无关方案）+ 名称 + 花费 + 已放置数。
- 选模块 → 关闭面板 → 点击海域空位 → `build.place(id,x,y)`。
- HUD 加 `#build-btn`（内联 SVG 图标，与现有 `lab-btn`/`atlas-btn` 同风格）。
- 和平/冒险都显示此按钮（决策 5）。

### 4.6 冒险成长轴（8B）

#### 4.6.1 进食长大（复用阶段五 plankton）

- 现有 `jellyfish` 不"进食"。新增：靠近 `plankton`（ecosystem 内）时 `j.scale` 朝上限增长。
- 跨阈值解锁形态：`traits.size` 已驱动 `sizeMod`（`jellyfish.js` 内 `0.85+traits.size*0.3`）；进食提升 `scale` 上限，视觉上"长大"。
- 接入：main 循环 `jellyfish` 遍历里检测最近 plankton 距离 < R → `j.feed(dtScale)`（方法加在 `Jellyfish`）。

#### 4.6.2 深海缺氧（复用阶段七 zones 深度）

- 仅在 `mode.isAdventure()`：当前海域 `zones.current` 为 `midnight`/`abyss` 时，水母累积"缺氧"。
- 新增 `oxygen` 状态（挂在 `Jellyfish` 或全局轻量数组）：`abyss` 下降快、`midnight` 慢、`shallow` 回升。
- 缺氧归零 → 水母进入 `dormant`（缓慢沉底、暂停繁育），**不消失**（治愈下限）。回到浅海回升。

#### 4.6.3 BigFish 调凶 `js/entities/bigfish.js`（改）

- 构造函数加 `mode` 字段（或 `setMode(m)`）。
- `update(dt,t,jellyArray,current)` 内分支：
  - **peace**：现有温和逻辑不变（`scare` 轻散）。
  - **adventure**：`nearest < 220` 且目标不在 reef 庇护内 → 加速逼近（max 速度 1.6→2.6），接触 `< 90` 触发**叼走一只**（调用 `onSnatch(j)`）。

```js
// bigfish.js 顶部
constructor(mode = 'peace') { ... this.mode = mode; }
// update 内 approach 分支
if (this.mode === 'adventure' && nearest < 220) {
  this.vx += (dx/d) * 0.18 * dtScale;   // 更猛
  ...
  if (nearest < 90 && !nearReef(jx, jy)) { onSnatch?.(nearestJelly); }
}
```

#### 4.6.4 中档失败（被叼走一只）

- `onSnatch(j)` 在 main 实现：从 `jellyfish` 数组移除 `j`，`save.markDirty()`，HUD toast `adventure.snatch`。
- **优先保护**：跳过 `isMemory` / `rare` / `hybrid` / 当前被玩家点选的水母；若全是特殊，则移除最近的一只普通水母。
- **不回退经济**：生物荧光、基因进度、图鉴均保留（治愈下限）。

### 4.7 Bogyó 守卫 `js/main.js`（改）

```js
function spawnBogyo(announce = true) {
  if (bogyo) return bogyo;
  if (mode.isAdventure()) return bogyo;   // 决策 4：冒险模式不出现
  ...
}
```

---

## 5. 文件改动清单

**新建**
- `js/systems/mode.js` — 模式管理
- `js/systems/build.js` — 建造系统（模块/放置/效果/持久化）
- `js/ui/buildPad.js` — 建造面板
- `js/ui/modeSelect.js` — 新存档选模式（或并入 `coach.js`）

**改动**
- `js/gameplay/save.js` — pond 升级为 `{v,mode,buildings?,jelly}` + 向后兼容
- `js/entities/bigfish.js` — `mode` 字段 + adventure 分支 + `onSnatch`
- `js/entities/jellyfish.js` — `feed(dt)` / `oxygen` / `dormant` 状态（8B）
- `js/main.js` — 接线 `mode` / `build` / `spawnBogyo` 守卫 / 进食·缺氧·叼走循环 / `restorePond` 恢复 mode+buildings
- `js/ui/home.js`（或 `coach.js`）— 新存档插"选模式"步骤
- `js/ui/hud.js` + `index.html` — `#build-btn` + 图标
- `js/ui/locales.js` — 中英双语加模式/建造/冒险文案
- `css/main.css` — 建造面板 + 模式卡片样式

**不动**：阶段五~七全部逻辑、图鉴/探索/故事/目标、经济核心、Bogyó 实体本身。

---

## 6. 接入点明细

| 接入点 | 文件:行(约) | 动作 |
| --- | --- | --- |
| `const memory = createMemory(...)` 之后 | main.js:330 | 紧邻创建 `const mode = createMode(...)`、`const build = createBuild({economy})` |
| `spawnBogyo` 内 | main.js:314 | 加 `if (mode.isAdventure()) return bogyo;` |
| jellyfish 洋流循环 | main.js（阶段五注入处） | 乘 `build.effectOf('kelp', j.x, j.y)` |
| feeding 回调产出 | main.js:130 | `economy.gain` 乘 `1 + build.effectOf('beacon')*0.15` |
| `restorePond()` 之后 | main.js:874 | 加 `mode.restore(data.mode); build.restore(data.buildings)` |
| `onReset` | main.js:144 | 加 `build.reset()`；重置后下次开始重新选模式 |
| `start()` 绑定 | main.js:863 | 加 `buildPad.bind()`、`modeSelect` 接入 home |
| `BigFish` 实例化 | ecosystem.js（阶段五） | 传 `mode.current` 并订阅 `mode` 变化（或每帧读 `mode.isAdventure()`） |
| `onSnatch` | main.js（bigfish.update 调用处） | 实现移除一只 + toast |

---

## 7. 实施顺序

**8A — 模式框架 + 和平建造轴（先交付）**
1. `mode.js` + `save.js` 元数据升级（含向后兼容）
2. 新存档选模式（`modeSelect` / `home`）
3. `build.js` + `buildPad.js` + HUD `#build-btn` + 4 种模块 + 效果接入（灯塔/海草/珊瑚/礁石）
4. 本地 + 线上 e2e：选和平→建造珊瑚→Bogyó 照常；现有 9 项全回归

**8B — 冒险成长轴（后交付）**
1. `jellyfish.feed()` / `oxygen` / `dormant`
2. `bigfish.js` adventure 分支 + `onSnatch` 中档失败
3. 深海缺氧接入 zones 深度
4. 本地 + 线上 e2e：选冒险→喂食长大→下潜缺氧→被叼走一只；现有全回归

每刀走既有流程：设计文档 → 实现 → 本地+线上 e2e 全绿 → GitHub API 推送。

---

## 8. 验证计划（e2e 清单）

**回归（须全绿，确认模式不影响和平现状）**
- 现有 9 项：`e2e_phase5` / `e2e_phase6` / `e2e_breed2` / `e2e_zone` / `e2e_phase7` / `e2e_secret` / `e2e_spec` / `e2e_memory` / `e2e_cat`

**新增**
- `e2e_mode_peace.py`：新存档选和平 → 建造珊瑚(`build.place` 成功、荧光扣减) → Bogyó 出现(`ocean.memory` 解锁后 `bogyo` 非 null) → 现有行为不变
- `e2e_mode_adventure.py`：选冒险 → 喂食 `scale` 增长 → 下潜 `abyss` 缺氧 `dormant` → BigFish 接触触发 `onSnatch` 移除一只（总数 −1、经济不回退）→ Bogyó 不出现
- `e2e_build_effects.py`：灯塔放置后 `economy.gain` 产出 +15%；海草放置后 jellyfish 洋流位移减小
- 截图：两模式海域观感对比 + 建造面板 + 被叼走 toast

---

## 9. 风险与边界

- **建造是预设模块，非格子世界**：若后续要自由方块编辑，是另一个量级工作，本次不做（已在决策 5 确认）。
- **冒险"凶"有上限**：中档失败（丢一只）即天花板，不 game over、不回退经济。
- **Bogyó 永在和平**：冒险模式即使解锁也不生成，保护其调性。
- **向后兼容**：老存档（纯数组 pond）恢复为 `mode:'peace'`，行为等同当前，零回归风险。
- **多存档未做**：当前单存档，"每存档独立"在本阶段 = mode 锁进该唯一存档元数据；多存档切换列为后续（不在本阶段范围）。

---

## 10. 文案键（locales.js，中英双语）

```
mode.peace        / mode.adventure
mode.pick         / mode.peace.desc   / mode.adventure.desc
build.title       / build.broke       / build.placed
build.coral       / build.reef        / build.beacon      / build.kelp
adventure.feed    / adventure.oxygen  / adventure.snatch  / adventure.dormant
```

---

## 11. 范围界定（本阶段不做）

- ❌ 自由方块网格建造（仅预设模块）
- ❌ 多存档切换 UI（仅 mode 锁进单存档元数据）
- ❌ 生存恐怖化（无 game over、无永久死亡）
- ❌ 改动 Bogyó 实体本身（仅加模式守卫）
- ❌ 阶段九及以后（打磨/排行等另立计划）
