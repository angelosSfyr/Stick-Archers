// Shooting, arrows in flight, and what they do when they hit something.
import { ARROW_LEN, GRAVITY, HARD_HIT_POWER, SHAKY_SHOTS, WIND_MAX } from '../config.js';
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { play } from '../audio/sfx.js';
import { nextShot } from '../data/powerups.js';
import { ARROWS } from '../data/weapons.js';
import { clamp, lerp, rand } from '../util.js';
import { popBalloon } from './balloons.js';
import { bleed, dust, sparks } from './effects.js';
import { getPose, hitZone, hurt, knock } from './fighter.js';
import { M, isEnemy } from './match.js';
import { groundY } from './terrain.js';

export function launch(f) {
  if (M.lastLaunchT !== T) { M.volley++; M.lastLaunchT = T; }   // arrows shot together share a volley
  const P = getPose(f);
  const speed = lerp(f.weapon.minSpeed, M.vmax, f.power);
  const { arrow: kind, spread } = nextShot(f);
  for (const deg of spread) {
    const a = Math.atan2(P.d.y, P.d.x) + deg * Math.PI / 180;
    M.arrows.push({ x: P.tip.x, y: P.tip.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                    owner: f, team: f.team, kind, power: f.power, spent: false,
                    volley: M.volley, t: 0, trail: [] });
  }
  play('shoot', f.power);
  f.nextShot = null;
  if (f.shaky > 0) f.shaky--;
  f.drawing = false;
  f.locked = false;
  f.power = 0;
  f.twang = 0.35;
  if (M.turns === 'all') {
    f.reload = f.weapon.reloadTime;
    if (f.bot) { f.bot.phase = 'think'; f.bot.timer = rand(0.7, 1.5); }
  }
}

// An arrow reached a fighter. Returns 'blocked' when a shield turned it away.
function hitFighter(f, zone, x, y, a) {
  const ang = Math.atan2(a.vy, a.vx);
  const kind = ARROWS[a.kind];
  if (f.shield) {
    f.shield = false;
    play('block');
    sparks(x, y, ang, 10);
    M.popups.push({ x: f.x, y: f.y - 200, text: 'BLOCKED', t: 0 });
    if (kind.blast) { explode(x, y, a.owner, f, kind.blast); a.kind = 'normal'; }
    return 'blocked';
  }
  f.stuck.push({ x: x + Math.cos(ang) * 10 - f.x, y: y + Math.sin(ang) * 10 - f.y, ang, wob: 1 });
  const instantKill = zone === 'head' && settings.headshot;
  let dmg = instantKill ? f.hp : a.owner.weapon.damage[zone];
  if (kind.damageMul && !instantKill) dmg = Math.round(dmg * kind.damageMul);
  sparks(x, y, ang, zone === 'head' ? 12 : 7);
  bleed(f, x, y, ang, zone === 'head' ? 1.6 : 1);
  play(zone === 'head' ? 'headshot' : 'hit');
  M.shake = Math.max(M.shake, zone === 'head' ? 0.35 : 0.2);
  let label = zone === 'head' ? (instantKill ? 'HEADSHOT!' : `HEADSHOT  -${dmg}`) : `${zone.toUpperCase()}  -${dmg}`;
  if (zone === 'arm' && f.hp > dmg) { f.shaky = SHAKY_SHOTS; label += '  ·  SHAKY AIM'; }
  M.popups.push({ x: f.x, y: f.y - 200, text: label, big: zone === 'head', t: 0 });
  hurt(f, dmg);
  // hard hits (heavy arrows, or shots drawn with lots of power) push the fighter back
  if (kind.alwaysKnocks || a.power >= HARD_HIT_POWER) knock(f, Math.sign(a.vx), kind.knock ?? 1);
  if (kind.blast) explode(x, y, a.owner, null, kind.blast);
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
    if (f.shield) {
      f.shield = false;
      play('block');
      M.popups.push({ x: f.x, y: f.y - 170, text: 'BLOCKED', t: 0 });
      continue;
    }
    const dmg = Math.round(lerp(blast.damage, 10, d / blast.radius));
    M.popups.push({ x: f.x, y: f.y - 170, text: `BLAST  -${dmg}`, t: 0 });
    bleed(f, f.x, f.y - 70, Math.atan2(f.y - 70 - y, f.x - x), 0.8);
    hurt(f, dmg);
    knock(f, Math.sign(f.x - x), 1.2);
  }
}

function arrowCollides(a, px, py) {
  const ang = Math.atan2(a.vy, a.vx), c = Math.cos(ang), s = Math.sin(ang);
  if (!a.spent) {
    for (const b of M.balloons) {
      if (Math.hypot(px - b.x, py - b.y) < 30) { popBalloon(b, a); break; }
    }
    for (const f of M.fighters) {
      if (!f.alive || !isEnemy(a.owner, f)) continue;   // no friendly fire in team games
      const zone = hitZone(f, px, py);
      if (!zone) continue;
      if (hitFighter(f, zone, px, py, a) === 'blocked') {
        a.spent = true;                                // bounces off the shield and drops
        a.vx *= -0.3;
        a.vy = -Math.abs(a.vy) * 0.3 - 120;
        return { bounce: true, x: px, y: py };
      }
      return { x: px, y: py };
    }
  }
  const blast = !a.spent && ARROWS[a.kind].blast;
  const gy = groundY(px);
  if (py >= gy) {
    M.stuck.push({ x: px + c * 12, y: py + s * 12, ang, wob: 1 });
    dust(px, gy, a.vx);
    if (blast) explode(px, gy, a.owner, null, blast);
    return { x: px, y: gy };
  }
  for (const p of M.platforms) {
    if (px >= p.x1 && px <= p.x2 && py >= p.y && py <= p.y + 10) {
      M.stuck.push({ x: px + c * 6, y: py + s * 6, ang, wob: 1 });
      dust(px, p.y, a.vx);
      if (blast) explode(px, p.y, a.owner, null, blast);
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
    if (hit) { M.lastImpact = hit; M.impactHold = 0.7; M.arrows.splice(i, 1); continue; }

    a.x = nx;
    a.y = ny;
    const ang = Math.atan2(a.vy, a.vx);
    a.trail.push({ x: a.x - Math.cos(ang) * ARROW_LEN, y: a.y - Math.sin(ang) * ARROW_LEN });
    if (a.trail.length > 18) a.trail.shift();
    if (a.x < -2500 || a.x > M.D + 2500 || a.y > 3000 || a.t > 15) {
      M.lastImpact = { x: clamp(a.x, -600, M.D + 600), y: Math.min(a.y, groundY(a.x)) };
      M.impactHold = 0.4;
      M.arrows.splice(i, 1);
    }
  }
  if (M.stuck.length > 200) M.stuck.splice(0, M.stuck.length - 200);
}
