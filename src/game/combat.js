// Shooting, arrows in flight, and what they do when they hit something.
import { ARROW_LEN, FIRE, GRAVITY, HARD_HIT_POWER, SHAKY_SHOTS, WIND_MAX } from '../config.js';
import { play } from '../audio/sfx.js';
import { nextShot } from '../data/powerups.js';
import { ARROWS } from '../data/weapons.js';
import { lerp, rand } from '../util.js';
import { popBalloon } from './balloons.js';
import { bleed, dust, embers, sparks } from './effects.js';
import { getPose, hitZone, hurt, knock } from './fighter.js';
import { M, isEnemy } from './match.js';
import { groundY } from './terrain.js';

// Projectile speed for a weapon at a draw power (0..1).
export const shotSpeed = (w, power) => lerp(w.minSpeed, M.vmax * (w.maxSpeed ?? 1), power);

export function launch(f) {
  const P = getPose(f);
  const speed = shotSpeed(f.weapon, f.power);
  const { arrow: kind, spread } = nextShot(f);
  for (const deg of spread) {
    const a = Math.atan2(P.d.y, P.d.x) + deg * Math.PI / 180;
    M.arrows.push({ x: P.tip.x, y: P.tip.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                    owner: f, team: f.team, kind, power: f.power, spent: false, t: 0, trail: [] });
  }
  play(f.weapon.sound, f.power);
  if (f.weapon.takesPowerups) f.nextShot = null;
  if (f.ultArmed) { f.ultArmed = false; f.ult = 0; }
  if (f.shaky > 0) f.shaky--;
  f.drawing = false;
  f.power = 0;
  f.twang = 0.35;
  if (f.bot) { f.bot.phase = 'think'; f.bot.timer = f.minion ? rand(0.6, 1.6) : rand(0.3, 0.9); }
}

// A raised shield soaks up damage from the front. Returns the damage that gets through
// (only once the shield breaks). A burst shield burns it all up and never breaks.
// A hand lets a share through right here (hurting the fighter) and never breaks.
// A knock-out shot (`ko`) breaks any shield at once instead, but nothing gets through.
function shieldTakes(f, dmg, by, ko = false) {
  const s = f.shield;
  if (s.takes) {
    const through = Math.max(1, Math.round(ko ? f.maxHp * s.koTakes : dmg * s.takes));
    play('block');
    M.popups.push({ x: f.x, y: f.y - 200 * f.size, text: `BLOCKED  -${through}`, t: 0 });
    hurt(f, through, by);
    return 0;
  }
  if (s.burst && ko) {
    f.wardT = 0;
    f.blocking = false;
    play('shieldBreak');
    M.popups.push({ x: f.x, y: f.y - 200, text: 'WARD SMASHED', color: FIRE, big: true, t: 0 });
    return 0;
  }
  if (s.burst) {
    play('fizzle');
    M.popups.push({ x: f.x, y: f.y - 200, text: 'BURNED UP', color: FIRE, t: 0 });
    return 0;
  }
  f.shieldHp -= ko ? f.shieldHp : dmg;
  play('block');
  M.popups.push({ x: f.x, y: f.y - 200, text: 'BLOCKED', t: 0 });
  if (f.shieldHp > 0) return 0;
  const through = Math.round(-f.shieldHp);
  f.shieldHp = 0;
  f.shieldBroken = true;
  f.blocking = false;
  M.popups.push({ x: f.x, y: f.y - 232, text: 'SHIELD BROKEN', big: true, t: 0 });
  play('shieldBreak');
  return through;
}

const fromFront = (f, x) => (x - f.x) * f.facing > 0;

