// Bot: presses the same buttons a human has (see NO_INPUT in controls.js). Aims by
// simulating its shot (wind and terrain included), then adds an error that shrinks every shot.
// Minions use it too; they only have their stone, so they just wander and throw.
import { BOT_ERR_DECAY, BOT_MIN_ERR, BOT_START_ERR, GRAVITY, MIN_ANGLE, WIND_MAX } from '../config.js';
import { settings } from '../core/settings.js';
import { clamp, gauss, lerp, pick, rand } from '../util.js';
import { shotSpeed } from './combat.js';
import { NO_INPUT } from './controls.js';
import { getPose } from './fighter.js';
import { M, isEnemy } from './match.js';
import { groundY, solidAt, wallAhead } from './terrain.js';

const BLOCK_CHANCE = 0.55;       // how often a bot raises its shield against a shot coming its way
const CLIMB_CHANCE = 0.6;        // how often a wandering bot heads up onto a ledge instead

// Can it get onto ledge p by jumping straight up at its middle (from the ground, or from
// ledges in between)?
function canClimb(f, p) {
  const x = (p.x1 + p.x2) / 2, reach = f.cls.jumpHeight - 40;
  let y = groundY(x);
  const between = M.platforms.filter(q => x >= q.x1 && x <= q.x2 && q.y > p.y).sort((a, b) => b.y - a.y);
  for (const q of between) if (q.y < y && y - q.y <= reach) y = q.y;
  return y - p.y <= reach;
}

const standingOn = f => M.platforms.find(p => f.x >= p.x1 && f.x <= p.x2 && Math.abs(p.y - f.y) < 2) || {};
const climbable = f => M.platforms.filter(p => !p.start && Math.abs(p.y - f.y) > 2 &&
  (p.x1 + p.x2) / 2 > f.zone.x1 + 20 && (p.x1 + p.x2) / 2 < f.zone.x2 - 20 && canClimb(f, p));

// Heading for b.climb: walk under its middle and jump. Returns false once it's standing on it.
function climb(f, out) {
  const p = f.bot.climb, x = (p.x1 + p.x2) / 2;
  if (standingOn(f) === p) {
    f.bot.climb = null;
    f.bot.walkTo = f.x;
    return false;
  }
  out.move = Math.abs(x - f.x) > 10 ? Math.sign(x - f.x) : 0;
  if (!f.falling && (Math.abs(x - f.x) < 40 || wallAhead(f.x, f.y, out.move, 25))) out.jump = true;
  return true;
}

function simulate(f, angle, power, targetX, collide) {
  const P = getPose(f, angle, power);
  const speed = shotSpeed(f.weapon, power);
  let x = P.tip.x, y = P.tip.y, vx = P.d.x * speed, vy = P.d.y * speed;
  const ax = M.wind * WIND_MAX, dt = 1 / 120, dir = f.facing;
  for (let i = 0; i < 2400; i++) {
    const nx = x + vx * dt + 0.5 * ax * dt * dt;
    const ny = y + vy * dt + 0.5 * GRAVITY * dt * dt;
    vx += ax * dt;
    vy += GRAVITY * dt;
    if ((nx - targetX) * dir >= 0) return { y: lerp(y, ny, (targetX - x) / (nx - x)) };
    if (collide && (targetX - nx) * dir > 60 && solidAt(nx, ny)) return { blocked: true };
    if (ny > 4000 || vx * dir <= 0) return { short: true };
    x = nx;
    y = ny;
  }
  return { short: true };
}

function solvePower(f, target, angle) {
  const tx = target.x, ty = target.y - 80 * (target.size || 1);
  const yAt = p => { const r = simulate(f, angle, p, tx, false); return r.short ? Infinity : r.y; };
  if (yAt(1) > ty) return null;            // can't reach even at full power
  let lo = 0.04, hi = 1;
  if (yAt(lo) <= ty) return lo;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (yAt(mid) > ty) lo = mid; else hi = mid;
  }
  const p = (lo + hi) / 2;
  return simulate(f, angle, p, tx, true).blocked ? null : p;
}

// Picks the first workable angle near baseAngle, and a power with some error.
function aimAt(f, target, baseAngle, err) {
  const tries = [0, 5, -5, 10, -10, 15, 20, 25, 30, 35, 40]
    .map(d => baseAngle + d).filter(a => a >= MIN_ANGLE + 5 && a <= 80);
  for (const angle of tries) {
    const p = solvePower(f, target, angle);
    if (p !== null) {
      f.bot.wantAngle = angle;
      f.bot.wantPower = clamp(p * (1 + gauss() * err), 0.04, 1);
      return true;
    }
  }
  return false;
}

