// Match and rounds. `M` is the running match (null outside of one); every
// other game module reads and changes it.
import { SPEED_SCALE, GRAVITY } from '../config.js';
import { anyPadEvent, pads } from '../core/input.js';
import { settings } from '../core/settings.js';
import { play } from '../audio/sfx.js';
import { ARENAS } from '../data/arenas.js';
import { updateCamera } from '../render/camera.js';
import { slotSide } from '../screens/lobby.js';
import { pauseMatch, startPressed, updatePause } from '../screens/pause.js';
import { showScreen } from '../screens/screens.js';
import { rand } from '../util.js';
import { balloonCount, spawnBalloon, updateBalloons } from './balloons.js';
import { updateArrows, updateFires } from './combat.js';
import { controlFighter, idle } from './controls.js';
import { updateParticles } from './effects.js';
import { animateFighter, makeFighter, makeMinion } from './fighter.js';
import { makeClouds, makeStreaks, updateSky } from './sky.js';
import { makeTerrain } from './terrain.js';

export let M = null;

export function teamName(side) {
  const team = M.roster.filter(r => slotSide(r.slot) === side);
  return team.length === 1 ? team[0].name : (side === 'L' ? 'TEAM 1' : 'TEAM 2');
}

export function teamMembers(side) {
  return M.roster.filter(r => slotSide(r.slot) === side).map(r => r.name).join(' & ');
}

export const winnerName = team => M.ffa ? team : teamName(team);
export const sideName = side => M.ffa ? (side === 'L' ? 'LEFT SIDE' : 'RIGHT SIDE') : teamName(side);
export const isEnemy = (a, b) => a !== b && (M.ffa || a.team !== b.team);

// roster: [{ name, pad, slot, cls, color, isBot }], built by the lobby
export function startMatch(roster) {
  const ffa = settings.mode !== 'teams';
  M = {
    roster, D: settings.distance, ffa,
    vmax: Math.sqrt(GRAVITY * (settings.distance + 700)),
    round: 0, need: Math.floor(settings.rounds / 2) + 1,
    score: ffa ? Object.fromEntries(roster.map(r => [r.name, 0])) : { L: 0, R: 0 },
    terrain: null, fighters: [], platforms: [], arrows: [], fires: [], stuck: [], particles: [], popups: [],
    balloons: [], balloonTimer: 0, stains: [], pools: [],
    wind: 0, cloudDrift: 0, clouds: makeClouds(), streaks: makeStreaks(),
    phase: '', phaseT: 0, endT: null, roundWinner: null,
    slowmo: 0, shake: 0, banner: null, paused: null,
  };
  showScreen('match');
  startRound();
}

export function endMatch() {
  M = null;
}

function startRound() {
  M.round++;
  if (!M.terrain || ARENAS[settings.terrain].newEachRound) M.terrain = makeTerrain(settings.terrain, M.D);
  M.fighters = M.roster.map(makeFighter);
  M.platforms = M.fighters.filter(f => f.onPlatform).map(f => ({ x1: f.x - 60, x2: f.x + 60, y: f.y, look: 'plank', start: true }))
    .concat(M.terrain.ledges);
  if (!M.ffa) {
    for (const side of ['L', 'R']) for (let i = 0; i < settings.minions; i++) M.fighters.push(makeMinion(side, i, settings.minions));
  }
  M.arrows = [];
  M.fires = [];
  M.stuck = [];
  M.particles = [];
  M.popups = [];
  M.balloons = [];
  M.balloonTimer = rand(6, 10);
  M.stains = [];
  M.pools = [];
  M.wind = settings.wind ? (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 1) : 0;
  if (settings.balloons) for (let i = 0; i < balloonCount(); i++) spawnBalloon();
  M.endT = null;
  setPhase('roundIntro', 1.8);
  updateCamera(0, true);
  play(M.round === 1 ? 'start' : 'round');
}

function setPhase(phase, t = 0) {
  M.phase = phase;
  M.phaseT = t;
}

// Can this fighter act right now (the round is on and they're alive)?
export const inPlay = f => f.alive && M.phase === 'play' && M.endT === null;
const isPresent = f => f.alive && (f.isBot || pads.has(f.pad));

export function updateMatch(dt) {
  if (M.paused) { updatePause(); return; }   // the whole world stands still
  if (startPressed()) { pauseMatch(); return; }
  M.slowmo = Math.max(0, M.slowmo - dt);
  M.shake = Math.max(0, M.shake - dt);
  const wdt = M.slowmo > 0 ? dt * 0.3 : dt;   // world time: slow motion right after a kill

  updateSky(wdt);
  for (const f of M.fighters) animateFighter(f, wdt);
  for (const s of M.stuck) s.wob = Math.max(0, s.wob - wdt / 0.6);
  for (const p of M.pools) p.r = Math.min(p.max, p.r + wdt * p.max / 2.5);
  if (M.phase !== 'matchOver') updateBalloons(wdt);

  switch (M.phase) {
    case 'roundIntro':
      if ((M.phaseT -= dt) <= 0) setPhase('play');
      break;
    case 'play':
      updatePlay(dt);
      break;
    case 'roundOver':
      if ((M.phaseT -= dt) <= 0) {
        if (M.roundWinner && M.score[M.roundWinner] >= M.need) setPhase('matchOver');
        else startRound();
      }
      break;
    case 'matchOver':
      if (anyPadEvent('hold')) { showScreen('lobby'); return; }
      break;
  }

  updateArrows(wdt * SPEED_SCALE[settings.speed]);
  updateFires(wdt);
  updateParticles(wdt);
  for (const p of M.popups) p.t += wdt;
  M.popups = M.popups.filter(p => p.t < 1.4);
  if (M.banner && (M.banner.t -= dt) <= 0) M.banner = null;
  updateCamera(dt, false);
}

// Everyone plays at the same time.
function updatePlay(dt) {
  if (roundEnding(dt)) return;
  for (const f of M.fighters) {
    if (isPresent(f)) controlFighter(f, dt);
    else idle(f);
  }
}

// Once only one team (or one archer, in free-for-all) has players left (minions don't count),
// let the arrows still flying land (a last arrow can make it a draw), then end the round.
function roundEnding(dt) {
  const teamsAlive = new Set(M.fighters.filter(f => f.alive && !f.minion).map(f => f.team));
  if (teamsAlive.size >= 2) return false;
  if (M.endT === null) {
    M.endT = 0;
    for (const f of M.fighters) idle(f);
  }
  M.endT += dt;
  const settling = M.arrows.some(a => !a.owner.minion) || M.fighters.some(f => f.falling && !f.minion);
  if ((M.endT > 0.9 && !settling) || M.endT > 4) {
    M.roundWinner = teamsAlive.size ? [...teamsAlive][0] : null;
    if (M.roundWinner) M.score[M.roundWinner]++;
    setPhase('roundOver', 3.2);
    play('win');
  }
  return true;
}
