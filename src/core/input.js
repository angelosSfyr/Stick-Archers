// Controllers and the keyboard.
// Menus only use LT / RT and their gestures: 'tapL' / 'tapR' (quick press of one trigger,
// fired on release) and 'hold' (both triggers held for HOLD_TIME).
// In a match a pad also has: moveX (-1..1, left stick or d-pad), down (stick or d-pad),
// and the face buttons, named by what they do (PS5 layout): jump ✕, block ○, potion □, ult △,
// plus up (only the pause menu uses it) and start (OPTIONS on a PS5 pad, Esc on the keyboard).
// Use `pressed(p, name)` for "just pressed this frame".
import { HOLD_TIME, STICK_DEAD, TRIGGER_PRESS, TRIGGER_RELEASE } from '../config.js';
import { unlockAudio } from '../audio/synth.js';

// standard gamepad mapping: 0 ✕, 1 ○, 2 □, 3 △, 6 LT, 7 RT, 9 start, 12-15 d-pad up / down / left / right
const FACE = { jump: 0, block: 1, potion: 2, ult: 3, start: 9 };
const BUTTONS = ['up', 'down', ...Object.keys(FACE)];

export const pads = new Map(); // gamepad index (or 'kb') -> pad state
const NO_PAD = { lt: false, rt: false, ltPrev: false, rtPrev: false, moveX: 0, btn: {}, prev: {}, g: { holdT: 0 }, ev: [] };

function buttonValue(gp, i) {
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

export const pressed = (p, name) => !!p.btn[name] && !p.prev[name];

// Ignore whatever this pad is pressing right now (used when the screen changes).
export function consumePad(p) {
  p.g.comboL = p.g.comboR = true;
  p.g.fired = p.lt && p.rt;
  p.g.holdT = 0;
  p.ev = [];
  p.prev = { ...p.btn };
}
export const consumeAll = () => { for (const p of pads.values()) consumePad(p); };

// The keyboard is one more controller (pad 'kb'). It shows up once one of its keys is pressed.
const KEYS = {
  lt: ['KeyA'], rt: ['KeyD'],
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  jump: ['KeyJ'], block: ['KeyK'], potion: ['KeyL'], ult: ['KeyI'], start: ['Escape'],
};
const ALL_KEYS = Object.values(KEYS).flat();
const keysDown = new Set();
let keyboardUsed = false;
addEventListener('keydown', e => {
  if (!ALL_KEYS.includes(e.code)) return;
  keysDown.add(e.code);
  keyboardUsed = true;
  e.preventDefault();
});
addEventListener('keyup', e => keysDown.delete(e.code));
addEventListener('blur', () => keysDown.clear());
const key = name => KEYS[name].some(k => keysDown.has(k)) ? 1 : 0;

// raw: { lt, rt (0..1), moveX (-1..1), and 0/1 for each of BUTTONS }
function readPad(id, raw, dt) {
  let p = pads.get(id);
  if (!p) {
    p = { lt: false, rt: false, ltPrev: false, rtPrev: false, moveX: 0, btn: {}, prev: {}, ev: [],
          g: { comboL: false, comboR: false, holdT: 0, fired: false } };
    pads.set(id, p);
  }
  p.ltPrev = p.lt;
  p.rtPrev = p.rt;
  p.lt = p.lt ? raw.lt > TRIGGER_RELEASE : raw.lt > TRIGGER_PRESS;
  p.rt = p.rt ? raw.rt > TRIGGER_RELEASE : raw.rt > TRIGGER_PRESS;
  p.moveX = Math.abs(raw.moveX) > STICK_DEAD ? Math.sign(raw.moveX) * Math.min(1, (Math.abs(raw.moveX) - STICK_DEAD) / (0.9 - STICK_DEAD)) : 0;
  p.prev = p.btn;
  p.btn = Object.fromEntries(BUTTONS.map(b => [b, raw[b] > 0.5]));
  p.ev = gestures(p, dt);
  if ((p.lt && !p.ltPrev) || (p.rt && !p.rtPrev) || BUTTONS.some(b => pressed(p, b))) unlockAudio();   // works where the browser allows it
}

function readGamepad(gp) {
  const sx = gp.axes[0] || 0, sy = gp.axes[1] || 0;
  const raw = {
    lt: buttonValue(gp, 6), rt: buttonValue(gp, 7),
    moveX: buttonValue(gp, 15) - buttonValue(gp, 14) || sx,
    up: Math.max(buttonValue(gp, 12), sy < -2 * STICK_DEAD ? 1 : 0),
    down: Math.max(buttonValue(gp, 13), sy > 2 * STICK_DEAD ? 1 : 0),
  };
  for (const [name, i] of Object.entries(FACE)) raw[name] = buttonValue(gp, i);
  return raw;
}

export function pollPads(dt) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  const seen = new Set();
  for (const gp of list) {
    if (!gp || !gp.connected) continue;
    seen.add(gp.index);
    readPad(gp.index, readGamepad(gp), dt);
  }
  if (keyboardUsed) {
    seen.add('kb');
    const raw = { lt: key('lt'), rt: key('rt'), moveX: key('right') - key('left') };
    for (const b of BUTTONS) raw[b] = key(b);
    readPad('kb', raw, dt);
  }
  for (const idx of [...pads.keys()]) if (!seen.has(idx)) pads.delete(idx);
}

export const padState = idx => pads.get(idx) || NO_PAD;
export const anyPadEvent = name => [...pads.values()].some(p => p.ev.includes(name));