// Archers mostly go for the other players; minions go for whatever is nearest.
function pickTarget(f) {
  const enemies = M.fighters.filter(e => e.alive && isEnemy(f, e));
  if (!enemies.length) return null;
  if (f.minion) {
    const near = enemies.sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x)).slice(0, 2);
    return pick(near);
  }
  const players = enemies.filter(e => !e.minion);
  return pick(players.length && Math.random() < 0.7 ? players : enemies);
}

// Returns true when it found a shot (wantAngle / wantPower are set).
function planShot(f) {
  const b = f.bot;
  // now and then, go for a power-up balloon instead
  if (settings.balloons && !f.minion && f.weapon.takesPowerups && !f.nextShot && Math.random() < 0.2) {
    const ahead = M.balloons.filter(bl => (bl.x - f.x) * f.facing > 150);
    const bl = pick(ahead);
    if (bl && aimAt(f, { x: bl.x, y: bl.y + 80 }, rand(15, 45), 0.06)) return true;
  }
  if (!b.target || !b.target.alive || Math.random() < 0.25) {
    const t = pickTarget(f);
    if (t !== b.target) {
      b.target = t;
      b.err = BOT_START_ERR * (f.minion ? 1.6 : 1);   // new target: aim is rough again
      b.baseAngle = f.onPlatform ? rand(10, 40) : rand(25, 50);
    }
  }
  if (!b.target) return false;
  if (aimAt(f, b.target, b.baseAngle, b.err)) {
    b.err = Math.max(BOT_MIN_ERR, b.err * BOT_ERR_DECAY);
    return true;
  }
  return false;
}

// An enemy shot coming down near this fighter, from the front.
function incoming(f) {
  return M.arrows.find(a => !a.spent && isEnemy(a.owner, f) && a.vx * f.facing < 0 &&
                            Math.abs(a.x - f.x) < 320 && a.y > f.y - 600 && !f.bot.seen.has(a));
}

export function botInput(f, dt) {
  const b = f.bot, out = { ...NO_INPUT };

  // defend: raise the shield against some of the shots coming in
  if (f.shield && !f.shieldBroken) {
    const a = incoming(f);
    if (a) {
      b.seen.add(a);
      if (Math.random() < BLOCK_CHANCE) b.blockT = rand(0.5, 0.8);
    }
  }
  if (b.blockT > 0) {
    b.blockT -= dt;
    out.block = true;
    if (b.phase !== 'think') { b.phase = 'think'; b.timer = rand(0.2, 0.5); }
    return out;
  }
  if (f.potions && f.hp < f.maxHp * 0.5 && !f.cd.potion && Math.random() < dt * 0.7) out.potion = true;
  if (f.cls.ultimate && f.ult >= f.cls.ultimate.charge && !f.ultArmed && b.phase === 'think') { out.ult = true; return out; }

  if (b.phase === 'think') {
    // wander around home a little between shots, now and then up onto a ledge or back down
    if ((b.walkT -= dt) <= 0) {
      b.walkT = rand(2, 5);
      b.climb = null;
      const r = f.minion ? 60 : 160;
      b.walkTo = clamp(b.home + rand(-r, r), f.zone.x1 + 20, f.zone.x2 - 20);
      if (f.onPlatform && !standingOn(f).start && Math.random() < 0.5) { out.crouch = out.jump = true; return out; }
      if (!f.onPlatform && f.cls.jumpHeight && Math.random() < CLIMB_CHANCE) b.climb = pick(climbable(f)) || null;
    }
    if (b.climb && climb(f, out)) return out;
    if (Math.abs(b.walkTo - f.x) > 8 && !f.onPlatform) {
      out.move = Math.sign(b.walkTo - f.x);
      if (f.cls.jumpHeight && wallAhead(f.x, f.y, out.move, 25)) out.jump = true;
      return out;
    }
    if ((b.timer -= dt) > 0) return out;

    if (planShot(f)) b.phase = 'aim';
    else {
      b.target = null;
      b.timer = rand(0.4, 0.8);
    }
    return out;
  }
  if (b.phase === 'aim') {
    // sweeping the wrong way: let go of LT for a frame, the next press turns it around
    if (Math.abs(f.angle - b.wantAngle) > 1.5) out.lt = !(f.ltHeld && f.sweepDir !== Math.sign(b.wantAngle - f.angle));
    else b.phase = 'draw';
    return out;
  }
  if (b.phase === 'draw') {
    if (f.power < b.wantPower || f.cd.shot) out.rt = true;
    else b.phase = 'release';                        // letting go of RT shoots
  } else if (b.phase === 'release' && !f.drawing) {
    b.phase = 'think';                               // the shot got cancelled
  }
  return out;
}