// An arrow reached a fighter. Returns 'blocked' when a shield or barrier turned it away,
// 'burned' when a burst shield burned it up.
function hitFighter(f, zone, x, y, a) {
  const ang = Math.atan2(a.vy, a.vx);
  const kind = ARROWS[a.kind];
  if (f.barrier) {
    f.barrier = false;
    play('block');
    sparks(x, y, ang, 10);
    M.popups.push({ x: f.x, y: f.y - 200, text: 'BLOCKED', t: 0 });
    if (kind.blast) { explode(x, y, a.owner, f, kind.blast); a.kind = 'normal'; }
    return 'blocked';
  }
  const instantKill = zone === 'head' && !kind.noInstantKill;
  const part = zone === 'shield' ? 'torso' : zone;
  let dmg = a.owner.weapon.damage[part];
  if (kind.damageMul) dmg = Math.round(dmg * kind.damageMul);
  if (f.blocking && (zone === 'shield' || a.vx * f.facing < 0)) {
    if (f.shield.burst && !kind.ko) { shieldTakes(f, dmg, a.owner); embers(x, y, 14); return 'burned'; }
    sparks(x, y, ang, 10);
    if (kind.ko) M.shake = Math.max(M.shake, 0.5);
    if (kind.blast) { explode(x, y, a.owner, f, kind.blast); a.kind = 'normal'; }
    dmg = shieldTakes(f, dmg, a.owner, kind.ko);
    if (!dmg) return 'blocked';
    if (zone === 'shield') zone = 'torso';
  } else if (instantKill || kind.ko) {
    dmg = f.hp;
  }
  if (!kind.noStick) f.stuck.push({ x: x + Math.cos(ang) * 10 - f.x, y: y + Math.sin(ang) * 10 - f.y, ang, wob: 1 });
  sparks(x, y, ang, zone === 'head' ? 12 : 7);
  bleed(f, x, y, ang, (zone === 'head' ? 1.6 : 1) * (kind.noStick ? 0.4 : 1));
  play(zone === 'head' ? 'headshot' : 'hit');
  M.shake = Math.max(M.shake, kind.ko ? 0.6 : (zone === 'head' ? 0.35 : 0.2) * (f.minion ? 0.4 : 1));
  let label = kind.ko ? 'CRUSHED!' : zone === 'head' ? (dmg >= f.hp && instantKill ? 'HEADSHOT!' : `HEADSHOT  -${dmg}`) : `${zone.toUpperCase()}  -${dmg}`;
  if (zone === 'arm' && f.hp > dmg && !f.minion) { f.shaky = SHAKY_SHOTS; label += '  ·  SHAKY AIM'; }
  M.popups.push({ x: f.x, y: f.y - 200 * f.size, text: label, big: (zone === 'head' || kind.ko) && !f.minion, t: 0 });
  hurt(f, dmg, a.owner);
  // hard hits (heavy arrows, or shots drawn with lots of power) push the fighter back
  if ((kind.knock ?? 1) > 0 && (kind.alwaysKnocks || a.power >= HARD_HIT_POWER)) knock(f, Math.sign(a.vx), kind.knock ?? 1);
  if (kind.blast) explode(x, y, a.owner, null, kind.blast);
  if (kind.burn) {
    const plat = f.onPlatform && M.platforms.find(p => f.x >= p.x1 && f.x <= p.x2 && Math.abs(p.y - f.y) < 2);
    ignite(f.x, plat ? plat.y : groundY(f.x), plat, a.owner, kind.burn);
  }
  return 'hit';
}

// Hurts every enemy of `owner` within the blast, except `spare`.
function explode(x, y, owner, spare, blast) {
  play('boom');
  M.shake = 0.6;
  M.particles.push({ kind: 'blast', x, y, vx: 0, vy: 0, t: 0, life: 0.55, r: blast.radius });
  for (let i = 0; i < 18; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(200, 420);
    M.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.2, 0.4) });
  }
  for (let i = 0; i < 12; i++) {
    M.particles.push({ kind: 'speck', x, y: y - 4, vx: rand(-220, 220), vy: -rand(200, 450), t: 0, life: rand(0.5, 0.9) });
  }
  for (const f of M.fighters) {
    if (!f.alive || f === spare || !isEnemy(owner, f)) continue;
    const d = Math.hypot(f.x - x, f.y - 70 - y);
    if (d > blast.radius) continue;
    if (f.barrier) {
      f.barrier = false;
      play('block');
      M.popups.push({ x: f.x, y: f.y - 170, text: 'BLOCKED', t: 0 });
      continue;
    }
    let dmg = Math.round(lerp(blast.damage, 10, d / blast.radius));
    if (f.blocking && fromFront(f, x) && !(dmg = shieldTakes(f, dmg, owner))) continue;
    M.popups.push({ x: f.x, y: f.y - 170, text: `BLAST  -${dmg}`, t: 0 });
    bleed(f, f.x, f.y - 70, Math.atan2(f.y - 70 - y, f.x - x), 0.8);
    hurt(f, dmg, owner);
    knock(f, Math.sign(f.x - x), 1.2);
  }
}

// Sets the ground (or a ledge, `plat`) on fire around x. Fire on a ledge stays on it.
function ignite(x, y, plat, owner, burn) {
  play('ignite', burn.radius / 90);
  const r = burn.radius;
  M.fires.push({ x1: plat ? Math.max(x - r, plat.x1) : x - r, x2: plat ? Math.min(x + r, plat.x2) : x + r,
                 y, plat: !!plat, owner, burn, t: 0 });
  embers(x, y, Math.round(burn.radius / 6));
}

// A fire patch reaches a fighter whose feet are on the same burning ground (jumping over it is safe).
const inFire = (f, fire) => f.x >= fire.x1 && f.x <= fire.x2 &&
  Math.abs(f.y - (fire.plat ? fire.y : groundY(f.x))) < 12 && (fire.plat ? f.onPlatform : !f.onPlatform);

