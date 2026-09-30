# Phase 9 · 自适应音频（生成式背景乐 + 事件音效）

> 目标：把「两层固定正弦 drone + 一个通用泡音」升级为有层次、有事件区分度的音频体验，且不引入版权风险、不膨胀加载。
> 决策（与用户确认）：**使用真实音频素材**（DSP 渲染的 `.wav`，非实时振荡器）+ **音乐与事件音效都做**。

## 方案

### 资源策略
- 不抓网上的 CC0 录音（版权核验 + 沙箱下载不确定性 + 膨胀 Pages），改用 **Python DSP 直接渲染成真实 `.wav` 打进仓库**。
- 全部同源加载（`fetch` + `decodeAudioData`），无 CORS 问题；单个文件失败静默降级，绝不崩游戏。
- 仓库新增 1.8MB 音频（`assets/audio/`），GitHub Pages 正常服务。

### 音乐（背景乐）
- `music_loop.wav`：16s **无缝循环**的生成式 pad —— C 大调五声音阶、缓慢呼吸式振幅、随机钟琴点缀（带卷积混响），比原两层固定正弦明显饱满、且永不重复。
- 昼夜 + 模式联动（`audio.modulate(sun, mode)` 每 500ms）：
  - 夜晚：循环速率降、低通变闷、音量略降；
  - 冒险模式：整体更低沉（速率/低通/音量下调）。

### 事件音效（9 种，各配专属签名）
`js/core/audio.js` 暴露 `sfx(name)` 分发器，`main.js` 在对应事件调用：

| 事件 | 文件 | 触发点 |
| --- | --- | --- |
| 点击/泡 | `sfx_tap` | 投喂、召唤、点水母、点秘密等通用点击 |
| 繁殖孵化 | `sfx_breed` | `breeding.onBreed` |
| 投喂 | `sfx_feed` | （预留；点击投喂已有 tap） |
| 建造放置 | `sfx_build` | `build.place` 成功 |
| 拆除退款 | `sfx_remove` | `build.remove` |
| 被叼走(冒险) | `sfx_snatch` | `ecosystem.onSnatch` |
| 纪念解锁 | `sfx_unlock` | `memory` 口令正确回调 |
| 选模式 | `sfx_mode` | `modeSelect.onPick` |
| Bogyó 蹭脸 | `sfx_nuzzle` | `interact.onHold`（长按 Bogyó）|

### 架构改动
- `js/core/audio.js` 由「实时振荡器」重写为「按需 `fetch` → `decodeAudioData` → `sfx(name)` 分发」；保留 `toggle / unlock / suspend / resume / modulate / on`，新增 `sfx`。原 `bubble()` 保留为 `tap` 别名。
- `js/main.js`：通用 `bubble()` 改为 `sfx('tap')`；在繁殖/被叼/解锁/选模式/建造放置/拆除/Bogyó 蹭脸处接对应音效；昼夜调制传入 `mode.current`。

### 顺带修复的回归
- **`.mode-select` 缺少 `.hide` 规则**：阶段八 A 引入的模式选择遮罩（全屏 `z-index:60`）在选完模式后不会真正隐藏，会一直拦截全屏点击，导致**新玩家选完模式后被卡死**（HUD 与画布都点不动）。已补 `.mode-select.hide { opacity:0; visibility:hidden; pointer-events:none }`。其余 modal 复用 `dex-modal` 类（自带 `.hide`），不受影响。

## 验证
- 本地 + 线上 Playwright 无头冒烟：页面加载零 JS 报错；开启声音后 10 个 `.wav` 全部 200；声音按钮切换正常（关闭首页 → 选模式 → 开声音）。
- `node --check` 校验 `audio.js` / `main.js` 语法通过。
- WAV 头校验：1ch / 44100Hz / 16-bit，时长符合预期。

## 改动文件
- 新增：`assets/audio/*.wav`（10 个）、`docs/PHASE9-PLAN.md`
- 修改：`js/core/audio.js`（重写）、`js/main.js`（接线）、`css/main.css`（`.mode-select.hide`）、`ROADMAP.md`
