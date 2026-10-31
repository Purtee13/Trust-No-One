"use client";
// Sound effects synthesized with the Web Audio API (no audio files needed).
// Browsers only allow sound after the first tap/click; call unlockAudio() on pointerdown.

let ctx: AudioContext | null = null;
let muted = false;
if (typeof window !== "undefined") {
  try { muted = localStorage.getItem("tno-muted") === "1"; } catch { /* storage unavailable */ }
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export const unlockAudio = () => { ac(); };
export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem("tno-muted", m ? "1" : "0"); } catch { /* ignore */ }
}

type ToneOpts = { type?: OscillatorType; vol?: number; at?: number; slideTo?: number };
function tone(freq: number, dur: number, { type = "sine", vol = 0.12, at = 0, slideTo }: ToneOpts = {}) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, { vol = 0.08, at = 0, from = 4000, to = 300 } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  type: () => tone(1400 + Math.random() * 500, 0.02, { type: "square", vol: 0.02 }),
  click: () => tone(700, 0.05, { type: "square", vol: 0.05 }),
  submit: () => { tone(520, 0.08, { type: "triangle" }); tone(880, 0.12, { type: "triangle", at: 0.08 }); },
  join: () => { tone(440, 0.1, { type: "triangle" }); tone(660, 0.15, { type: "triangle", at: 0.1 }); },
  whoosh: () => noise(0.6, { vol: 0.06, from: 300, to: 3000 }),
  tick: () => tone(1000, 0.03, { type: "square", vol: 0.04 }),
  alarm: () => {
    for (let i = 0; i < 3; i++) {
      tone(880, 0.25, { type: "sawtooth", vol: 0.06, at: i * 0.5, slideTo: 500 });
      tone(500, 0.25, { type: "sawtooth", vol: 0.06, at: i * 0.5 + 0.25, slideTo: 880 });
    }
  },
  explosion: () => { noise(1.4, { vol: 0.25, from: 1200, to: 60 }); tone(70, 1.2, { vol: 0.3, slideTo: 30 }); },
  glitch: () => {
    for (let i = 0; i < 6; i++) tone(120 + Math.random() * 900, 0.05, { type: "square", vol: 0.04, at: i * 0.06 });
    noise(0.4, { vol: 0.05, at: 0.1, from: 6000, to: 800 });
  },
  shadow: () => { tone(110, 0.9, { type: "sawtooth", vol: 0.05, slideTo: 80 }); tone(165, 0.9, { vol: 0.04, at: 0.05, slideTo: 120 }); },
  oracle: () => { tone(523, 0.4, { vol: 0.06 }); tone(784, 0.6, { vol: 0.05, at: 0.12 }); tone(1046, 0.8, { vol: 0.04, at: 0.24 }); },
  ok: () => tone(1200, 0.08, { type: "triangle", vol: 0.08 }),
  bad: () => tone(160, 0.35, { type: "sawtooth", vol: 0.1, slideTo: 90 }),
  drum: () => { tone(90, 0.5, { vol: 0.35, slideTo: 40 }); noise(0.15, { vol: 0.1, from: 2000, to: 200 }); },
  success: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, { type: "triangle", vol: 0.1, at: i * 0.12 })),
  fail: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, { type: "sawtooth", vol: 0.07, at: i * 0.15 })),
};
