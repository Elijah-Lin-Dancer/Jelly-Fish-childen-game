# 🪼 Jellyfish Ocean

An immersive, interactive jellyfish ocean built with vanilla Canvas 2D — **zero dependencies, zero build step**.

一个沉浸式交互水母海洋，纯 Canvas 2D 手写，**零依赖、零构建**。

![preview](docs/preview.png)

---

## ✨ Features / 功能

### 🌊 Immersive Scene
- **Six jellyfish species** with translucent glowing bells and 14-segment animated tentacles
- **Boids fish schools** — cohesion, separation, alignment, plus pointer avoidance
- **Sea turtle**, **distant whale silhouette** (blows bubbles), **plankton**, **seaweed**
- **Tyndall light rays**, water surface glow, depth haze for real volumetric layering
- **Procedural underwater audio** — WebAudio oscillators + band-passed white noise

### 🎮 Gameplay
| Feature | Description |
|---|---|
| **Species collection** | Collect all 6 species by tapping jellyfish. Progress saved to `localStorage`. Completing the set summons a hidden legend. |
| **Feeding** | Toggle feed mode, tap to drop glowing bait. Fish schools and jellyfish converge to feed. |
| **Day–night cycle** | 60-second loop. Sky color, ray angle and jellyfish glow all shift with the sun. Pauseable. |
| **Growth & mutation** | Long-press summons a **juvenile** that grows over time. Tap a jellyfish 5× to trigger a **color mutation**. |

### 🎨 Dual Themes
- **Sunlit Shallows** — bright cyan sunlight piercing the water (concept-art style)
- **Deep Dive** — the original dark, meditative deep-sea mood

### 🌐 Bilingual
- **English by default**, one-tap switch to 中文. Persisted to `localStorage`.

### 📱 Mobile-first
- Safe-area insets, `visualViewport` handling, debounced resize with **soft rebuild**
- Hold-progress ring, mixed-input de-duplication, iOS long-press menu suppression
- **Adaptive quality**: FPS sampling auto-downgrades rendering tiers when below 45 FPS

---

## 🚀 Run

No install, no build. Any static server works:

```bash
cd ocean
python3 -m http.server 8080
# open http://localhost:8080
```

> **Note:** ES Modules require HTTP(S). Opening `index.html` via `file://` will fail due to CORS — use a local server or GitHub Pages.

### 🌐 Live Demo / 在线预览

**https://elijah-lin-dancer.github.io/Jelly-Fish-childen-game/**

Hosted on **GitHub Pages** (built-in, no external service). Deployment is
zero-config because the project is a pure static bundle:

- **Source**: `Deploy from a branch` → `main` / `(root)`
- **Build type**: `legacy` — GitHub's internal Pages builder, **no workflow file needed**
- **Auto-sync**: every `git push origin main` re-triggers a build and republishes in ~1 minute
- `.nojekyll` is committed so Jekyll leaves `js/` and other directories untouched

To fork and run your own: push to a repo, then Settings → Pages → Source
`Deploy from a branch` → `main` / `(root)` → Save. Works as-is.

---

## 🕹️ Controls / 操作

| Action | Effect |
|---|---|
| Move pointer / finger | Attract jellyfish |
| Tap | Bubbles + ripples · collect species · drop bait (in feed mode) |
| Hold (500ms) | Summon a juvenile jellyfish |
| 🫧 | Toggle feed mode |
| 🌗 | Switch theme |
| 🕐 | Pause / resume day–night |
| 🔊 | Ambient sound |
| EN / 中 | Switch language |

---

## 📁 Structure

```
ocean/
├── index.html
├── css/
│   └── main.css              # HUD, responsive, safe-area, en/zh typography
├── js/
│   ├── main.js               # entry: wires everything, owns the objects
│   ├── core/
│   │   ├── config.js         # constants, math utils, quality tiers
│   │   ├── state.js          # single source of truth (view, theme, dayNight…)
│   │   ├── loop.js           # systems scheduler
│   │   ├── resize.js         # debounced soft-rebuild resize
│   │   └── audio.js          # WebAudio ambient + sun modulation
│   ├── entities/             # jellyfish, fish, turtle, whale, env, …
│   ├── systems/              # scenery, dayNight, feeding
│   ├── gameplay/             # collection
│   └── ui/                   # i18n, locales, hud, interact, perf
└── docs/
```

### Architecture notes

- **Systems scheduler** — every layer registers as `{ id, order, update?, draw?, entities? }`.
  Entity layers handle per-item `update → draw` with reverse-iteration recycling; layers without
  `update` (like seaweed) are treated as persistent.
- **Frame-rate independence** — all motion scales by `dt / 16.667`, so 120 Hz displays don't
  run at double speed. `dt` is clamped to 33 ms to survive tab-switch jumps.
- **Theme × day-night are orthogonal** — the theme supplies hue/saturation, the day-night cycle
  supplies brightness only. Neither multiplies the other, so night never goes pitch-black.
- **Gradient caching** — backgrounds and jellyfish glows are cached and only rebuilt when their
  key changes, avoiding per-frame `createRadialGradient` churn.

---

## 🌐 Browser support

Chrome / Edge / Safari / Firefox — anything with ES Modules and Canvas 2D.
Requires `visualViewport` for the best mobile resize behaviour (gracefully degrades).

---

## 📄 License

MIT
