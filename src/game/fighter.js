// Fighters: creation from a class, pose, hit zones, taking damage, movement.
import { ARROW_LEN, BOT_START_ERR, BOW_DOWN, EDGE_OUT, FALL_DAMAGE, FALL_GRAVITY, MID_STOP,
         PLATFORM_BACK, PLATFORM_RISE } from '../config.js';
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { play } from '../audio/sfx.js';
import { CLASSES, DEFAULT_CLASS, MINION_CLASS } from '../data/classes.js';
import { SHIELDS, WEAPONS } from '../data/weapons.js';
import { slotIsHigh, slotSide } from '../screens/lobby.js';
import { clamp, distToSegment, lerp, rand } from '../util.js';
import { drop, dust } from './effects.js';
import { M } from './match.js';
import { deathDepth, groundY, wallAhead } from './terrain.js';

// f.side is where a fighter stands ('L' / 'R'); f.team is who they fight for:
// the side in team games, their own name in free-for-all. Fighters always face the
// other side and never turn around.
function baseFighter(cls, side, x, y, extra) {
  const left = side === 'L';
  const shield = cls.shield ? SHIELDS[cls.shield] : null;
  return {
    cls, weapon: WEAPONS[cls.weapon], size: cls.size || 1, minion: !!cls.minion,
    side, team: left ? 'L' : 'R', order: 0, facing: left ? 1 : -1,
    // how far they can walk: up to the middle (never across), and a bit behind their side
    zone: left ? { x1: -EDGE_OUT, x2: M.D / 2 - MID_STOP } : { x1: M.D / 2 + MID_STOP, x2: M.D + EDGE_OUT },
    x, y, hp: cls.maxHp, maxHp: cls.maxHp, alive: true, deathT: 0, gone: false,
    angle: BOW_DOWN, sweepDir: 1, power: 0, drawing: false,
    lockL: true, lockR: true,      // triggers must be let go once at the start of a round
    cd: {},                        // cooldowns left, by action (see `cooldown` in src/data/classes.js)
    walk: 0, crouching: false, crouch: 0, blocking: false,
    stride: 0, run: 0, air: 0, landT: 0,                     // leg animation (see legs())
    shield, shieldHp: shield ? shield.durability : 0, shieldBroken: false,
    potions: cls.potions || 0, ult: 0, ultArmed: false,
    flinch: 0, twang: 0, stuck: [],
    onPlatform: false, falling: false, knocked: false, vx: 0, vy: 0, slideV: 0,
    shaky: 0, barrier: false, nextShot: null,                // hit effects and power-ups
    bleedT: 0, bleedAt: null, pooled: false,                 // blood
    ...extra,
  };
}

const makeBot = (x, err = BOT_START_ERR) => ({
  phase: 'think', timer: rand(1.0, 1.8), target: null, baseAngle: 30, wantAngle: 30, wantPower: 0, err,
  home: x, walkTo: x, walkT: rand(1, 3), blockT: 0, seen: new WeakSet(),
});

export function makeFighter(r) {
  const cls = CLASSES[r.cls] || CLASSES[DEFAULT_CLASS];
  const side = slotSide(r.slot), high = slotIsHigh(r.slot);
  const facing = side === 'L' ? 1 : -1;
  const baseX = side === 'L' ? 0 : M.D;
  const x = high ? baseX - facing * PLATFORM_BACK : baseX;
  const f = baseFighter(cls, side, x, groundY(baseX) - (high ? PLATFORM_RISE : 0),
                        { name: r.name, pad: r.pad, color: r.color, isBot: r.isBot, order: high ? 1 : 0, onPlatform: high });
  if (M.ffa) f.team = r.name;
  f.bot = r.isBot ? makeBot(x) : null;
  return f;
}

// Minions spread out between their team and the middle.
export function makeMinion(side, i, n) {
  const front = M.D / 2 - MID_STOP - 40, back = 170;
  const off = lerp(back, front, (i + 0.5) / n) + rand(-15, 15);
  const x = side === 'L' ? off : M.D - off;
  const f = baseFighter(CLASSES[MINION_CLASS], side, x, groundY(x),
                        { name: 'MINION', pad: null, color: '#555', isBot: true, order: 2 });
  f.bot = makeBot(x, BOT_START_ERR * 1.6);
  return f;
}

function aimDir(facing, angleDeg) {
  const a = angleDeg * Math.PI / 180;
  return { x: facing * Math.cos(a), y: -Math.sin(a) };
}

