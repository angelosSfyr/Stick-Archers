// Lobby: join, pick a spot, get ready
// Spot -1 is the settings gear; 0..3 are the team spots (LT / RT walk through them).
// Drawn by src/render/draw-lobby.js.
import { BOT_COLOR, COUNTDOWN, PLAYER_COLORS } from '../config.js';
import { settings } from '../core/settings.js';
import { consumePad, padState, pads } from '../core/input.js';
import { DEFAULT_CLASS } from '../data/classes.js';
import { startMatch } from '../game/match.js';
import { joinNames } from '../util.js';
import { showScreen } from './screens.js';

export const LOBBY_SLOTS = [
  { x: 220,  y: 490, name: 'TEAM 1 · 2nd', ffaName: 'LEFT · HIGH' },
  { x: 300,  y: 820, name: 'TEAM 1 · 1st', ffaName: 'LEFT · LOW' },
  { x: 1300, y: 820, name: 'TEAM 2 · 1st', ffaName: 'RIGHT · LOW' },
  { x: 1380, y: 490, name: 'TEAM 2 · 2nd', ffaName: 'RIGHT · HIGH' },
];
export const GEAR = { x: 90, y: 700 };
export const slotSide = slot => slot < 2 ? 'L' : 'R';
export const slotIsHigh = slot => slot === 0 || slot === 3;

export const humans = [];    // { num, pad, slot, ready, flash }
export let countdownT = null;

export function lobbyStatus() {
  const n = humans.length;
  const base = { canStart: false, bots: [], mode: '' };
  if (n === 0) return { ...base, msg: 'Press LT or RT on a controller (or A / D on the keyboard) to join' };

  const onGear = humans.filter(h => h.slot === -1);
  if (onGear.length) {
    const who = joinNames(onGear.map(h => 'P' + h.num));
    return { ...base, msg: `${who} ${onGear.length > 1 ? 'are' : 'is'} on Settings - hold LT + RT to open, or tap RT to step back` };
  }
  for (let s = 0; s < 4; s++) {
    const on = humans.filter(h => h.slot === s);
    if (on.length > 1) return { ...base, msg: `${joinNames(on.map(h => 'P' + h.num))} are on the same spot - move apart` };
  }

  const left = humans.filter(h => slotSide(h.slot) === 'L').length;
  const right = n - left;
  const empty = [0, 1, 2, 3].filter(s => !humans.some(h => h.slot === s));
  let bots = [], mode;
  if (settings.mode !== 'teams') {
    if (settings.mode === 'ffa-bots') bots = empty;
    else if (n < 2) return { ...base, msg: 'Free-for-all needs 2+ players - or pick "bots fill empty spots" in Settings' };
    const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
    mode = `Free-for-all · ${plural(n, 'player')}${bots.length ? ' + ' + plural(bots.length, 'bot') : ''}`;
  } else if (n === 1) { bots = [3 - humans[0].slot]; mode = '1 player vs BOT'; }
  else if (n === 2) {
    if (left === 0 || right === 0) return { ...base, msg: '1 vs 1 - stand on opposite sides' };
    mode = '1 vs 1';
  } else if (n === 3) {
    bots = empty;
    mode = '2 vs 1 + BOT';
  } else mode = '2 vs 2';

  const waiting = humans.filter(h => !h.ready);
  if (waiting.length) {
    return { canStart: false, bots, mode, msg: `Waiting for ${joinNames(waiting.map(h => 'P' + h.num))} - hold LT + RT to get ready` };
  }
  return { canStart: true, bots, mode, msg: '' };
}

function moveHuman(h, dir) {
  let s = h.slot + dir;
  // can't step onto a player who is already locked in
  while (s >= 0 && s < 4 && humans.some(o => o !== h && o.ready && o.slot === s)) s += dir;
  if (s >= -1 && s < 4) h.slot = s;
}

function toggleReady(h) {
  if (h.ready) { h.ready = false; return; }
  if (h.slot < 0 || humans.some(o => o !== h && o.slot === h.slot)) { h.flash = 0.6; return; }
  h.ready = true;
}

const freeSlot = () => [1, 2, 0, 3].find(s => !humans.some(h => h.slot === s));

export function enterLobby() {
  countdownT = null;
  for (const h of humans) {
    h.ready = false;
    if (h.slot === -1) h.slot = freeSlot() ?? -1;
  }
}

export function updateLobby(dt) {
  for (let i = humans.length - 1; i >= 0; i--) {
    if (!pads.has(humans[i].pad)) humans.splice(i, 1);
  }

  // join: any trigger on a controller that isn't playing yet
  for (const [idx, p] of pads) {
    if (humans.length >= 4) break;
    if (humans.some(h => h.pad === idx)) continue;
    if ((p.lt && !p.ltPrev) || (p.rt && !p.rtPrev)) {
      const num = [1, 2, 3, 4].find(n => !humans.some(h => h.num === n));
      humans.push({ num, pad: idx, slot: freeSlot(), ready: false, flash: 0 });
      humans.sort((a, b) => a.num - b.num);
      consumePad(p);   // the joining press is not a tap
    }
  }

  for (const h of humans) {
    h.flash = Math.max(0, h.flash - dt);
    for (const e of padState(h.pad).ev) {
      if (e === 'hold') {
        if (h.slot === -1) { showScreen('settings'); return; }
        toggleReady(h);
      } else if (!h.ready) {
        moveHuman(h, e === 'tapL' ? -1 : 1);
      }
    }
  }

  const st = lobbyStatus();
  if (!st.canStart) countdownT = null;
  else if (countdownT === null) countdownT = COUNTDOWN;
  else if ((countdownT -= dt) <= 0) {
    // everyone plays the default class until the lobby gets a class picker
    const roster = humans.map(h => ({ name: 'P' + h.num, pad: h.pad, slot: h.slot, cls: DEFAULT_CLASS,
                                      color: PLAYER_COLORS[h.num - 1], isBot: false }));
    st.bots.forEach((slot, i) =>
      roster.push({ name: i ? `BOT ${i + 1}` : 'BOT', pad: null, slot, cls: DEFAULT_CLASS, color: BOT_COLOR, isBot: true }));
    startMatch(roster);
  }
}
