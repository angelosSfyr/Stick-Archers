// Fighters: creation from a class, pose, hit zones, taking damage, movement.
import { ARROW_LEN, BOT_START_ERR, BOW_DOWN, FALL_DAMAGE, PLATFORM_BACK, PLATFORM_RISE } from '../config.js';
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { play } from '../audio/sfx.js';
import { CLASSES, DEFAULT_CLASS } from '../data/classes.js';
import { WEAPONS } from '../data/weapons.js';
import { slotIsHigh, slotSide } from '../screens/lobby.js';
import { distToSegment, lerp, rand } from '../util.js';
import { drop, dust } from './effects.js';
import { M, isActive } from './match.js';
import { groundY } from './terrain.js';

// f.side is where a fighter stands ('L' / 'R'); f.team is who they fight for:
// the side in team games, their own name in free-for-all.
export function makeFighter(r) {
  const cls = CLASSES[r.cls] || CLASSES[DEFAULT_CLASS];
  const left = slotSide(r.slot) === 'L', high = slotIsHigh(r.slot);
  const facing = left ? 1 : -1;
  const baseX = left ? 0 : M.D;
  return {
    name: r.name, pad: r.pad, color: r.color, isBot: r.isBot,
    cls, weapon: WEAPONS[cls.weapon],
    side: left ? 'L' : 'R', team: M.ffa ? r.name : (left ? 'L' : 'R'), order: high ? 1 : 0, facing,
    x: high ? baseX - facing * PLATFORM_BACK : baseX,
    y: groundY(baseX) - (high ? PLATFORM_RISE : 0),
    hp: cls.maxHp, maxHp: cls.maxHp, alive: true, deathT: 0,
    angle: BOW_DOWN, sweepDir: 1, power: 0, drawing: false, locked: false, reload: 0,
    lockL: true, lockR: true,      // triggers must be let go once at the start of a turn
    flinch: 0, twang: 0, stuck: [],
    onPlatform: high, falling: false, vx: 0, vy: 0, slideV: 0,
    shaky: 0, shield: false, nextShot: null,                // hit effects and power-ups
    bleedT: 0, bleedAt: null, pooled: false,                 // blood
    bot: r.isBot ? { phase: 'think', timer: 0, target: null, baseAngle: 30,
                     wantAngle: 30, wantPower: 0, err: BOT_START_ERR } : null,
  };
}

function aimDir(facing, angleDeg) {
  const a = angleDeg * Math.PI / 180;
  return { x: facing * Math.cos(a), y: -Math.sin(a) };
}

// After an arm hit the bow trembles, and the tremble is part of where the arrow goes.
const aimShake = f => f.shaky > 0 && f.alive ? Math.sin(T * 11) * 4 + Math.sin(T * 23.7) * 2.5 : 0;

export function getPose(f, angle = f.angle + aimShake(f), pull = f.drawing ? f.power : 0) {
  const d = aimDir(f.facing, angle);
  const x = f.x, y = f.y;
  const shoulder = { x, y: y - 95 };
  const bowHand = { x: shoulder.x + d.x * 54, y: shoulder.y + d.y * 54 };
  const back = 12 + 40 * pull;
  const drawHand = { x: bowHand.x - d.x * back, y: bowHand.y - d.y * back };
  const elbow = {
    x: lerp(shoulder.x + d.x * 20, shoulder.x - d.x * 24, pull),
    y: lerp(shoulder.y + d.y * 20 + 12, shoulder.y - d.y * 24 - 2, pull),
  };
  const tip = { x: drawHand.x + d.x * ARROW_LEN, y: drawHand.y + d.y * ARROW_LEN };
  return {
    d, shoulder, bowHand, drawHand, elbow, tip,
    head: { x, y: y - 125 }, neck: { x, y: y - 107 }, hip: { x, y: y - 52 },
    footL: { x: x - 20, y }, footR: { x: x + 20, y },
  };
}

export function hitZone(f, px, py) {
  const P = getPose(f);
  if (Math.hypot(px - P.head.x, py - P.head.y) <= 20) return 'head';
  if (distToSegment(px, py, P.neck, P.hip) <= 7) return 'torso';
  if (distToSegment(px, py, P.shoulder, P.bowHand) <= 4) return 'arm';
  if (distToSegment(px, py, P.shoulder, P.elbow) <= 4) return 'arm';
  if (distToSegment(px, py, P.elbow, P.drawHand) <= 4) return 'arm';
  if (distToSegment(px, py, P.hip, P.footL) <= 6) return 'leg';
  if (distToSegment(px, py, P.hip, P.footR) <= 6) return 'leg';
  return null;
}

export function hurt(f, dmg) {
  f.hp = Math.max(0, f.hp - dmg);
  f.flinch = 0.3;
  if (f.hp <= 0 && f.alive) {
    f.alive = false;
    f.deathT = 0;
    f.drawing = false;
    f.locked = false;
    f.power = 0;
    f.shield = false;
    M.slowmo = 0.8;
  }
}

// Fighters on a platform fall off it (and take fall damage when they land);
// fighters on the ground slide back a little.
export function knock(f, dir, strength) {
  if (f.falling) return;
  dir = dir || -f.facing;
  if (f.onPlatform) {
    f.onPlatform = false;
    f.falling = true;
    f.vx = dir * 230 * strength;
    f.vy = -260;
    M.popups.push({ x: f.x, y: f.y - 232, text: 'KNOCKED OFF!', t: 0 });
    play('fall');
  } else {
    f.slideV = dir * 160 * strength;
  }
}

export function animateFighter(f, dt) {
  if (!f.alive) f.deathT = Math.min(1, f.deathT + dt / 0.45);
  f.flinch = Math.max(0, f.flinch - dt);
  f.twang = Math.max(0, f.twang - dt);
  f.reload = Math.max(0, f.reload - dt);
  for (const s of f.stuck) s.wob = Math.max(0, s.wob - dt / 0.6);
  // after the follow-through, a player whose turn is over lowers the bow
  if (f.alive && M.turns !== 'all' && !isActive(f) && !f.locked && f.twang <= 0 && f.angle > BOW_DOWN) {
    f.angle = Math.max(BOW_DOWN, f.angle - 160 * dt);
  }

  if (f.falling) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += 1500 * dt;
    const gy = groundY(f.x);
    if (f.vy > 0 && f.y >= gy) {
      f.y = gy;
      f.falling = false;
      dust(f.x, gy, f.vx);
      play('land');
      if (f.alive) {
        M.popups.push({ x: f.x, y: f.y - 200, text: `FALL  -${FALL_DAMAGE}`, t: 0 });
        hurt(f, FALL_DAMAGE);
      }
    }
  } else if (f.slideV) {
    f.x += f.slideV * dt;
    f.slideV *= Math.exp(-10 * dt);
    if (Math.abs(f.slideV) < 5) f.slideV = 0;
    if (!f.onPlatform) f.y = groundY(f.x);
  }

  // blood: drips from the wound for a moment, and a pool once the body is down
  if (f.bleedT > 0) {
    f.bleedT -= dt;
    if (Math.random() < dt * 9) drop(f.x + f.bleedAt.x, f.y + f.bleedAt.y, rand(-25, 25), rand(-20, 30), rand(1.5, 2.8));
  }
  if (!f.alive && !f.falling && !f.pooled && f.deathT >= 1 && settings.blood) {
    f.pooled = true;
    M.pools.push({ x: f.x - f.facing * 60, y: f.y, r: 0, max: f.onPlatform ? 38 : 70 });
  }
}