// After an arm hit the bow trembles, and the tremble is part of where the arrow goes.
const aimShake = f => f.shaky > 0 && f.alive ? Math.sin(T * 11) * 4 + Math.sin(T * 23.7) * 2.5 : 0;

const THIGH = 32, STRIDE = 150, LAND_T = 0.2;    // thigh / shin length (longer than half the leg, so knees always show), px per run cycle, landing dip

// Two-segment leg: the knee sits where thigh and shin meet, always bent toward the facing side.
function kneeOf(hip, foot, len, facing) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y, d = Math.hypot(dx, dy) || 1;
  const h = Math.sqrt(Math.max(0, len * len - d * d / 4));
  const s = -dy * facing >= 0 ? 1 : -1;         // which side of the hip-foot line is "forward"
  return { x: (hip.x + foot.x) / 2 - dy / d * h * s, y: (hip.y + foot.y) / 2 + dx / d * h * s };
}

// Feet: planted when standing, a run cycle when walking, tucked up in the air.
// The stride phase is signed by walking direction, so the lifted foot always swings the way they walk.
function legs(f, x, y, sz, c) {
  const stand = [{ x: x - (20 + 6 * c) * sz, y }, { x: x + (20 + 6 * c) * sz, y }];
  const run = f.run || 0, air = f.air || 0;
  return stand.map((st, i) => {
    const ph = (f.stride || 0) + i * Math.PI;
    let fx = lerp(st.x, x + Math.sin(ph) * 24 * sz, run), fy = y - run * Math.max(0, Math.cos(ph)) * 28 * sz;
    if (air) {                                   // knees up on the way up, legs reach down to land
      const tuck = clamp(0.7 - (f.vy || 0) / 1400, 0.5, 1), front = (i === 1) === (f.facing > 0);
      fx = lerp(fx, x + (front ? 14 : -26) * f.facing * sz, air);
      fy = lerp(fy, y - (front ? 40 : 28) * tuck * sz, air);
    }
    return { x: fx, y: fy };
  });
}

export function getPose(f, angle = f.angle + aimShake(f), pull = f.drawing ? f.power : 0) {
  if (f.blocking) { angle = BOW_DOWN; pull = 0; }
  const sz = f.size || 1, c = Math.max(f.crouch || 0, 0.6 * (f.landT || 0) / LAND_T);   // knees give a bit on landing
  const k = sz * (1 - 0.5 * c);                 // crouching halves the height
  const d = aimDir(f.facing, angle);
  const x = f.x, y = f.y + (f.run || 0) * Math.abs(Math.sin(f.stride || 0)) * 3 * sz;   // bob while running
  const shoulder = { x, y: y - 95 * k };
  const hip = { x, y: y - 52 * k + (f.run || 0) * 6 * sz };   // sit lower in the stride so the knees bend
  const [footL, footR] = legs(f, x, f.y, sz, c);
  const body = {
    d, shoulder, hip, footL, footR,
    head: { x, y: y - 125 * k }, neck: { x, y: y - 107 * k },
    kneeL: kneeOf(hip, footL, THIGH * sz, f.facing), kneeR: kneeOf(hip, footR, THIGH * sz, f.facing),
    shieldAt: { x: x + f.facing * 34 * sz, y: y - 72 * k }, shieldHalf: 52 * k,
  };
  if (f.weapon && f.weapon.throws) {
    // the front arm points where the stone goes; the throwing arm winds back as you pull,
    // and swings through right after the throw
    const t = aimDir(f.facing, f.twang > 0 ? angle - 50 : angle + 40 + 110 * pull);
    return {
      ...body,
      bowHand: { x: x + d.x * 40 * sz, y: shoulder.y + d.y * 40 * sz },
      drawHand: { x: x + t.x * 44 * sz, y: shoulder.y + t.y * 44 * sz },
      elbow: { x: x + t.x * 22 * sz, y: shoulder.y + t.y * 22 * sz + 5 * sz },
      tip: { x: x + d.x * 50 * sz, y: shoulder.y + d.y * 50 * sz },
    };
  }
  const bowHand = { x: x + d.x * 54 * sz, y: shoulder.y + d.y * 54 * sz };
  const back = (12 + 40 * pull) * sz;
  const drawHand = { x: bowHand.x - d.x * back, y: bowHand.y - d.y * back };
  const elbow = {
    x: lerp(x + d.x * 20 * sz, x - d.x * 24 * sz, pull),
    y: lerp(shoulder.y + (d.y * 20 + 12) * sz, shoulder.y - (d.y * 24 + 2) * sz, pull),
  };
  const tip = { x: drawHand.x + d.x * ARROW_LEN, y: drawHand.y + d.y * ARROW_LEN };
  return { ...body, bowHand, drawHand, elbow, tip };
}

