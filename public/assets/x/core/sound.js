/* /iw-sound: every audible layer, all procedural, nothing downloaded.
 *
 * The contract:
 *   - silent by default; the visitor turns it on and the choice persists
 *   - the AudioContext is only created inside a user gesture (browsers
 *     require it), so turning sound on IS the entry gate
 *   - it suspends when the tab is hidden and never plays over other media
 *
 * Beds are scored to the page: `mood(dark)` darkens the filter as chapters
 * go to night.
 *
 *   cruise   a warm detuned Rhodes-ish pad and vinyl crackle (branding, headshots)
 *   river    moving water and a low drone (families, coastal, the front door)
 */
import * as prefs from "./prefs.js";
import { clamp, emit } from "../util.js";

let ctx = null, master = null, bedGain = null, bedFilter = null, bedNodes = [], noiseBuf = null;
let kind = "cruise", wanted = false, moodV = 0;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export const sound = {
  get on() { return wanted && !!ctx && ctx.state === "running"; },
  get wanted() { return wanted; },
  init(k) {
    kind = k || kind;
    wanted = prefs.get().sound;
    prefs.onChange(({ key }) => {
      if (key !== "sound") return;
      const w = prefs.get().sound;
      if (w !== wanted) { wanted = w; w ? start() : stop(); }
    });
    // Browsers only allow audio after a gesture. If sound was left on from a
    // previous visit, the first tap or key anywhere is the unlock.
    if (wanted) {
      const unlock = () => { start(); removeEventListener("pointerdown", unlock); removeEventListener("keydown", unlock); };
      addEventListener("pointerdown", unlock); addEventListener("keydown", unlock);
    }
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (wanted) ctx.resume();
    });
  },
  /** Call from a click handler. */
  toggle() { prefs.set("sound", wanted ? "off" : "on"); },
  play(name, opt) { if (sound.on && SFX[name]) try { SFX[name](opt || {}); } catch (e) {} },
  mood(dark) { moodV = clamp(dark); retune(); },
};

function start() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = makeNoise(ctx, 2.5);
      buildBed();
    }
    ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
    emit("sound", true);
  } catch (e) { wanted = false; }
}
function stop() {
  if (!ctx) { emit("sound", false); return; }
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  setTimeout(() => { if (!wanted && ctx) ctx.suspend(); }, 900);
  emit("sound", false);
}

function makeNoise(c, seconds, brown) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}

function buildBed() {
  bedGain = ctx.createGain(); bedGain.gain.value = 0.0;
  bedFilter = ctx.createBiquadFilter(); bedFilter.type = "lowpass"; bedFilter.Q.value = 0.6;
  bedFilter.connect(bedGain); bedGain.connect(master);
  const now = ctx.currentTime;
  if (kind === "river") {
    // Water: brown noise through a wandering bandpass, plus a quiet drone.
    const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 6, true); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoG = ctx.createGain(); lfoG.gain.value = 260;
    lfo.connect(lfoG); lfoG.connect(bp.frequency);
    src.connect(bp); bp.connect(bedFilter);
    [55, 82.4].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i ? 0.05 : 0.08;
      o.connect(g); g.connect(bedFilter); o.start(now); bedNodes.push(o);
    });
    src.start(now); lfo.start(now); bedNodes.push(src, lfo);
  } else {
    // Cruise: Fmaj9 spread, two detuned triangles per note, slow tremolo.
    [87.31, 130.81, 164.81, 220.0, 196.0].forEach((f, i) => {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = det;
        const g = ctx.createGain(); g.gain.value = 0.045 / (1 + i * 0.35);
        o.connect(g); g.connect(bedFilter); o.start(now); bedNodes.push(o);
      }
    });
    const trem = ctx.createOscillator(); trem.frequency.value = 0.21;
    const tg = ctx.createGain(); tg.gain.value = 0.012;
    trem.connect(tg); tg.connect(bedGain.gain); trem.start(now); bedNodes.push(trem);
    // Vinyl crackle: sparse clicks, high-passed.
    const cr = ctx.createBufferSource(); cr.buffer = crackle(ctx, 4); cr.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
    const cg = ctx.createGain(); cg.gain.value = 0.16;
    cr.connect(hp); hp.connect(cg); cg.connect(master); cr.start(now); bedNodes.push(cr);
  }
  bedGain.gain.setTargetAtTime(kind === "river" ? 0.5 : 0.62, now, 1.8);
  retune();
}

function crackle(c, seconds) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.004;
  return b;
}

function retune() {
  if (!ctx || !bedFilter) return;
  const base = kind === "river" ? 1500 : 1100;
  const f = base * (1 - moodV * 0.62);
  bedFilter.frequency.setTargetAtTime(Math.max(220, f), ctx.currentTime, 0.35);
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

const SFX = {
  /** A soft pentatonic tick; index picks the note so rows sound like a scale. */
  tick({ i = 0 }) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.value = 523.25 * Math.pow(2, PENTA[Math.abs(i) % PENTA.length] / 12);
    const g = ctx.createGain(); env(g, t, 0.004, 0.05, 0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
  },
  /** Paper: a filtered noise sweep, for folds, turns and curls. */
  paper({ dur = 0.35, gain = 0.12 }) {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3800, t + dur);
    const g = ctx.createGain(); env(g, t, 0.03, gain, dur);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  },
  /** Low thump, for landings and confirms. */
  thump({ gain = 0.35 }) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain(); env(g, t, 0.005, gain, 0.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
  },
  /** Hydraulic hiss. */
  hiss({ dur = 0.45 }) {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    const g = ctx.createGain(); env(g, t, 0.01, 0.14, dur);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  },
  /** Stone on water. */
  plink({ i = 0 }) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    const f = 880 * Math.pow(2, -i * 0.08);
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g = ctx.createGain(); env(g, t, 0.002, 0.09, 0.22);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
  },
  /** Two-note confirm. */
  chime() {
    const t = ctx.currentTime;
    [659.25, 987.77].forEach((f, k) => {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = ctx.createGain(); env(g, t + k * 0.09, 0.005, 0.06, 0.5);
      o.connect(g); g.connect(master); o.start(t + k * 0.09); o.stop(t + k * 0.09 + 0.6);
    });
  },
};
