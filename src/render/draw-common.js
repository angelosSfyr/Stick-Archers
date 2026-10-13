// Drawing shared by the lobby and the match: arrows and stick figures.
import { ARROW_LEN, FIRE } from '../config.js';
import { T } from '../core/clock.js';
import { nextShot } from '../data/powerups.js';
import { ARROWS } from '../data/weapons.js';
import { getPose } from '../game/fighter.js';
import { lerp } from '../util.js';
import { ctx, line } from './canvas.js';

// A flickering tongue of fire h long and w wide at its base, pointing along ang (default: up).
export function flame(x, y, h, w, ang = -Math.PI / 2) {
  if (h < 2) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang + Math.PI / 2);
  for (const [k, color] of [[1, FIRE], [0.55, '#ffc23a']]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w * k, 0);
    ctx.quadraticCurveTo(-w * k, -h * k * 0.55, 0, -h * k);
    ctx.quadraticCurveTo(w * k, -h * k * 0.55, w * k, 0);
    ctx.quadraticCurveTo(0, w * k * 0.6, -w * k, 0);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFireball(x, y, r) {
  const k = 1 + Math.sin(T * 37 + x) * 0.08;
  ctx.fillStyle = FIRE;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.25 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffc23a';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
}

// A lumpy grey rock that turns as it moves (so it rolls through the air), with a fuse when it's a bomb.
const ROCK = [1, 0.86, 0.97, 0.8, 0.94, 0.88, 1, 0.83];
export function drawBoulder(x, y, r, bomb) {
  const spin = x / r;
  ctx.fillStyle = '#8b847b';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(2, r / 6);
  ctx.beginPath();
  ROCK.forEach((k, i) => {
    const a = spin + i / ROCK.length * Math.PI * 2;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, r / 10);
  line(x + Math.cos(spin + 1) * r * 0.2, y + Math.sin(spin + 1) * r * 0.2, x + Math.cos(spin + 0.6) * r * 0.7, y + Math.sin(spin + 0.6) * r * 0.7);
  if (bomb) {
    ctx.fillStyle = Math.sin(T * 40) > 0 ? '#ff8a00' : '#ffd000';
    ctx.beginPath();
    ctx.arc(x, y - r - 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawArrow(tx, ty, ang, color = '#000', flutter = 0, kind = 'normal') {
  const look = ARROWS[kind].look || {};
  if (look.fireball) { drawFireball(tx, ty, look.fireball); return; }
  if (look.boulder) { drawBoulder(tx, ty, look.boulder, look.bomb); return; }
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
  for (const [knee, foot] of [[P.kneeL, P.footL], [P.kneeR, P.footR]]) {
    line(P.hip.x, P.hip.y, knee.x, knee.y);    // thigh and shin as two sticks
    line(knee.x, knee.y, foot.x, foot.y);
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
      const r = (ARROWS[kind].look || {}).boulder || 0;   // a boulder sits on top of the hand
      spread.forEach((_, i) => drawArrow(P.drawHand.x + (i - (spread.length - 1) / 2) * 7, P.drawHand.y - 4 - r, 0, color, 0, kind));
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
  if (f.blocking && f.alive && f.shield.guard) {   // fists up in front of the face
    ctx.fillStyle = color;
    for (const h of [P.bowHand, P.drawHand]) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 6 * sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (f.blocking && f.alive && f.shield.durability) {   // shield held up in front
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
  if (f.blocking && f.alive && f.shield.burst) {   // a wall of fire in front, dying down
    const s = P.shieldAt, h = P.shieldHalf, k = Math.min(1, f.wardT / f.shield.burst * 1.5);
    for (let i = 0; i < 5; i++) {
      const y = s.y - h + (i + 0.5) * h * 2 / 5;
      flame(s.x - f.facing * 6, y, (34 + Math.sin(T * 40 + i * 2) * 8) * k * sz, 13 * sz, f.facing > 0 ? 0 : Math.PI);
    }
  }
  if (f.cls && f.cls.hat === 'wizard') {       // pointed hat, its tip flopping back
    const h = P.head;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(h.x - 17 * sz, h.y - 12 * sz);
    ctx.quadraticCurveTo(h.x - f.facing * 6 * sz, h.y - 40 * sz, h.x - f.facing * 26 * sz, h.y - 56 * sz);
    ctx.quadraticCurveTo(h.x + f.facing * 4 * sz, h.y - 36 * sz, h.x + 17 * sz, h.y - 12 * sz);
    ctx.fill();
    ctx.lineWidth = 5 * sz;
    line(h.x - 28 * sz, h.y - 12 * sz, h.x + 28 * sz, h.y - 12 * sz);
  }
  if (f.burnT > 0 && f.alive) {                // on fire
    for (const [a, b, i] of [[P.hip, P.neck, 0], [P.hip, P.footL, 1], [P.hip, P.footR, 2], [P.neck, P.head, 3]]) {
      for (const t of [0.25, 0.75]) {
        flame(lerp(a.x, b.x, t), lerp(a.y, b.y, t), (20 + Math.sin(T * 30 + i * 3 + t * 7) * 7) * sz, 7 * sz);
      }
    }
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
