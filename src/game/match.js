// Match / rounds / turns. `M` is the running match (null outside of one); every
// other game module reads and changes it.
import { BOW_DOWN, HANDOFF_TIME, SPEED_SCALE, GRAVITY } from '../config.js';
import { anyPadEvent, pads } from '../core/input.js';
import { settings, turnsFor } from '../core/settings.js';
import { play } from '../audio/sfx.js';
import { ARENAS } from '../data/arenas.js';
import { updateCamera } from '../render/camera.js';
import { slotSide } from '../screens/lobby.js';
import { showScreen } from '../screens/screens.js';
import { opp, rand } from '../util.js';
import { balloonCount, spawnBalloon, updateBalloons } from './balloons.js';
import { launch, updateArrows } from './combat.js';
import { controlShooter } from './controls.js';
import { puff, updateParticles } from './effects.js';
import { animateFighter, makeFighter } from './fighter.js';
import { makeClouds, makeStreaks, updateSky } from './sky.js';
import { groundY, makeTerrain } from './terrain.js';

export let M = null;

export const teamOf = side => M.fighters.filter(f => f.side === side);

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
    roster, D: settings.distance, ffa, turns: turnsFor(settings.mode),
    vmax: Math.sqrt(GRAVITY * (settings.distance + 700)),
    round: 0, need: Math.floor(settings.rounds / 2) + 1,
    score: ffa ? Object.fromEntries(roster.map(r => [r.name, 0])) : { L: 0, R: 0 },
    terrain: null, fighters: [], platforms: [], arrows: [], stuck: [], particles: [], popups: [],
    balloons: [], balloonTimer: 0, stains: [], pools: [],
    wind: 0, cloudDrift: 0, clouds: makeClouds(), streaks: makeStreaks(),
    phase: '', phaseT: 0, side: null, firstSide: 'L', shooters: [], turnSeq: [], turnIdx: -1,
    turnLeft: 0, handoff: null, endT: null, volley: 0, lastLaunchT: -1,
    lastImpact: null, impactHold: 0, roundWinner: null,
    slowmo: 0, shake: 0, banner: null,
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
  M.arrows = [];
  M.stuck = [];
  M.particles = [];
  M.popups = [];
  M.balloons = [];
  M.balloonTimer = rand(6, 10);
  M.stains = [];
  M.pools = [];
  M.wind = settings.wind ? (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 1) : 0;
  // free-for-all with only two archers on one side: one goes across before the round starts
  if (M.ffa && M.fighters.length === 2 && M.fighters[0].side === M.fighters[1].side) {
    moveAcross(M.fighters[0].onPlatform ? M.fighters[0] : M.fighters[1], false);
  }
  M.platforms = M.fighters.filter(f => f.onPlatform).map(f => ({ x1: f.x - 60, x2: f.x + 60, y: f.y }));
  if (settings.balloons) for (let i = 0; i < balloonCount(); i++) spawnBalloon();

  // Teams take turns starting first; turn order is 1st of the starting team,
  // 1st of the other team, 2nd of the starting team, 2nd of the other team.
  M.firstSide = M.round % 2 === 1 ? 'L' : 'R';
  const ordered = side => teamOf(side).sort((a, b) => a.order - b.order);
  const A = ordered(M.firstSide), B = ordered(opp(M.firstSide));
  M.turnSeq = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i]) M.turnSeq.push(A[i]);
    if (B[i]) M.turnSeq.push(B[i]);
  }
  M.turnIdx = -1;
  M.side = null;
  M.handoff = null;
  M.endT = null;
  M.lastImpact = null;
  M.impactHold = 0;
  if (M.turns === 'all') {
    M.shooters = M.fighters.slice();
    M.side = M.firstSide;
    for (const f of M.fighters) if (f.bot) f.bot.timer = rand(1.0, 1.8);
  } else {
    nextTurn();
  }
  setPhase('roundIntro', 1.8);
  updateCamera(0, true);
  play(M.round === 1 ? 'start' : 'round');
}

function nextTurn() {
  if (M.turns === 'team') {
    M.side = M.side === null ? M.firstSide : opp(M.side);
    M.shooters = teamOf(M.side).filter(f => f.alive);
  } else {
    for (let i = 0; i < M.turnSeq.length; i++) {
      M.turnIdx = (M.turnIdx + 1) % M.turnSeq.length;
      if (M.turnSeq[M.turnIdx].alive) break;
    }
    const f = M.turnSeq[M.turnIdx];
    M.shooters = [f];
    M.side = f.side;
  }
  for (const f of M.shooters) {
    f.drawing = false;
    f.power = 0;
    f.locked = false;
    f.lockL = f.lockR = true;
    f.angle = BOW_DOWN;            // every turn starts with the bow down: no keeping last turn's aim
    f.sweepDir = 1;
    if (f.bot) {
      f.bot.phase = 'think';
      f.bot.timer = rand(0.5, 1.1) * (settings.turnTime && settings.turnTime < 10 ? 0.5 : 1);
    }
  }
  M.turnLeft = settings.turnTime;
}

