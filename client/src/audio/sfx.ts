/**
 * Tiny synthesized sound effects (Web Audio API, no audio files).
 * All sounds are quiet by design; MASTER_VOLUME scales everything.
 */
const MASTER_VOLUME = 0.5;
const MUTE_KEY = "bac:sfx-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<(muted: boolean) => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable: keep in memory only */
  }
  listeners.forEach((l) => l(value));
}

export function onMutedChange(listener: (muted: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Audio context, created lazily. Browsers only allow sound after a user gesture. */
function audio(): { ac: AudioContext; out: GainNode } | null {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  if (ctx.state === "closed") return null;
  return { ac: ctx, out: master! };
}

/** Call from a user gesture so later (non-gesture) sounds such as reel ticks can play. */
export function unlockAudio() {
  if (muted) return;
  audio();
}

function noise(ac: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function tone(
  freq: number,
  dur: number,
  vol: number,
  { type = "sine", endFreq, delay = 0 }: { type?: OscillatorType; endFreq?: number; delay?: number } = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.ac.currentTime + delay;
  const osc = a.ac.createOscillator();
  const g = a.ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Roulette tick: a short, dry click as a portrait passes the payline. */
export function playReelTick() {
  const a = audio();
  if (!a) return;
  const t = a.ac.currentTime;
  const src = noise(a.ac);
  const bp = a.ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400 + Math.random() * 500;
  bp.Q.value = 6;
  const g = a.ac.createGain();
  g.gain.setValueAtTime(0.09, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  src.connect(bp).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + 0.03);
}

/** Reel lands on the rolled character: soft two-note chime. */
export function playReelStop() {
  tone(880, 0.22, 0.05, { type: "triangle" });
  tone(1318.5, 0.32, 0.045, { type: "triangle", delay: 0.07 });
}

/**
 * Punch hit: low body thump plus a short muffled smack.
 * `heavy` (knockout) is a little deeper and longer.
 */
export function playPunch(heavy = false) {
  const a = audio();
  if (!a) return;
  const t = a.ac.currentTime;

  const osc = a.ac.createOscillator();
  const og = a.ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(heavy ? 150 : 180, t);
  osc.frequency.exponentialRampToValueAtTime(heavy ? 38 : 55, t + (heavy ? 0.22 : 0.14));
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(heavy ? 0.2 : 0.15, t + 0.005);
  og.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 0.26 : 0.16));
  osc.connect(og).connect(a.out);
  osc.start(t);
  osc.stop(t + 0.3);

  const src = noise(a.ac);
  const lp = a.ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = heavy ? 1400 : 1900;
  const ng = a.ac.createGain();
  ng.gain.setValueAtTime(heavy ? 0.12 : 0.09, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  src.connect(lp).connect(ng).connect(a.out);
  src.start(t);
  src.stop(t + 0.05);
}

/** Generic UI button click. */
export function playClick() {
  tone(520, 0.05, 0.07, { type: "square", endFreq: 380 });
}

/** Choosing a category: a slightly bouncier pop. */
export function playPick() {
  tone(340, 0.11, 0.08, { type: "sine", endFreq: 760 });
  tone(1200, 0.06, 0.025, { type: "triangle", delay: 0.05 });
}

/**
 * One document-level listener: plays click / pick sounds for any button,
 * so no individual component needs changing.
 */
export function installClickSounds() {
  const handler = (e: PointerEvent) => {
    unlockAudio();
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;
    if (el.closest(".slot-plus:not(.slot-plus--inactive)")) {
      playPick();
    } else if (el.closest("button:not(:disabled), .btn, select, input[type=checkbox], [data-sfx=click]")) {
      playClick();
    }
  };
  document.addEventListener("pointerdown", handler, { capture: true });
  return () => document.removeEventListener("pointerdown", handler, { capture: true });
}
