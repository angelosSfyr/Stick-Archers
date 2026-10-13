// Turning LT / RT (from a controller or a bot) into aiming and shooting.
import { HANDOFF_TIME, MAX_ANGLE, MIN_ANGLE, SWEEP_SPEED } from '../config.js';
import { padState } from '../core/input.js';
import { botInput } from './bot.js';
import { launch } from './combat.js';
import { M } from './match.js';

export function controlShooter(f, dt) {
  let lt, rt;
  if (f.bot) {
    ({ lt, rt } = botInput(f, dt));
  } else {
    const p = padState(f.pad);
    if (!p.lt) f.lockL = false;
    if (!p.rt) f.lockR = false;
    lt = p.lt && !f.lockL;
    rt = p.rt && !f.lockR;
  }

  // LT: the bow sweeps up and down while held (it starts below the range, pointing down)
  if (lt) {
    f.angle += f.sweepDir * SWEEP_SPEED * dt;
    if (f.sweepDir > 0 && f.angle >= MAX_ANGLE) { f.angle = MAX_ANGLE; f.sweepDir = -1; }
    if (f.sweepDir < 0 && f.angle <= MIN_ANGLE) { f.angle = MIN_ANGLE; f.sweepDir = 1; }
  }

  // RT: hold to draw, release to shoot
  if (rt && f.reload <= 0) {
    f.drawing = true;
    f.power = Math.min(1, f.power + dt / f.weapon.drawTime);
  } else if (f.drawing && !rt) {
    if (f.power >= 0.04) release(f);
    else { f.drawing = false; f.power = 0; }
  }
}

function release(f) {
  if (M.turns === 'team') { f.locked = true; return; }
  launch(f);
  if (M.turns === 'single') M.handoff = HANDOFF_TIME;
}
