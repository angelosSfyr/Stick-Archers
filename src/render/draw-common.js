// Drawing shared by the lobby and the match: arrows and stick figures.
import { ARROW_LEN } from '../config.js';
import { T } from '../core/clock.js';
import { nextShot } from '../data/powerups.js';
import { ARROWS } from '../data/weapons.js';
import { getPose } from '../game/fighter.js';
import { ctx, line } from './canvas.js';

export function drawArrow(tx, ty, ang, color = '#000', flutter = 0, kind = 'normal') {
  const look = ARROWS[kind].look || {};
  if (look.stone) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tx, ty, look.stone, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const c = Math.cos(ang), s = Math.sin(ang);
  const bx = tx - c * ARROW_LEN, by = ty - s * ARROW_LEN;
  const head = look.head || 12, half = look.half || 5;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = look.width || 2.5;
  line(bx, by, tx - c * 6, ty - s * 6);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - c * head - s * half, ty - s * head + c * half);
  ctx.lineTo(tx - c * head + s * half, ty - s * head - c * half);
  ctx.closePath();
  ctx.fill();
  const spread = 6 + flutter;
  ctx.lineWidth = 2;
  line(bx + c * 10, by + s * 10, bx - c * 2 - s * spread, by - s * 2 + c * spread);
  line(bx + c * 10, by + s * 10, bx - c * 2 + s * spread, by - s * 2 - c * spread);
  if (look.bomb) {                     // a little bomb with a fizzing fuse on the tip
    ctx.beginPath();
    ctx.arc(tx - c * 4, ty - s * 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = Math.sin(T * 40) > 0 ? '#ff8a00' : '#ffd000';
    ctx.beginPath();
    ctx.arc(tx - c * 4 - s * 10, ty - s * 4 + c * 10 - 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawStickman(f, color, showNock) {
  const P = getPose(f), sz = f.size || 1;
  ctx.save();
  if (f.flinch > 0) ctx.translate(Math.sin(T * 70) * 5 * f.flinch / 0.3, 0);
  if (!f.alive) {
    const t = 1 - (1 - f.deathT) ** 2;
    ctx.translate(f.x, f.y - 18 * sz * t);    // lift so the head rests on the ground
    ctx.rotate(-f.facing * Math.PI / 2 * t);  // fall over backwards
    ctx.translate(-f.x, -f.y);
  }
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6 * Math.max(0.7, sz);

  ctx.beginPath();
  ctx.arc(P.head.x, P.head.y, 18 * sz, 0, Math.PI * 2);
  ctx.stroke();
  line(P.neck.x, P.neck.y, P.hip.x, P.hip.y);
  for (const foot of [P.footL, P.footR]) {
    ctx.beginPath();
    ctx.moveTo(P.hip.x, P.hip.y);
    if (P.knee) ctx.lineTo((P.hip.x + foot.x) / 2 + P.knee, (P.hip.y + foot.y) / 2);
    ctx.lineTo(foot.x, foot.y);
    ctx.stroke();
  }
  line(P.shoulder.x, P.shoulder.y, P.bowHand.x, P.bowHand.y);
  ctx.beginPath();
  ctx.moveTo(P.shoulder.x, P.shoulder.y);
  ctx.lineTo(P.elbow.x, P.elbow.y);
  ctx.lineTo(P.drawHand.x, P.drawHand.y);
  ctx.stroke();

  const d = P.d;
  if (f.weapon && f.weapon.throws) {
    if (showNock) {                            // the stones in the throwing hand
      const { arrow: kind, spread } = nextShot(f);
      spread.forEach((_, i) => drawArrow(P.drawHand.x + (i - (spread.length - 1) / 2) * 7, P.drawHand.y - 4, 0, color, 0, kind));
    }
  } else {
    // bow, and a string that vibrates right after a shot
    const px = -d.y, py = d.x;
    const t1 = { x: P.bowHand.x + px * 30 - d.x * 10, y: P.bowHand.y + py * 30 - d.y * 10 };
    const t2 = { x: P.bowHand.x - px * 30 - d.x * 10, y: P.bowHand.y - py * 30 - d.y * 10 };
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.quadraticCurveTo(P.bowHand.x + d.x * 14, P.bowHand.y + d.y * 14, t2.x, t2.y);
    ctx.stroke();
    let sx = P.drawHand.x, sy = P.drawHand.y;
    if (f.twang > 0) {
      const k = Math.sin(T * 90) * 8 * f.twang / 0.35;
      sx += px * k;
      sy += py * k;
    }
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(sx, sy);
    ctx.lineTo(t2.x, t2.y);
    ctx.stroke();

    if (showNock) {
      const ang = Math.atan2(d.y, d.x), { arrow: kind, spread } = nextShot(f);
      for (const da of spread.map(deg => deg * Math.PI / 180)) {
        drawArrow(P.drawHand.x + Math.cos(ang + da) * ARROW_LEN, P.drawHand.y + Math.sin(ang + da) * ARROW_LEN,
                  ang + da, color, 0, kind);
      }
    }
  }
  if (f.blocking && f.alive) {                 // shield held up in front
    const s = P.shieldAt, h = P.shieldHalf, w = 9 * sz;
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(s.x - w, s.y - h, w * 2, h * 2, w);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.globalAlpha = 1 - f.shieldHp / f.shield.durability;   // gets darker as it wears out
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const s of f.stuck) drawArrow(f.x + s.x, f.y + s.y, s.ang + Math.sin(T * 45) * 0.2 * s.wob);
  ctx.restore();

  if (f.barrier && f.alive) {                  // barrier bubble
    const r = 95 + Math.sin(T * 4) * 3;
    ctx.fillStyle = 'rgba(201, 154, 18, 0.08)';
    ctx.strokeStyle = 'rgba(201, 154, 18, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 75 * (1 - 0.5 * (f.crouch || 0)), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