// Fire patches burn down; enemies touching one catch fire, and burning fighters lose health.
export function updateFires(dt) {
  for (const fire of M.fires) fire.t += dt;
  M.fires = M.fires.filter(fire => fire.t < fire.burn.time);
  if (M.phase !== 'play' || M.endT !== null) return;    // once a round is decided, fire hurts nobody
  for (const f of M.fighters) {
    if (!f.alive) { f.burnT = 0; continue; }
    for (const fire of M.fires) {
      if (!isEnemy(fire.owner, f) || !inFire(f, fire)) continue;
      if (!f.burnT) M.popups.push({ x: f.x, y: f.y - 200 * f.size, text: 'ON FIRE', color: FIRE, t: 0 });
      f.burnT = Math.max(f.burnT, fire.burn.after);
      f.burn = fire.burn;
      f.burnBy = fire.owner;
    }
    if (!f.burnT) continue;
    f.burnT = Math.max(0, f.burnT - dt);
    f.burnDmg += f.burn.dps * dt;                  // whole points only, so health stays a whole number
    if (f.burnDmg >= 1) {
      const dmg = Math.floor(f.burnDmg);
      f.burnDmg -= dmg;
      hurt(f, dmg, f.burnBy);
    }
  }
}

// Big projectiles hit with their whole body: the centre first, then points around the edge.
function zoneNear(f, px, py, r) {
  let zone = hitZone(f, px, py);
  for (let i = 0; i < 8 && r && !zone; i++) zone = hitZone(f, px + Math.cos(i * Math.PI / 4) * r, py + Math.sin(i * Math.PI / 4) * r);
  return zone;
}

function arrowCollides(a, px, py) {
  const ang = Math.atan2(a.vy, a.vx), c = Math.cos(ang), s = Math.sin(ang);
  const kind = ARROWS[a.kind], r = kind.hitRadius || 0;
  if (!a.spent) {
    for (const b of M.balloons) {
      if (Math.hypot(px - b.x, py - b.y) < 30 + r) { popBalloon(b, a); break; }
    }
    for (const f of M.fighters) {
      if (!f.alive || f.gone || !isEnemy(a.owner, f)) continue;   // no friendly fire in team games
      const zone = zoneNear(f, px, py, r);
      if (!zone) continue;
      const res = hitFighter(f, zone, px, py, a);
      if (res === 'hit' && kind.crush && f.minion) continue;   // rolls right over minions
      if (res === 'burned') return { x: px, y: py };
      if (res === 'blocked') {
        a.spent = true;                                // bounces off the shield and drops
        a.vx *= -0.3;
        a.vy = -Math.abs(a.vy) * 0.3 - 120;
        return { bounce: true, x: px, y: py };
      }
      return { x: px, y: py };
    }
  }
  const blast = !a.spent && kind.blast, burn = !a.spent && kind.burn;
  const gy = groundY(px);
  if (py + r >= gy) {
    if (!kind.noStick) M.stuck.push({ x: px + c * 12, y: py + s * 12, ang, wob: 1 });
    dust(px, gy, a.vx);
    if (blast) explode(px, gy, a.owner, null, blast);
    if (burn) ignite(px, gy, null, a.owner, burn);
    return { x: px, y: gy };
  }
  for (const p of M.platforms) {
    if (px >= p.x1 && px <= p.x2 && py + r >= p.y && py + r <= p.y + 10) {
      if (!kind.noStick) M.stuck.push({ x: px + c * 6, y: py + s * 6, ang, wob: 1 });
      dust(px, p.y, a.vx);
      if (blast) explode(px, p.y, a.owner, null, blast);
      if (burn) ignite(px, p.y, p, a.owner, burn);
      return { x: px, y: py };
    }
  }
  return null;
}

export function updateArrows(dt) {
  if (dt <= 0) return;
  const ax = M.wind * WIND_MAX;
  for (let i = M.arrows.length - 1; i >= 0; i--) {
    const a = M.arrows[i];
    a.t += dt;
    const nx = a.x + a.vx * dt + 0.5 * ax * dt * dt;
    const ny = a.y + a.vy * dt + 0.5 * GRAVITY * dt * dt;
    a.vx += ax * dt;
    a.vy += GRAVITY * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - a.x, ny - a.y) / 4));
    let hit = null;
    for (let k = 1; k <= steps && !hit; k++) {
      hit = arrowCollides(a, lerp(a.x, nx, k / steps), lerp(a.y, ny, k / steps));
    }
    if (hit && hit.bounce) { a.x = hit.x; a.y = hit.y; continue; }
    if (hit) { M.arrows.splice(i, 1); continue; }

    a.x = nx;
    a.y = ny;
    const ang = Math.atan2(a.vy, a.vx);
    a.trail.push({ x: a.x - Math.cos(ang) * ARROW_LEN, y: a.y - Math.sin(ang) * ARROW_LEN });
    if (a.trail.length > 18) a.trail.shift();
    if (a.x < -2500 || a.x > M.D + 2500 || a.y > 3000 || a.t > 15) M.arrows.splice(i, 1);
  }
  if (M.stuck.length > 200) M.stuck.splice(0, M.stuck.length - 200);
}
