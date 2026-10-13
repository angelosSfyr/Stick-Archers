// Power-up balloons floating between the teams. What each one gives is in src/data/powerups.js.
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { play } from '../audio/sfx.js';
import { POWERUPS } from '../data/powerups.js';
import { pick, rand } from '../util.js';
import { M } from './match.js';

export const balloonCount = () => M.D >= 2100 ? 3 : 2;

export function spawnBalloon() {
  const types = Object.keys(POWERUPS);
  for (let tries = 0; tries < 12; tries++) {
    const x = rand(0.3, 0.7) * M.D;
    if (M.balloons.some(b => Math.abs(b.x - x) < 160)) continue;
    M.balloons.push({ type: pick(types), x, y: 0,
                      baseY: Math.min(0, M.terrain.minY) - rand(260, 620),
                      phase: rand(0, Math.PI * 2), vx: rand(-25, 25), age: 0 });
    return;
  }
}

export function updateBalloons(dt) {
  if (!settings.balloons) return;
  if (M.balloons.length < balloonCount() && (M.balloonTimer -= dt) <= 0) {
    spawnBalloon();
    M.balloonTimer = rand(6, 10);
  }
  for (const b of M.balloons) {
    b.age += dt;
    b.x += (b.vx + M.wind * 35) * dt;
    if (b.x < 0.25 * M.D) { b.x = 0.25 * M.D; b.vx = Math.abs(b.vx); }
    if (b.x > 0.75 * M.D) { b.x = 0.75 * M.D; b.vx = -Math.abs(b.vx); }
    b.y = b.baseY + Math.sin(T * 1.3 + b.phase) * 22;
  }
}

// The arrow flies on through; whoever shot it gets the power-up.
export function popBalloon(b, a) {
  M.balloons.splice(M.balloons.indexOf(b), 1);
  M.balloonTimer = rand(6, 10);
  play('pop');
  const info = POWERUPS[b.type];
  for (let i = 0; i < 12; i++) {
    const ang = rand(0, Math.PI * 2), sp = rand(80, 260);
    M.particles.push({ kind: 'shred', color: info.color, x: b.x, y: b.y, vx: Math.cos(ang) * sp,
                       vy: Math.sin(ang) * sp - 60, t: 0, life: rand(0.5, 0.9), rot: rand(0, 6) });
  }
  const f = a.owner;
  if (!f.alive) return;
  M.popups.push({ x: b.x, y: b.y - 50, text: `${info.name} → ${f.name}`, color: info.color, t: 0 });
  if (info.shot) f.nextShot = b.type;
  else info.apply(f);
  play(info.sound);
}
