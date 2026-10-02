<div align="center">

**🌐 English · [简体中文](README.zh-CN.md)**

<br />

# 🪼 Jellyfish Ocean

**🌊 A deep sea you can touch · ✨ Zero dependencies · 📦 Zero build · 📱 Mobile-first**

<sub>An immersive, interactive jellyfish ocean — pure vanilla Canvas 2D, zero dependencies, zero build</sub>

<br />

### 👉 [**🌐 Play it live — Live Demo**](https://elijah-lin-dancer.github.io/Jelly-Fish-childen-game/) 👈

[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_now-0891b2?style=for-the-badge&logo=githubpages&logoColor=white)](https://elijah-lin-dancer.github.io/Jelly-Fish-childen-game/)
[![License](https://img.shields.io/badge/License-MIT-3da639?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game/blob/main/LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game)
[![Dependencies](https://img.shields.io/badge/Dependencies-0-2ea44f?style=for-the-badge)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game)
[![Build](https://img.shields.io/badge/Build-none-9ca3af?style=for-the-badge)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game)
[![i18n](https://img.shields.io/badge/i18n-EN_%7C_中文-8b5cf6?style=for-the-badge&logo=googletranslate&logoColor=white)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game)
[![Mobile](https://img.shields.io/badge/Mobile-Ready-e11d48?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game)
[![Canvas 2D](https://img.shields.io/badge/Canvas_2D-Web_API-2ea44f?style=for-the-badge&logo=html5&logoColor=white)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game)

<br />

<a href="https://elijah-lin-dancer.github.io/Jelly-Fish-childen-game/">
  <img src="docs/shot-ingame-spawn.jpg" alt="Jellyfish Ocean — click to open the live demo" width="900" />
</a>

<sub>👆 Click the image to open the live demo · 点击上图直接进入在线体验</sub>

<br />

> 🪼 **From the beach down to the abyss** — six glowing jellyfish, schooling fish, cruising
> turtles, a distant whale, and coastal life — all **hand-written in pure Canvas 2D**,
> with no frameworks and no dependencies.
> Build a world, pick a biome, dive in and see what's hidden below.

</div>

---

## 📖 Table of Contents

- [✨ About](#-about)
- [🎬 At a Glance](#-at-a-glance)
- [🎮 Gameplay](#-gameplay)
- [🌊 Visuals](#-visuals)
- [🕹️ Controls](#️-controls)
- [⚡ Quick Start](#-quick-start)
- [🏗️ Under the Hood](#️-under-the-hood)
- [📁 Structure](#-structure)
- [🧪 Tests](#-tests)
- [📱 Mobile](#-mobile)
- [🌐 Browser Support](#-browser-support)
- [🗺️ Roadmap](#️-roadmap)
- [⭐ Show Your Support](#-show-your-support)
- [📄 License](#-license)

---

## ✨ About

> 🪼 **Jellyfish Ocean** is a deep sea you can touch. Create a world from the title screen,
> pick a biome, enter a seed, and journey from the beach down to the abyss — six glowing
> jellyfish, fish schools, turtles and whales scattered throughout. All **hand-written in
> pure Canvas 2D**, with no frameworks and no dependencies.

The whole project is a **single-page app of roughly 16,000 lines (61 ES Modules + CSS + HTML)**,
run directly in the browser as native **ES Modules** without any bundler. Give it a static
server (or GitHub Pages) and it just runs.

From a "zen sandbox" to a "game worth returning to", the project has gone through **11 phases**
of iteration — codex & save, mutation & achievements, screenshot sharing, settings & onboarding,
living sea (currents + food chain), breeding & genes, deep-dive & ocean-zone narrative, dual
modes & building, adaptive audio, an MC-style opening (title screen + 5 biomes + seeds), and
finally an open world (with coastal band). See [`docs/archive/`](docs/archive/) for each phase's
design doc.

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🎬 At a Glance

<table>
<tr>
<td width="50%">

**🏝️ Opening · MC-style world creation**
<br />
<img src="docs/shot-create.jpg" alt="Create New World" />
<sub>Pick a biome (with live thumbnail) · coastline · seed · companion jellyfish</sub>

</td>
<td width="50%">

**📖 Codex**
<br />
<img src="docs/shot-dex.jpg" alt="Codex" />
<sub>6 species, tracking first discovery / sighting count / mutation count</sub>

</td>
</tr>
<tr>
<td width="50%">

**🕹️ Bottom-right FAB · action drawer**
<br />
<img src="docs/shot-fab.jpg" alt="FAB menu" />
<sub>Feed · currents · codex · building · breeding lab · call jellyfish home</sub>

</td>
<td width="50%">

**⏸️ Pause menu**
<br />
<img src="docs/shot-pause.jpg" alt="Pause menu" />
<sub>Resume / Settings / Save & quit to title — the world truly freezes</sub>

</td>
</tr>
<tr>
<td width="50%">

**⚙️ Settings panel**
<br />
<img src="docs/shot-settings.jpg" alt="Settings" />
<sub>Quality · creature density · theme · language · reduce motion · mute</sub>

</td>
<td width="50%">

**🌊 The deep · atmosphere**
<br />
<img src="docs/shot-deep.jpg" alt="Deep sea" />
<sub>Depth fog, out-of-focus jellyfish, darkening water — heading into the abyss</sub>

</td>
</tr>
</table>

<div align="center">
<img src="docs/shot-mobile-ingame.jpg" alt="Mobile" width="200" />
<br />
<sub>📱 Mobile portrait — virtual joystick + touch interaction, the same world as desktop</sub>
</div>

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🎮 Gameplay

**🏝️ Opening & the open world**

| 🎯 Feature | 📝 Description |
| :--- | :--- |
| 🏠 **Title screen + world creation** | An MC-style opening: world name, game mode, biome (with **live thumbnail**), **coastline type**, seed code, companion jellyfish, starter kit |
| 🗺️ **5 biomes** | Coral Reef / Polar Ice Sea / Deep-sea Vent / Neon Bay / rare **Mushroom Sea** — each favors different species and water colors |
| 🏖️ **3 coastlines** | Shelter Bay (a beach running across) / Slope Shore (sweeping into the sea from the left) / Lone Island (a central isle) — orthogonal to biome, so one biome can take any coast |
| 🌱 **Seed system** | Same seed, same world — reproducible and shareable; terrain, decorations, rare biomes and companion variants are all deterministically derived from the seed |
| 🌍 **Open world** | 3200 wide and stretching from the **beach all the way to the abyss**: land → beach → shallows → reef → aphotic deep, with a freely movable camera |

**🪼 Life & growth**

| 🎯 Feature | 📝 Description |
| :--- | :--- |
| 📖 **Codex** | Click a jellyfish to collect one of 6 species; tracks first discovery / sighting count / mutation count; progress saved to `localStorage` 🏆 |
| 🧬 **Breeding & genes** | Nearby adult jellyfish breed automatically; offspring inherit 4 genes (size / glow / speed / tentacles) and may mutate |
| 🐣 **Growth & mutation** | Long-press to summon a **juvenile jellyfish** that grows over time; tap one 5 times to trigger a **color mutation** 🎨 |
| 🍤 **Feeding interaction** | Open feeding mode and click to drop glowing bait — fish schools and jellyfish **swarm over to grab it** 🌊 |

**🌊 Systems & progression**

| 🎯 Feature | 📝 Description |
| :--- | :--- |
| 🏗️ **Dual modes + building** | Choose **Peaceful / Adventure** at the start (locked into the save); the Coral Workshop lets you place coral clusters / rocks / beacon lighthouses / kelp belts |
| 🔦 **Bioluminescence economy** | Caregiving actions (feeding / breeding / completing objectives) yield bioluminescence, spent on building and unlocking the specialization tree |
| 🌊 **Currents & food chain** | Drag to inject currents that push jellyfish around; a plankton → fish → jellyfish chain, with one gentle big fish cruising through |
| 🌌 **Deep dive & story** | Three deep-sea zones (twilight / midnight / abyss) unlock as you explore; clickable secrets are scattered around, and environmental narrative fragments tie together long-term goals |
| 🏆 **Achievement loop** | 6 data-driven achievements; the HUD shows unlocked stars and pops a toast on completion |
| 🕐 **Day–night cycle** | A full day–night cycle every 60 seconds — sky color, light angle and jellyfish glow all follow the sun; pausable at any time ⏸️ |
| 📸 **Postcard sharing** | One click composites the main canvas + pond name + date into a PNG; uses the system share sheet when available, otherwise downloads |

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🌊 Visuals

### 🪼 Life & ecosystem
- 🎨 **Six jellyfish** — translucent glowing bells + gene-driven 6~11 dynamic tentacles (mutation +2), each with a unique palette and shape
- 🐠 **Boids fish schools** — cohesion / separation / alignment forces, and they actively dodge your pointer
- 🐢 **Turtles** glide past; 🐋 a **distant whale** silhouette slowly surfaces and blows bubbles; 🐟 one **gentle big fish** cruises among them
- 🦠 **Plankton** and 🌿 **kelp** form the complete lower ecosystem
- 🏖️ **Coastal life** — beaches, beacon lighthouses, seagulls, parasols and other land elements scattered across the open world
- 🐱 **Hidden memorial jellyfish Bogyó** — a passphrase-unlocked orange-and-white cat jellyfish (a personal easter egg 🥚)

### 💡 Light & atmosphere
- ☀️ **Tyndall light shafts** — volumetric sunlight piercing the surface, paired with surface glow and depth fog
- 🌌 **Midground z-lane sorting** — pseudo-3D interleaving and occlusion, with clear front/back layering
- 🔊 **Adaptive audio** — generative background music modulated by time of day / mode, with **12 events** each getting a dedicated sound effect
- 🎨 **Theme × biome × day-night, three orthogonal axes** — hue is set by theme/biome, brightness by time of day, with no interference between them

### 🎭 Five biomes
- 🪸 **Coral Reef** — warm teal-green, dotted with coral clusters
- 🧊 **Polar Ice Sea** — cold white-blue, drift ice, slower pace
- 🌋 **Deep-sea Vent** — dark red volcanic glow, oxygen drains faster
- 💠 **Neon Bay** — neon colors, bioluminescence economy ×1.25
- 🍄 **Mushroom Sea** — rare (opens with seed < 0.5%), no predators

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🕹️ Controls

| 🎮 Input | ✨ Effect |
| :--- | :--- |
| 🖱️ Move pointer / finger | 🪼 Attract jellyfish to follow |
| 👆 Tap | 🫧 Bubbles + ripples · 🪼 Collect a species · 🍤 Drop bait (in feeding mode) |
| ✊ Long-press (500ms) | 🐣 Summon a juvenile jellyfish |
| ⌨️ WASD / arrow keys | 🗺️ Move the camera to explore the open world (virtual joystick on mobile) |
| ⏸️ Esc / ⏸ button | Pause menu: Resume / Settings / Save & quit to title |
| 🫧 Feed · 🌊 Currents · 🏗️ Build | Bottom-right FAB menu: feed, currents, build workshop, breeding lab, call jellyfish home, and more |
| 📖 Codex · 🏆 Achievements · 🔦 Glow | Top bar: species codex, achievements, bioluminescence balance |
| ⚙️ Settings · 🔊 Ambience · 🌐 Language | Settings panel: quality / creature density / theme / reduce motion / mute / EN-ZH toggle |

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## ⚡ Quick Start

### 🚀 Option 1: Play right away (fastest)

👉 **[Open the live site](https://elijah-lin-dancer.github.io/Jelly-Fish-childen-game/)** — nothing to install ✨

### 💻 Option 2: Run locally

**Zero install, zero build** — any static server works:

```bash
git clone https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game.git
cd Jelly-Fish-childen-game
python3 -m http.server 8080
# then open http://localhost:8080
```

> ⚠️ **Note**: ES Modules require the HTTP(S) protocol. Opening `index.html` directly via
> `file://` will fail due to CORS — please use a local server or GitHub Pages.

### 🌐 Deploy to GitHub Pages

This project needs **zero configuration** to deploy, because it's a purely static artifact:

- 📌 **Source**: `Deploy from a branch` → `main` / `(root)`
- 🔧 **Build type**: `legacy` — GitHub's built-in builder, **no workflow file needed**
- 🔄 **Auto-sync**: every `git push origin main` rebuilds and republishes, live in about a minute
- 📄 `.nojekyll` is committed, ensuring Jekyll won't ignore directories like `js/`

<details>
<summary>🍴 Want to deploy your own copy? Expand for steps</summary>

Push to your own repo, then go to Settings → Pages → Source, choose `Deploy from a branch` → `main` / `(root)` → Save.

</details>

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🏗️ Under the Hood

**Not a single line of framework code, and not one `npm install`.** All rendering, animation, audio and physics are hand-written in the browser.

| 💡 Highlight | 📝 Description |
| :--- | :--- |
| 🎨 **Shared volumetric lighting protocol** | `render/volume.js` (624 lines) — a unified math library for light direction / glow / specular / rim light / depth light; jellyfish, fish, turtles, whales and coastal elements **all plug into the same lighting model** |
| 🧩 **System scheduler** | Each layer registers as `{ id, order, update?, draw?, entities? }`; entity layers use reverse-iteration recycling to handle per-item `update → draw`, while layers without `update` (e.g. kelp) are treated as persistent |
| ⏱️ **Frame-rate independent & steady-state** | All motion is scaled by `dt / 16.667`, so a 120Hz screen won't run at double speed; `dt` is clamped to 33ms to survive tab-switch jumps |
| 🌍 **Analytic terrain** | `systems/terrain.js` samples the seabed from noise / sine formulas — **O(1), no mesh**: `depthAt / zoneAt / shoreLineAt / homePoint` all evaluate instantly |
| 🎥 **World–screen transform** | Camera `scale = max(vw/W, vh/H) * GROW`, guaranteeing the world always fills the viewport with no black bars; bidirectional `world↔screen` conversion + visible-rect culling |
| 🎲 **Deterministic seed system** | `xfnv1a` hash + `mulberry32` PRNG — decoration scatter / rare biomes / Mushroom Sea / companion's rare violet are all derived from the seed; **same seed, guaranteed same world** |
| 💾 **Gradient caching + adaptive quality** | Backgrounds and jellyfish glow are cached by key; FPS sampled below 45 for 2s auto-downgrades, above 55 for 10s auto-upgrades |
| 🔊 **WebAudio audio layer** | Background music + 12 event sound effects; time of day / mode modulate loop rate and low-pass; **all failures degrade silently, never crashing the game** |

> 📐 **Architecture principle**: single source of truth (`core/state.js`) + layered scheduling
> (`core/loop.js`) + theme × day-night × biome orthogonality. To dig deeper, start from the
> import list in [`js/main.js`](js/main.js) — it's a map of the whole dependency tree.

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 📁 Structure

```
🌊 ocean/
├── 📄 index.html              # Single-page entry: HUD, title screen, modal containers
├── 🎨 css/
│   └── main.css               # HUD, responsive, safe areas, EN/ZH typography
├── ⚙️ js/                     # 61 ES Modules
│   ├── main.js                # Entry: wires everything together, owns each object
│   ├── memory.config.js       # Hidden memorial content text
│   ├── 🧩 core/               # config, state, loop, resize, seed, audio
│   ├── 🎨 render/             # volume (shared volumetric lighting library)
│   ├── 🪼 entities/           # jellyfish, fish, turtle, whale, bigfish,
│   │                          #   companion, bogyo, secret, env, life
│   ├── 🌊 systems/            # terrain, camera, worlds, scenery, current,
│   │                          #   ecosystem, feeding, dayNight, zones,
│   │                          #   build, mode, activity, quests
│   ├── 🎮 gameplay/           # collection, save, achievements, daily,
│   │                          #   genes, breeding, economy, specialize,
│   │                          #   explore, story, memory
│   └── 🖥️ ui/                 # home, createWorld, hud, dex, atlas, buildPad,
│                              #   lab, memoryPad, settings, share, coach,
│                              #   modeSelect, i18n, locales, interact,
│                              #   touchPad, pause, perf
├── 🖼️ docs/                   # screenshots + archive/ (completed historical design docs)
├── 🧪 tests/verify/           # Playwright end-to-end regression scripts
├── 🔈 assets/audio/           # background music + 12 event sound effects
├── 📄 README.md · README.zh-CN.md · ROADMAP.md · RESEARCH-EXTENSION.md
└── 📜 LICENSE · .nojekyll
```

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🧪 Tests

Under `tests/verify/` are four **Playwright end-to-end regression scripts**, covering the core behaviors most prone to regressions:

| 🧪 Script | 🔍 Coverage |
| :--- | :--- |
| `verify-anchoring.py` | 🏖️ Land-element anchoring — trees / lighthouses stay pinned to island surfaces after the camera moves (guards against camera-transform regressions) |
| `verify-sizes.py` | 📏 Creature size calibration — whale / big fish / turtle proportions relative to the lighthouse |
| `verify-density.py` | 🎚️ Three creature-density tiers — sparse / normal / busy spawning and persistence |
| `verify-pause.py` | ⏸️ Pause menu — true freeze, resume, settings round-trip, persist-and-continue |

```bash
# start a local server first, then run any script
python3 -m http.server 8777 &
python3 tests/verify/verify-pause.py
```

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 📱 Mobile

- 📐 **Safe-area support** — `safe-area-inset` + `visualViewport` handle notched screens and collapsing browser address bars
- 🔄 **Debounced soft rebuild** — rotation or size changes preserve scene state instead of clearing and restarting
- ✊ **Long-press progress ring** — a 500ms long-press interaction with clear visual feedback
- 🕹️ **Virtual joystick** — a bottom-left touch joystick drives the camera, composited with keyboard input
- 👆 **Hybrid input de-duplication** — supports touch and mouse at once, avoiding double-triggering
- 🚫 **iOS long-press menu suppression** — prevents the system menu from interrupting interactions
- ⚡ **Adaptive quality** — auto-downgrades render layers when sampled FPS drops below 45 (measured on mobile: 33 → 52 FPS)

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🌐 Browser Support

✅ Chrome · ✅ Edge · ✅ Safari · ✅ Firefox

Any browser supporting **ES Modules** and **Canvas 2D** can run it.
The best mobile resize behavior relies on `visualViewport` (gracefully degrades where unsupported).

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 🗺️ Roadmap

The project spans **11 phases**, growing from a "zen sandbox" into a "game worth returning to". See
[`ROADMAP.md`](ROADMAP.md) for the full phase progress and delivery checklist, and
[`docs/archive/`](docs/archive/) for each phase's original design doc.

| Phase | Theme | Status |
| :--- | :--- | :---: |
| I ~ IV | Codex / save · mutation / achievements · sharing / homing · settings / onboarding | ✅ |
| V ~ VIII | Living sea (currents + food chain) · breeding & genes · deep dive & narrative · dual modes & building | ✅ |
| IX ~ X | Adaptive audio · MC-style opening (title screen + biomes + seeds) | ✅ |
| XI | Open world (ocean-zone gradient + coastal band + camera system) | ✅ |

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## ⭐ Show Your Support

If this ocean brings you a moment of calm — 🪼

**A star ⭐ is the best encouragement!**

[![Star this repo](https://img.shields.io/github/stars/Elijah-Lin-Dancer/Jelly-Fish-childen-game?style=for-the-badge&logo=github&label=Star&color=f5a623)](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game/stargazers)

You're also welcome to [open an Issue](https://github.com/Elijah-Lin-Dancer/Jelly-Fish-childen-game/issues) with ideas or problems 💡

<div align="right"><a href="#-table-of-contents">⬆️ Back to top</a></div>

---

## 📄 License

📜 **MIT** — free to use, modify and distribute.

<div align="center">

<br />

🪼 **May you find your own calm in this ocean.** 🌊

<sub>Made with ❤️ and zero dependencies.</sub>

</div>
