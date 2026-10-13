// Pause menu: START (OPTIONS on a PS5 pad, Esc on the keyboard) during a match.
// Any controller can steer it: ↑ ↓ or tap LT / RT to pick, ✕ or hold LT + RT to choose,
// START or ○ to carry on. Drawn by drawPauseMenu in src/render/draw-hud.js.
import { consumeAll, pads, pressed } from '../core/input.js';
import { M, startMatch } from '../game/match.js';
import { showScreen } from './screens.js';

export const PAUSE_ITEMS = ['CONTINUE', 'RESTART', 'QUIT'];

export const startPressed = () => [...pads.values()].some(p => pressed(p, 'start'));

export function pauseMatch() {
  M.paused = { sel: 0 };
  consumeAll();   // a trigger let go now must not count as a menu tap
}

export function updatePause() {
  const P = M.paused, n = PAUSE_ITEMS.length;
  for (const p of pads.values()) {
    if (pressed(p, 'start') || pressed(p, 'block')) return choose('CONTINUE');
    if (pressed(p, 'up') || p.ev.includes('tapL')) P.sel = (P.sel + n - 1) % n;
    if (pressed(p, 'down') || p.ev.includes('tapR')) P.sel = (P.sel + 1) % n;
    if (pressed(p, 'jump') || p.ev.includes('hold')) return choose(PAUSE_ITEMS[P.sel]);
  }
}

function choose(item) {
  if (item === 'CONTINUE') { M.paused = null; consumeAll(); }
  else if (item === 'RESTART') startMatch(M.roster);   // same players and bots, score back to 0
  else showScreen('lobby');
}