function setPhase(phase, t = 0) {
  M.phase = phase;
  M.phaseT = t;
}

export const isActive = f => f.alive && (M.phase === 'play' || M.phase === 'roundIntro') &&
                             M.handoff === null && M.endT === null && M.shooters.includes(f);
const isPresent = f => f.alive && (f.isBot || pads.has(f.pad));

export function updateMatch(dt) {
  M.slowmo = Math.max(0, M.slowmo - dt);
  M.shake = Math.max(0, M.shake - dt);
  M.impactHold = Math.max(0, M.impactHold - dt);
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
  updateParticles(wdt);
  for (const p of M.popups) p.t += wdt;
  M.popups = M.popups.filter(p => p.t < 1.4);
  if (M.banner && (M.banner.t -= dt) <= 0) M.banner = null;
  updateCamera(dt, false);
}

function updatePlay(dt) {
  if (roundEnding(dt)) return;
  if (M.ffa && !M.arrows.length) checkMoveAcross();

  if (M.turns === 'all') {
    for (const f of M.fighters) if (isPresent(f)) controlShooter(f, dt);
    return;
  }
  // A shot was just taken: the next player gets the bow almost right away,
  // even while that arrow is still in the air.
  if (M.handoff !== null) {
    if ((M.handoff -= dt) <= 0) { M.handoff = null; nextTurn(); }
    return;
  }

  if (settings.turnTime && !M.arrows.length) M.turnLeft -= dt;   // the clock waits while arrows fly
  const timeUp = settings.turnTime > 0 && M.turnLeft <= 0;
  for (const f of M.shooters) if (isPresent(f) && !f.locked) controlShooter(f, dt);
  if (M.handoff !== null) return;

  // "Whole team" turns: releasing RT locks a shot in, and the team's arrows fly
  // together once everyone is locked in (or the time runs out).
  const locked = M.shooters.filter(f => f.locked && f.alive);
  const waiting = M.shooters.filter(f => isPresent(f) && !f.locked);
  if (waiting.length && !timeUp) return;
  if (waiting.length) {
    M.banner = { text: 'TIME UP', t: 1.2 };
    play('timeUp');
  }
  for (const f of waiting) { f.drawing = false; f.power = 0; }
  for (const f of locked) launch(f);
  M.handoff = locked.length ? HANDOFF_TIME : 0.6;
}

// Once only one team (or one archer, in free-for-all) is left, let the arrows still
// flying land (a last arrow can make it a draw), then end the round.
function roundEnding(dt) {
  const teamsAlive = new Set(M.fighters.filter(f => f.alive).map(f => f.team));
  if (teamsAlive.size >= 2) return false;
  if (M.endT === null) {
    M.endT = 0;
    for (const f of M.fighters) { f.drawing = false; f.locked = false; f.power = 0; }
  }
  M.endT += dt;
  if ((M.endT > 0.9 && !M.arrows.length && !M.fighters.some(f => f.falling)) || M.endT > 4) {
    M.roundWinner = teamsAlive.size ? [...teamsAlive][0] : null;
    if (M.roundWinner) M.score[M.roundWinner]++;
    setPhase('roundOver', 3.2);
    play('win');
  }
  return true;
}

// Free-for-all: when the last two archers stand on the same side they can't reach
// each other, so one of them is moved across to the other side.
function checkMoveAcross() {
  const alive = M.fighters.filter(f => f.alive);
  if (alive.length !== 2 || alive[0].side !== alive[1].side || alive.some(f => f.falling)) return;
  const [a, b] = alive;
  moveAcross(a.y !== b.y ? (a.y < b.y ? a : b) : alive[Math.floor(Math.random() * 2)], true);
}

function moveAcross(f, animate) {
  if (animate) puff(f.x, f.y - 70);
  f.side = opp(f.side);
  f.facing = -f.facing;
  const baseX = f.side === 'L' ? 0 : M.D;
  f.x = baseX + f.facing * 60;         // just in front of anyone lying at that spot
  f.y = groundY(f.x);
  f.onPlatform = false;
  f.falling = false;
  f.drawing = false;
  f.locked = false;
  f.power = 0;
  f.angle = BOW_DOWN;
  for (const s of f.stuck) { s.x = -s.x; s.ang = Math.PI - s.ang; }   // mirror the arrows stuck in them
  if (M.shooters.includes(f)) M.side = f.side;
  if (animate) {
    puff(f.x, f.y - 70);
    M.banner = { text: `${f.name} MOVES ACROSS`, t: 1.6 };
    play('teleport');
  }
}
