// Turning a controller (or a bot) into what a fighter does: move, crouch, jump, block,
// drink a potion, switch weapons, arm the ultimate, aim (LT) and shoot (RT).
// Everything a bot or a player can press is in one "input" object:
//   { lt, rt, move (-1..1), crouch, block (held), jump, potion, swap, ult (just pressed) }
import { MAX_ANGLE, MIN_ANGLE, SWEEP_SPEED } from '../config.js';
import { padState, pressed } from '../core/input.js';
import { play } from '../audio/sfx.js';
import { botInput } from './bot.js';
import { launch } from './combat.js';
import { jump } from './fighter.js';
import { M } from './match.js';

export const NO_INPUT = { lt: false, rt: false, move: 0, crouch: false, block: false,
                          jump: false, potion: false, swap: false, ult: false };

function padInput(f) {
  const p = padState(f.pad);
  if (!p.lt) f.lockL = false;
  if (!p.rt) f.lockR = false;
  return {
    lt: p.lt && !f.lockL, rt: p.rt && !f.lockR, move: p.moveX, crouch: !!p.btn.down, block: !!p.btn.block,
    jump: pressed(p, 'up'), potion: pressed(p, 'potion'), swap: pressed(p, 'swap'), ult: pressed(p, 'ult'),
  };
}

const ready = (f, action) => !f.cd[action];
const cooldown = (f, action) => { f.cd[action] = f.cls.cooldown[action] || 0; };

export function controlFighter(f, dt) {
  const inp = f.bot ? botInput(f, dt) : padInput(f);
  f.crouching = inp.crouch && !f.falling;
  // shield up: nothing else works (crouching and being mid-jump still do)
  f.blocking = inp.block && !!f.shield && !f.shieldBroken;
  f.walk = 0;
  if (f.blocking) {
    f.drawing = false;
    f.power = 0;
    return;
  }
  if (!f.crouching) f.walk = inp.move * f.cls.moveSpeed;
  if (inp.jump && f.cls.jumpHeight && !f.falling && !f.crouching && !f.slideV) jump(f);
  if (inp.potion) drinkPotion(f);
  if (inp.swap) swapWeapon(f);
  if (inp.ult) toggleUltimate(f);
  aimAndShoot(f, inp.lt, inp.rt, dt);
}

// Someone who isn't being controlled right now just stands there.
export function idle(f) {
  f.walk = 0;
  f.blocking = false;
  f.crouching = false;
  f.drawing = false;
  f.power = 0;
}

function drinkPotion(f) {
  if (!f.potions || f.hp >= f.maxHp || !ready(f, 'potion')) return;
  f.potions--;
  const heal = Math.min(f.cls.potionHeal, f.maxHp - f.hp);
  f.hp += heal;
  cooldown(f, 'potion');
  M.popups.push({ x: f.x, y: f.y - 200, text: `+${heal}`, color: '#2c9e4b', t: 0 });
  play('heal');
}

function swapWeapon(f, to = (f.weaponIdx + 1) % f.weapons.length) {
  if (f.weapons.length < 2 || to === f.weaponIdx || !ready(f, 'swap')) return;
  f.weaponIdx = to;
  f.weapon = f.weapons[to];
  f.drawing = false;
  f.power = 0;
  f.ultArmed = false;            // the ultimate is a main-weapon shot; the charge is kept
  cooldown(f, 'swap');
  play('swap');
}

// △ with a full meter arms the ultimate (and takes out the main weapon); △ again puts it away.
function toggleUltimate(f) {
  const u = f.cls.ultimate;
  if (!u) return;
  if (f.ultArmed) { f.ultArmed = false; return; }
  if (f.ult < u.charge) return;
  if (f.weaponIdx !== 0) {
    f.cd.swap = 0;
    swapWeapon(f, 0);
  }
  f.ultArmed = true;
  M.popups.push({ x: f.x, y: f.y - 232, text: u.name, color: '#c99a12', t: 0 });
  play('ult');
}

function aimAndShoot(f, lt, rt, dt) {
  // LT: the weapon sweeps up and down while held (it starts below the range, pointing down)
  if (lt) {
    f.angle += f.sweepDir * SWEEP_SPEED * dt;
    if (f.sweepDir > 0 && f.angle >= MAX_ANGLE) { f.angle = MAX_ANGLE; f.sweepDir = -1; }
    if (f.sweepDir < 0 && f.angle <= MIN_ANGLE) { f.angle = MIN_ANGLE; f.sweepDir = 1; }
  }
  // RT: hold to draw, release to shoot
  if (rt && ready(f, 'shot')) {
    f.drawing = true;
    f.power = Math.min(1, f.power + dt / f.weapon.drawTime);
  } else if (f.drawing && !rt) {
    if (f.power >= 0.04) { launch(f); cooldown(f, 'shot'); }
    else { f.drawing = false; f.power = 0; }
  }
}
