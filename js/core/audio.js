// ============================================================
//  WebAudio 水下环境音
//  补齐 bp/og/ng 引用，支持昼夜/深度调制
// ============================================================

import { rand } from './config.js';

export function createAudio() {
  let audioCtx = null;
  let nodes = null;
  let soundOn = false;

  function init() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* 不支持则静默降级 */ }
  }

  function start() {
    if (!audioCtx || nodes) return;

    const master = audioCtx.createGain();
    master.gain.value = 0.18;
    master.connect(audioCtx.destination);

    const o1 = audioCtx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = audioCtx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 82.5;
    const og = audioCtx.createGain();
    og.gain.value = 0.5;
    o1.connect(og); o2.connect(og);

    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(og.gain);

    const size = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer; noise.loop = true;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const ng = audioCtx.createGain();
    ng.gain.value = 0.06;
    noise.connect(bp); bp.connect(ng);

    og.connect(master);
    ng.connect(master);

    o1.start(); o2.start(); lfo.start(); noise.start();

    // 保留全部节点引用，便于后续调制
    nodes = { master, o1, o2, og, lfo, lfoGain, noise, bp, ng };
  }

  function stop() {
    if (!nodes) return;
    const n = nodes;
    nodes = null;
    try {
      n.master.gain.cancelScheduledValues(audioCtx.currentTime);
      n.master.gain.setValueAtTime(n.master.gain.value, audioCtx.currentTime);
      n.master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      setTimeout(() => {
        try { n.o1.stop(); n.o2.stop(); n.lfo.stop(); n.noise.stop(); } catch (e) { /* 已停止 */ }
      }, 600);
    } catch (e) { /* 忽略 */ }
  }

  /** 昼夜联动：入夜时低频更重、噪声更闷 */
  function modulate(sun) {
    if (!nodes || !audioCtx) return;
    const now = audioCtx.currentTime;
    const midi = 300 + (1 - sun) * 260;      // 400 -> 560 (夜)
    const q = 0.7 - (1 - sun) * 0.25;
    nodes.bp.frequency.setTargetAtTime(midi, now, 0.5);
    nodes.bp.Q.setTargetAtTime(q, now, 0.5);
    nodes.og.gain.setTargetAtTime(0.5 + (1 - sun) * 0.25, now, 0.5);
  }

  function bubble() {
    if (!audioCtx || !soundOn) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      const f = rand(600, 1200);
      o.frequency.setValueAtTime(f, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(f * 0.5, audioCtx.currentTime + 0.15);
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.2);
    } catch (e) { /* 忽略 */ }
  }

  function toggle() {
    init();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    soundOn = !soundOn;
    if (soundOn) start(); else stop();
    return soundOn;
  }

  function unlock() {
    init();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  /** 页面切后台：挂起音频上下文省电 */
  function suspend() {
    try { if (audioCtx && audioCtx.state === 'running') audioCtx.suspend(); } catch (e) { /* 忽略 */ }
  }

  /** 页面回前台：仅在音效开启时恢复 */
  function resume() {
    try {
      if (audioCtx && soundOn && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* 忽略 */ }
  }

  return {
    init, unlock, toggle, bubble, modulate, suspend, resume,
    get on() { return soundOn; },
  };
}
