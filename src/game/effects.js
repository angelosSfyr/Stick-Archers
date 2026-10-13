// Particles: dust, sparks, smoke, blood. Drawn by drawParticles in src/render/draw-match.js.
import { settings } from '../core/settings.js';
import { play } from '../audio/sfx.js';
import { rand } from '../util.js';
import { M } from './match.js';
import { groundY } from './terrain.js';

export function bleed(f, x, y, ang, amount) {
  if (!settings.blood) return;
  for (let i = 0; i < 14 * amount; i++) {             // spurts out the far side
    const a = ang + rand(-0.7, 0.7), sp = rand(80, 340) * (0.6 + 0.4 * amount);
    drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp - rand(40, 160), rand(1.8, 4.2));
  }
  for (let i = 0; i < 4 * amount; i++) {              // and sprays back toward the shooter
    const a = ang + Math.PI + rand(-0.6, 0.6), sp = rand(60, 160);
    drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 80, rand(1.5, 3));
  }
  f.bleedT = 1.6 * amount;
  f.bleedAt = { x: x - f.x, y: y - f.y };
}

export function drop(x, y, vx, vy, r) {
  if (settings.blood) M.particles.push({ kind: 'blood', x, y, vx, vy, r, t: 0, life: 4 });
}

export function dust(x, y, vx) {
  play('ground');
  const back = -Math.sign(vx) || 1;
  for (let i = 0; i < 7; i++) {
    M.particles.push({ kind: 'speck', x, y: y - 2, vx: back * rand(20, 160) + rand(-40, 40),
                       vy: -rand(150, 330), t: 0, life: rand(0.45, 0.8) });
  }
  M.particles.push({ kind: 'ring', x, y: y - 4, vx: 0, vy: 0, t: 0, life: 0.45 });
}

export function sparks(x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + Math.PI + rand(-1.2, 1.2), sp = rand(160, 340);
    M.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.18, 0.32) });
  }
}

// smoke where an archer vanishes / appears when moved across
export function puff(x, y) {
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(60, 200);
    M.particles.push({ kind: 'smoke', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.5, 0.9), r: rand(10, 22) });
  }
}

export function updateParticles(dt) {
  for (const p of M.particles) {
    p.t += dt;
    if (p.kind === 'speck' || p.kind === 'shred') p.vy += 900 * dt;
    if (p.kind === 'blood') p.vy += 1100 * dt;
    if (p.kind === 'smoke') { p.vx *= Math.exp(-4 * dt); p.vy = p.vy * Math.exp(-4 * dt) - 30 * dt; }
    const prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'blood' && p.vy > 0) {                // a drop that lands leaves a stain
      const plat = M.platforms.find(q => p.x >= q.x1 && p.x <= q.x2 && prevY <= q.y && p.y >= q.y);
      const gy = groundY(p.x);
      if (plat || p.y >= gy) {
        M.stains.push({ x: p.x, y: plat ? plat.y : gy, r: p.r * rand(1.1, 1.8) });
        p.t = p.life;
      }
    }
  }
  M.particles = M.particles.filter(p => p.t < p.life);
  if (M.stains.length > 500) M.stains.splice(0, M.stains.length - 500);
}