export function hitZone(f, px, py) {
  const P = getPose(f), sz = f.size || 1;
  if (f.blocking && Math.abs(px - P.shieldAt.x) <= 8 && Math.abs(py - P.shieldAt.y) <= P.shieldHalf) return 'shield';
  if (Math.hypot(px - P.head.x, py - P.head.y) <= 20 * sz) return 'head';
  if (distToSegment(px, py, P.neck, P.hip) <= 7 * sz) return 'torso';
  if (distToSegment(px, py, P.shoulder, P.bowHand) <= 4) return 'arm';
  if (distToSegment(px, py, P.shoulder, P.elbow) <= 4) return 'arm';
  if (distToSegment(px, py, P.elbow, P.drawHand) <= 4) return 'arm';
  for (const [knee, foot] of [[P.kneeL, P.footL], [P.kneeR, P.footR]]) {
    if (distToSegment(px, py, P.hip, knee) <= 6 * sz || distToSegment(px, py, knee, foot) <= 6 * sz) return 'leg';
  }
  return null;
}

// `by` is whoever did the damage: it charges their ultimate (minions count too).
export function hurt(f, dmg, by = null) {
  const dealt = Math.min(f.hp, dmg);
  f.hp -= dealt;
  f.flinch = 0.3;
  const ult = by && by !== f && by.cls.ultimate;
  if (ult && by.ult < ult.charge) {
    by.ult = Math.min(ult.charge, by.ult + dealt);
    if (by.ult >= ult.charge) {
      M.popups.push({ x: by.x, y: by.y - 232, text: 'ULTIMATE READY  △', color: '#c99a12', t: 0 });
      play('ultReady');
    }
  }
  if (f.hp <= 0 && f.alive) {
    f.alive = false;
    f.deathT = 0;
    f.drawing = false;
    f.power = 0;
    f.barrier = false;
    f.blocking = false;
    f.walk = 0;
    if (!f.minion) M.slowmo = 0.8;
  }
}

// Fighters on a platform fall off it (and take fall damage when they land);
// fighters on the ground slide back a little, which can take them over a canyon edge.
export function knock(f, dir, strength) {
  if (f.falling) return;
  dir = dir || -f.facing;
  if (f.onPlatform) {
    f.onPlatform = false;
    f.falling = true;
    f.knocked = true;
    f.vx = dir * 230 * strength;
    f.vy = -260;
    M.popups.push({ x: f.x, y: f.y - 232, text: 'KNOCKED OFF!', t: 0 });
    play('fall');
  } else {
    f.slideV = dir * 160 * strength * (f.minion ? 1.5 : 1);
  }
}

export function jump(f) {
  f.falling = true;
  f.knocked = false;
  f.onPlatform = false;
  f.vy = -Math.sqrt(2 * FALL_GRAVITY * f.cls.jumpHeight);
}

// ↓ + ✕ on a ledge drops through it.
export function dropDown(f) {
  startFall(f, false);
  f.y += 1;                      // just below the ledge, so it doesn't catch them right away
}

// Steep steps in the ground stop fighters, walking or in the air: they have to jump up them.
const stepTo = (f, nx) => wallAhead(nx, f.y, Math.sign(nx - f.x)) ? f.x : nx;

// Walking keeps to the fighter's zone. `loose` (knocked about) only keeps them off the
// far edge, so a hard hit can push someone toward the middle.
function keepIn(f, x, nx, loose) {
  const z = f.zone;
  const lo = f.side === 'R' && loose ? -Infinity : z.x1, hi = f.side === 'L' && loose ? Infinity : z.x2;
  if (nx > hi && nx > x) nx = Math.max(x, hi);
  if (nx < lo && nx < x) nx = Math.min(x, lo);
  return nx;
}

const onSomePlatform = f => M.platforms.some(p => f.x >= p.x1 && f.x <= p.x2 && Math.abs(p.y - f.y) < 2);

