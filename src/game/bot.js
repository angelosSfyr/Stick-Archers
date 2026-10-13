// Bot: presses the same LT / RT a human has. Aims by simulating its shot
// (wind and terrain included), then adds an error that shrinks every shot.
import { BOT_ERR_DECAY, BOT_MIN_ERR, BOT_START_ERR, GRAVITY, MIN_ANGLE, WIND_MAX } from '../config.js';
import { settings } from '../core/settings.js';
import { clamp, gauss, lerp, pick, rand } from '../util.js';
import { getPose } from './fighter.js';
import { M, isEnemy } from './match.js';
import { solidAt } from './terrain.js';

function simulate(f, angle, power, targetX, collide) {
  const P = getPose(f, angle, power);
  const speed = lerp(f.weapon.minSpeed, M.vmax, power);
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
  const tx = target.x, ty = target.y - 80;
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

function planShot(f) {
  const b = f.bot;
  // a fighter on the same side can't be reached, so aim across when possible
  let enemies = M.fighters.filter(e => e.alive && isEnemy(f, e) && e.side !== f.side);
  if (!enemies.length) enemies = M.fighters.filter(e => e.alive && isEnemy(f, e));
  if (!enemies.length) { b.wantAngle = 30; b.wantPower = 0.3; return; }

  // now and then, go for a power-up balloon instead
  if (settings.balloons && !f.nextShot && Math.random() < 0.2) {
    const ahead = M.balloons.filter(bl => (bl.x - f.x) * f.facing > 150);
    const bl = pick(ahead);
    if (bl && aimAt(f, { x: bl.x, y: bl.y + 80 }, rand(15, 45), 0.06)) return;
  }

  if (!b.target || !enemies.includes(b.target) || Math.random() < 0.25) {
    const t = pick(enemies);
    if (t !== b.target) {
      b.target = t;
      b.err = BOT_START_ERR;                       // new target: aim is rough again
      b.baseAngle = f.onPlatform ? rand(10, 40) : rand(25, 50);
    }
  }
  if (aimAt(f, b.target, b.baseAngle, b.err)) {
    b.err = Math.max(BOT_MIN_ERR, b.err * BOT_ERR_DECAY);
    return;
  }
  b.wantAngle = 55;
  b.wantPower = 1;
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

export function botInput(f, dt) {
  const b = f.bot, idle = { lt: false, rt: false };
  if (b.phase === 'think') {
    if ((b.timer -= dt) <= 0) { planShot(f); b.phase = 'aim'; }
    return idle;
  }
  if (b.phase === 'aim') {
    if (Math.abs(f.angle - b.wantAngle) > 1.5) return { lt: true, rt: false };
    b.phase = 'draw';
    return idle;
  }
  if (b.phase === 'draw') {
    if (f.power < b.wantPower) return { lt: false, rt: true };
    b.phase = 'done';                                // letting go of RT shoots
  }
  return idle;
}
