// ============================================================
//  WebAudio · Phase 9 真实音频（加载 .wav + 事件分发）
//  - 背景乐：assets/audio/music_loop.wav（生成式 pad，无缝循环）
//  - 事件音效：sfx_tap / breed / feed / build / remove / snatch /
//              unlock / mode / nuzzle
//  - 昼夜 + 模式联动：改变循环速率 / 低通 / 音量
//  - 全部失败静默降级，绝不让音频崩游戏
// ============================================================

import { rand } from './config.js';

// 音效名 -> 文件名（无扩展名，下面统一拼 .wav）
const SFX_FILES = {
  tap: 'sfx_tap',
  breed: 'sfx_breed',
  feed: 'sfx_feed',
  build: 'sfx_build',
  remove: 'sfx_remove',
  snatch: 'sfx_snatch',
  unlock: 'sfx_unlock',
  mode: 'sfx_mode',
  nuzzle: 'sfx_nuzzle',
  // 阶段 11B：岸上生活元素的互动音效
  seagull: 'sfx_seagull',   // 海鸥惊飞
  horn: 'sfx_horn',         // 船鸣
  splash: 'sfx_splash',     // 入水 / 跳水
};

export function createAudio(base = 'assets/audio/') {
  let ctx = null;
  let master, musicFilter, musicBus, sfxBus;
  let musicSrc = null;
  let musicBuffer = null;
  let buffers = {};        // sfx 名 -> AudioBuffer
  let loaded = false;
  let loading = null;
  let soundOn = false;
  let sun = 1;             // 1=正午 0=午夜
  let mode = 'peace';

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 2200;
    musicFilter.Q.value = 0.4;

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(musicFilter);
    musicFilter.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
  }

  /** 预加载所有音频缓冲（首次用户手势触发，失败静默） */
  function load() {
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    init();
    loading = (async () => {
      if (!ctx) { loaded = true; return; }
      const entries = [['music', base + 'music_loop.wav']]
        .concat(Object.keys(SFX_FILES).map((k) => [k, base + SFX_FILES[k] + '.wav']));
      await Promise.all(entries.map(async ([k, url]) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return;
          const ab = await r.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab);
          if (k === 'music') musicBuffer = buf;
          else buffers[k] = buf;
        } catch (e) { /* 单个文件失败不影响其余 */ }
      }));
      loaded = true;
    })();
    return loading;
  }

  function applyMusicParams() {
    if (!ctx) return;
    const night = 1 - sun;                       // 0 白天 .. 1 夜晚
    const rate = (mode === 'adventure' ? 0.92 : 1.0) * (1 - night * 0.12);
    const cutoff = Math.max(500, 2400 - night * 1100 - (mode === 'adventure' ? 300 : 0));
    const g = (mode === 'adventure' ? 0.42 : 0.5) * (0.7 + sun * 0.3);
    try {
      if (musicSrc) musicSrc.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.6);
      musicFilter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.6);
      musicBus.gain.setTargetAtTime(g, ctx.currentTime, 0.6);
    } catch (e) { /* 忽略 */ }
  }

  function startLoop() {
    if (!ctx || !musicBuffer || musicSrc || !soundOn) return;
    musicSrc = ctx.createBufferSource();
    musicSrc.buffer = musicBuffer;
    musicSrc.loop = true;
    musicSrc.connect(musicBus);
    applyMusicParams();
    try { musicSrc.start(); } catch (e) { musicSrc = null; }
  }

  function stopLoop() {
    if (!musicSrc) return;
    const s = musicSrc;
    musicSrc = null;
    try {
      s.stop(ctx.currentTime + 0.05);
    } catch (e) { /* 已停止 */ }
  }

  /** 播放一次性事件音效 */
  function sfx(name) {
    if (!ctx || !soundOn) return;
    const buf = buffers[name];
    if (!buf) return;
    try {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.connect(sfxBus);
      s.start();
    } catch (e) { /* 忽略 */ }
  }

  function toggle() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    soundOn = !soundOn;
    if (soundOn) {
      load().then(() => { if (soundOn) startLoop(); });
    } else {
      stopLoop();
    }
    return soundOn;
  }

  /** 首次手势：解锁上下文并预热缓冲（不自动放乐） */
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    load();
  }

  /** 兼容旧调用：点击泡 = tap 事件音 */
  function bubble() { sfx('tap'); }

  /** 昼夜 + 模式联动：在循环中每 500ms 调一次 */
  function modulate(s, m) {
    if (typeof s === 'number') sun = s;
    if (m) mode = m;
    applyMusicParams();
  }

  function suspend() {
    try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) { /* 忽略 */ }
  }

  function resume() {
    try { if (ctx && soundOn && ctx.state === 'suspended') ctx.resume(); } catch (e) { /* 忽略 */ }
  }

  return {
    init, unlock, toggle, bubble, sfx, modulate, suspend, resume,
    get on() { return soundOn; },
  };
}