function startFall(f, knocked) {
  f.falling = true;
  f.onPlatform = false;
  f.knocked = knocked;
  f.vx = knocked ? f.slideV : f.walk;
  f.vy = 0;
  f.slideV = 0;
}

function land(f, y, onPlatform) {
  f.y = y;
  f.falling = false;
  f.onPlatform = onPlatform;
  f.landT = LAND_T;
  if (f.knocked) {
    dust(f.x, y, f.vx);
    play('land');
    if (f.alive) {
      M.popups.push({ x: f.x, y: f.y - 200, text: `FALL  -${FALL_DAMAGE}`, t: 0 });
      hurt(f, FALL_DAMAGE);
    }
  }
  f.knocked = false;
  f.vx = 0;
}

function moveFighter(f, dt) {
  if (f.falling) {
    if (!f.knocked) f.vx = f.alive ? f.walk : 0;   // jumping or stepping off: steer in the air
    const prevY = f.y;
    f.x = stepTo(f, keepIn(f, f.x, f.x + f.vx * dt, f.knocked));
    f.y += f.vy * dt;
    f.vy += FALL_GRAVITY * dt;
    if (f.vy > 0) {
      const p = M.platforms.find(p => f.x >= p.x1 && f.x <= p.x2 && prevY <= p.y && f.y >= p.y);
      const gy = groundY(f.x);
      if (p) land(f, p.y, true);
      else if (f.y >= gy) land(f, gy, false);
    }
    if (f.y > deathDepth()) {           // into the canyon
      if (f.alive) {
        M.popups.push({ x: f.x, y: deathDepth() - 600, text: `${f.minion ? 'MINION' : f.name} FELL`, big: !f.minion, t: 0 });
        hurt(f, f.hp);
      }
      f.falling = false;
      f.gone = true;
    }
    return;
  }

  const x = f.x;
  if (f.slideV) {
    f.x = stepTo(f, keepIn(f, x, x + f.slideV * dt, true));
    f.slideV *= Math.exp(-10 * dt);
    if (Math.abs(f.slideV) < 5 || f.x === x) f.slideV = 0;
  } else if (f.walk) {
    f.x = stepTo(f, keepIn(f, x, x + f.walk * dt, false));
  }
  if (f.x === x) return;
  if (f.onPlatform) {
    if (!onSomePlatform(f)) startFall(f, false);         // stepped off: no fall damage
  } else {
    const gy = groundY(f.x);
    if (gy > f.y + 30) startFall(f, !!f.slideV);
    else f.y = gy;
  }
}

export function animateFighter(f, dt) {
  if (f.gone) return;
  if (!f.alive) f.deathT = Math.min(1, f.deathT + dt / 0.45);
  f.flinch = Math.max(0, f.flinch - dt);
  f.twang = Math.max(0, f.twang - dt);
  for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);
  for (const s of f.stuck) s.wob = Math.max(0, s.wob - dt / 0.6);
  f.crouch = f.crouching ? Math.min(1, f.crouch + dt * 10) : Math.max(0, f.crouch - dt * 10);
  if (f.shield && !f.blocking && !f.shieldBroken) f.shieldHp = Math.min(f.shield.durability, f.shieldHp + f.shield.regen * dt);
  const x0 = f.x;
  moveFighter(f, dt);
  // legs: the stride follows the ground covered, so feet don't slide
  const walking = !f.falling && !f.slideV && f.x !== x0;
  if (walking) f.stride += (f.x - x0) / (STRIDE * f.size) * Math.PI * 2;
  f.run = clamp(f.run + (walking ? dt : -dt) * 8, 0, 1);
  f.air = clamp(f.air + (f.falling && f.alive ? dt : -dt) * 10, 0, 1);
  f.landT = Math.max(0, f.landT - dt);

  // blood: drips from the wound for a moment, and a pool once the body is down
  if (f.bleedT > 0 && !f.gone) {
    f.bleedT -= dt;
    if (Math.random() < dt * 9) drop(f.x + f.bleedAt.x, f.y + f.bleedAt.y, rand(-25, 25), rand(-20, 30), rand(1.5, 2.8));
  }
  if (!f.alive && !f.falling && !f.gone && !f.pooled && f.deathT >= 1 && settings.blood) {
    f.pooled = true;
    const s = f.size;
    M.pools.push({ x: f.x - f.facing * 60 * s, y: f.y, r: 0, max: (f.onPlatform ? 38 : 70) * s });
  }
}
