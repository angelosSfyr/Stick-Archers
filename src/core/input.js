// Controllers (only LT = buttons[6] and RT = buttons[7] are used)
// Each pad also produces gestures: 'tapL' / 'tapR' (quick press of one trigger,
// fired on release) and 'hold' (both triggers held for HOLD_TIME).
import { HOLD_TIME, TRIGGER_PRESS, TRIGGER_RELEASE } from '../config.js';
import { unlockAudio } from '../audio/synth.js';

export const pads = new Map(); // gamepad index -> { lt, rt, ltPrev, rtPrev, g, ev }
const NO_PAD = { lt: false, rt: false, ltPrev: false, rtPrev: false, g: { holdT: 0 }, ev: [] };

function triggerValue(gp, i) {
  const b = gp.buttons[i];
  if (!b) return 0;
  return Math.max(b.value || 0, b.pressed ? 1 : 0);
}

function gestures(p, dt) {
  const g = p.g, ev = [];
  if (p.lt && !p.ltPrev) g.comboL = false;
  if (p.rt && !p.rtPrev) g.comboR = false;
  if (p.lt && p.rt) {
    g.comboL = g.comboR = true;
    if (!g.fired) {
      g.holdT += dt;
      if (g.holdT >= HOLD_TIME) { g.fired = true; g.holdT = 0; ev.push('hold'); }
    }
  } else {
    g.holdT = 0;
    g.fired = false;
  }
  if (!p.lt && p.ltPrev && !g.comboL) ev.push('tapL');
  if (!p.rt && p.rtPrev && !g.comboR) ev.push('tapR');
  return ev;
}

// Ignore whatever this pad is pressing right now (used when the screen changes).
export function consumePad(p) {
  p.g.comboL = p.g.comboR = true;
  p.g.fired = p.lt && p.rt;
  p.g.holdT = 0;
  p.ev = [];
}
export const consumeAll = () => { for (const p of pads.values()) consumePad(p); };

// The keyboard is one more controller (pad 'kb'): A or Left = LT, D or Right = RT.
// It shows up once one of those keys is pressed.
const KEYS_LT = ['KeyA', 'ArrowLeft'], KEYS_RT = ['KeyD', 'ArrowRight'];
const keysDown = new Set();
let keyboardUsed = false;
addEventListener('keydown', e => {
  if (!KEYS_LT.includes(e.code) && !KEYS_RT.includes(e.code)) return;
  keysDown.add(e.code);
  keyboardUsed = true;
  e.preventDefault();
});
addEventListener('keyup', e => keysDown.delete(e.code));
addEventListener('blur', () => keysDown.clear());

function readPad(key, lt, rt, dt) {
  let p = pads.get(key);
  if (!p) {
    p = { lt: false, rt: false, ltPrev: false, rtPrev: false, ev: [],
          g: { comboL: false, comboR: false, holdT: 0, fired: false } };
    pads.set(key, p);
  }
  p.ltPrev = p.lt;
  p.rtPrev = p.rt;
  p.lt = p.lt ? lt > TRIGGER_RELEASE : lt > TRIGGER_PRESS;
  p.rt = p.rt ? rt > TRIGGER_RELEASE : rt > TRIGGER_PRESS;
  p.ev = gestures(p, dt);
  if ((p.lt && !p.ltPrev) || (p.rt && !p.rtPrev)) unlockAudio();   // works where the browser allows it
}

export function pollPads(dt) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  const seen = new Set();
  for (const gp of list) {
    if (!gp || !gp.connected) continue;
    seen.add(gp.index);
    readPad(gp.index, triggerValue(gp, 6), triggerValue(gp, 7), dt);
  }
  if (keyboardUsed) {
    seen.add('kb');
    readPad('kb', KEYS_LT.some(k => keysDown.has(k)) ? 1 : 0, KEYS_RT.some(k => keysDown.has(k)) ? 1 : 0, dt);
  }
  for (const idx of [...pads.keys()]) if (!seen.has(idx)) pads.delete(idx);
}

export const padState = idx => pads.get(idx) || NO_PAD;
export const anyPadEvent = name => [...pads.values()].some(p => p.ev.includes(name));
