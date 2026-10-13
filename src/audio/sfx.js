// Sound effects. Add a sound by adding a function here, then play('name') it.
import { settings } from '../core/settings.js';
import { audio, audioReady, noise, tone } from './synth.js';

export const SFX = {
  shoot(power) {          // bow string twang + the arrow leaving
    tone({ freq: 210 + 120 * power, type: 'triangle', dur: 0.3, vol: 0.4, slideTo: 85 });
    tone({ freq: 420 + 240 * power, type: 'sawtooth', dur: 0.12, vol: 0.05, slideTo: 180 });
    noise({ dur: 0.12, vol: 0.18 + 0.12 * power, type: 'bandpass', freq: 2500, q: 0.8, slideTo: 5000 });
  },
  hit() {                 // arrow into a body
    tone({ freq: 170, dur: 0.18, vol: 0.45, slideTo: 60 });
    noise({ dur: 0.08, vol: 0.3, type: 'lowpass', freq: 700 });
  },
  headshot() {            // thud + bright "critical hit" ding
    tone({ freq: 130, dur: 0.35, vol: 0.5, slideTo: 45 });
    noise({ dur: 0.12, vol: 0.45, type: 'lowpass', freq: 1000 });
    const t = audio.ctx.currentTime;
    tone({ freq: 1568, at: t + 0.03, dur: 0.6, vol: 0.2 });
    tone({ freq: 2093, at: t + 0.12, dur: 0.8, vol: 0.18 });
    tone({ freq: 3136, at: t + 0.12, dur: 0.4, vol: 0.05 });
  },
  ground() {              // arrow into dirt or a platform
    noise({ dur: 0.14, vol: 0.3, type: 'lowpass', freq: 600 });
    tone({ freq: 120, dur: 0.1, vol: 0.18, slideTo: 70 });
  },
  start() {               // match start fanfare
    const t = audio.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'square', at: t + i * 0.12, dur: 0.22, vol: 0.09 }));
    tone({ freq: 1047, type: 'square', at: t + 0.36, dur: 0.7, vol: 0.1 });
    tone({ freq: 523, type: 'triangle', at: t + 0.36, dur: 0.7, vol: 0.2 });
    tone({ freq: 150, at: t + 0.36, dur: 0.25, vol: 0.5, slideTo: 45 });
  },
  round() {               // later rounds
    const t = audio.ctx.currentTime;
    tone({ freq: 784, type: 'triangle', at: t, dur: 0.25, vol: 0.25 });
    tone({ freq: 1047, type: 'triangle', at: t + 0.15, dur: 0.5, vol: 0.25 });
  },
  win() {                 // round over
    const t = audio.ctx.currentTime;
    [523, 659, 784, 659, 1047].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', at: t + i * 0.11, dur: i === 4 ? 0.7 : 0.18, vol: 0.25 }));
  },
  timeUp() {
    tone({ freq: 150, type: 'square', dur: 0.35, vol: 0.08 });
  },
  pop() {                 // balloon popped
    noise({ dur: 0.07, vol: 0.45, type: 'highpass', freq: 1500 });
    tone({ freq: 900, dur: 0.08, vol: 0.15, slideTo: 300 });
  },
  powerup() {
    const t = audio.ctx.currentTime;
    [659, 880, 1175].forEach((f, i) => tone({ freq: f, type: 'triangle', at: t + 0.05 + i * 0.07, dur: 0.18, vol: 0.2 }));
  },
  heal() {
    const t = audio.ctx.currentTime;
    tone({ freq: 523, at: t, dur: 0.3, vol: 0.2 });
    tone({ freq: 784, at: t + 0.1, dur: 0.45, vol: 0.2 });
  },
  boom() {                // bomb arrow
    noise({ dur: 0.8, vol: 0.7, type: 'lowpass', freq: 900, slideTo: 80 });
    tone({ freq: 95, dur: 0.6, vol: 0.6, slideTo: 30 });
  },
  block() {               // shield stops an arrow
    tone({ freq: 2200, dur: 0.18, vol: 0.12 });
    tone({ freq: 3300, dur: 0.12, vol: 0.08 });
    noise({ dur: 0.06, vol: 0.25, type: 'highpass', freq: 3000 });
  },
  fall() {                // knocked off a platform
    tone({ freq: 700, type: 'triangle', dur: 0.45, vol: 0.12, slideTo: 160 });
  },
  land() {
    noise({ dur: 0.18, vol: 0.4, type: 'lowpass', freq: 500 });
    tone({ freq: 110, dur: 0.2, vol: 0.4, slideTo: 50 });
  },
  throw(power) {          // a stone leaving the hand
    noise({ dur: 0.16, vol: 0.2 + 0.1 * power, type: 'bandpass', freq: 900, q: 0.7, slideTo: 2200 });
  },
  shieldBreak() {
    noise({ dur: 0.35, vol: 0.4, type: 'highpass', freq: 1800 });
    tone({ freq: 1400, dur: 0.4, vol: 0.12, slideTo: 300 });
  },
  ultReady() {
    const t = audio.ctx.currentTime;
    [880, 1109, 1319].forEach((f, i) => tone({ freq: f, type: 'triangle', at: t + i * 0.06, dur: 0.2, vol: 0.12 }));
  },
  ult() {                 // ultimate armed
    tone({ freq: 220, type: 'sawtooth', dur: 0.5, vol: 0.1, slideTo: 880 });
    tone({ freq: 440, type: 'triangle', dur: 0.5, vol: 0.15, slideTo: 1760 });
  },
};

export function play(name, ...args) {
  if (settings.sfx && audioReady()) SFX[name](...args);
}
