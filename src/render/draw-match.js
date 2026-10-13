// The match: the world (sky, ground, fighters, arrows, effects), then the HUD on top.
import { BLOOD, EDGE_OUT } from '../config.js';
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { POWERUPS } from '../data/powerups.js';
import { M, inPlay } from '../game/match.js';
import { getPose } from '../game/fighter.js';
import { groundY } from '../game/terrain.js';
import { CLOUD_PARALLAX, CLOUD_PUFFS, CLOUD_SPAN } from '../game/sky.js';
import { mod } from '../util.js';
import { cam, screenTransform, toScreen, visibleWorld, worldTransform } from './camera.js';
import { ctx, line, text } from './canvas.js';
import { drawArrow, drawStickman } from './draw-common.js';
import { drawFighterOverlay, drawHUD, drawStreaks } from './draw-hud.js';

function drawClouds() {
  const placed = M.clouds.map(c => ({
    x: cam.x + mod(c.x + M.cloudDrift - cam.x * CLOUD_PARALLAX, CLOUD_SPAN) - CLOUD_SPAN / 2,
    y: c.y + cam.y * (1 - CLOUD_PARALLAX),
    s: c.s,
  }));
  const puffs = (c, method) => {
    for (const [dx, dy, r] of CLOUD_PUFFS) {
      ctx.beginPath();
      ctx.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2);
      ctx[method]();
    }
  };
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#e6e6e6';
  for (const c of placed) puffs(c, 'stroke');
  ctx.fillStyle = '#fff';
  for (const c of placed) puffs(c, 'fill');
}

function drawTerrain(vis) {
  const step = 10, c = M.terrain.canyon;
  if (c) {                                         // the canyon gets darker the deeper it goes
    const top = Math.min(groundY(c.x1 - 20), groundY(c.x2 + 20));
    const g = ctx.createLinearGradient(0, top, 0, top + 700);
    g.addColorStop(0, 'rgba(0,0,0,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x1 - 12, top, c.x2 - c.x1 + 24, 3000);
  }
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const x0 = Math.floor(vis.x1 / step) * step - step;
  ctx.moveTo(x0, groundY(x0) + 6);
  for (let x = x0 + step; x <= vis.x2 + step; x += step) ctx.lineTo(x, groundY(x) + 6);
  ctx.stroke();
}

// Trees: a light crown and the trunk, behind everything (the branches are ledges, drawn later).
const CROWN = [[0, -70, 75], [-60, -30, 55], [60, -30, 55], [-35, 15, 45], [40, 15, 45], [0, -10, 60]];
function drawTrees() {
  for (const t of M.terrain.trees) {
    const cy = t.top - 70;
    ctx.fillStyle = '#f1f1f1';
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 4;
    for (const method of ['stroke', 'fill']) {
      for (const [dx, dy, r] of CROWN) {
        ctx.beginPath();
        ctx.arc(t.x + dx, cy + dy, r, 0, Math.PI * 2);
        ctx[method]();
      }
    }
    ctx.strokeStyle = '#555';
    ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    line(t.x, t.y + 4, t.x, cy + 20);
  }
}

// Ledges: branches, wooden ledges on posts (and the 2 v 2 platforms, which have no posts).
function drawLedges() {
  ctx.lineCap = 'round';
  for (const p of M.platforms) {
    ctx.strokeStyle = '#000';
    if (p.look === 'branch') {
      ctx.lineWidth = 9;
      line(p.x1, p.y + 5, p.x2, p.y + 5);
      ctx.lineWidth = 4;                              // a twig at the outer end
      const out = Math.sign(p.tip - (p.x1 + p.x2) / 2);
      line(p.tip - out * 14, p.y + 5, p.tip, p.y - 12);
      continue;
    }
    if (!p.start) {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 6;
      for (const x of [p.x1 + 15, p.x2 - 15]) line(x, p.y + 8, x, groundY(x) + 4);
      ctx.strokeStyle = '#000';
    }
    ctx.lineWidth = 10;
    line(p.x1, p.y + 5, p.x2, p.y + 5);
  }
}

// posts marking how far back each side can walk
function drawBorders() {
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  for (const x of [-EDGE_OUT, M.D + EDGE_OUT]) {
    const gy = groundY(x);
    ctx.lineWidth = 8;
    line(x, gy, x, gy - 90);
    ctx.lineWidth = 5;
    line(x - 14, gy - 70, x + 14, gy - 70);
  }
}

function drawAimGuides(f) {
  const P = getPose(f);
  ctx.lineWidth = 2 / cam.z;
  ctx.setLineDash([6 / cam.z, 8 / cam.z]);
  const len = 70 + 120 * (f.drawing ? f.power : 0);
  ctx.strokeStyle = '#999';
  line(P.bowHand.x + P.d.x * 30, P.bowHand.y + P.d.y * 30, P.bowHand.x + P.d.x * len, P.bowHand.y + P.d.y * len);
  ctx.setLineDash([]);
}

function drawFlyingArrow(a) {
  ctx.lineCap = 'round';
  for (let i = 1; i < a.trail.length; i++) {
    const k = i / a.trail.length;
    ctx.strokeStyle = `rgba(0,0,0,${0.22 * k})`;
    ctx.lineWidth = 1 + 3 * k;
    line(a.trail[i - 1].x, a.trail[i - 1].y, a.trail[i].x, a.trail[i].y);
  }
  drawArrow(a.x, a.y, Math.atan2(a.vy, a.vx), '#000', Math.sin(T * 50) * 1.5, a.kind);
}

function drawParticles() {
  for (const p of M.particles) {
    const k = 1 - p.t / p.life;
    if (p.kind === 'speck') {
      ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = `rgba(0,0,0,${0.35 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 6 + 34 * (1 - k), 3 + 10 * (1 - k), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'blood') {
      ctx.fillStyle = BLOOD;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * 1.25, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'shred') {                 // bits of a popped balloon
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = k;
      ctx.lineWidth = 4;
      const a = p.rot + p.t * 12;
      line(p.x - Math.cos(a) * 6, p.y - Math.sin(a) * 6, p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6);
      ctx.globalAlpha = 1;
    } else if (p.kind === 'blast') {
      const r = 15 + (p.r - 15) * (1 - k * k);
      ctx.fillStyle = `rgba(0,0,0,${0.12 * k})`;
      ctx.strokeStyle = `rgba(0,0,0,${0.6 * k})`;
      ctx.lineWidth = 6 * k + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(0,0,0,${k})`;
      ctx.lineWidth = 3;
      line(p.x, p.y, p.x - p.vx * 0.05, p.y - p.vy * 0.05);
    }
  }
}

// blood on the ground: splatters from drops, and a pool under each body
function drawStains() {
  ctx.fillStyle = BLOOD;
  for (const s of M.stains) {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 1, s.r * 1.7, s.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of M.pools) {
    if (p.r < 1) continue;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1, p.r, p.r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBalloons() {
  if (M.phase === 'roundOver' || M.phase === 'matchOver') return;   // keep the result banner clear
  for (const b of M.balloons) {
    const info = POWERUPS[b.type];
    const s = Math.min(1, b.age / 0.4);           // grows in when it appears
    const sway = Math.sin(T * 1.7 + b.phase) * 0.08;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(sway);
    ctx.scale(s, s);
    ctx.strokeStyle = '#555';                       // string
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.bezierCurveTo(10, 55, -10, 70, 4, 95);
    ctx.stroke();
    ctx.fillStyle = info.color;                     // balloon + knot
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 38);
    ctx.lineTo(5, 38);
    ctx.lineTo(0, 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';       // shine
    ctx.beginPath();
    ctx.ellipse(-10, -14, 6, 10, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const p = toScreen(b.x, b.y);                   // label stays readable at any zoom
    screenTransform();
    text(info.label, p.x, p.y + 1, Math.max(11, 13 * cam.z), '#fff');
    worldTransform(false);
  }
}

export function drawMatch() {
  const vis = visibleWorld();
  worldTransform(!M.paused);   // no shaking while paused
  drawClouds();
  drawTrees();
  for (const s of M.stuck) drawArrow(s.x, s.y, s.ang + Math.sin(T * 45) * 0.2 * s.wob);
  drawTerrain(vis);
  drawBorders();
  drawLedges();
  drawStains();
  drawBalloons();
  for (const f of M.fighters) {
    if (f.gone) continue;
    const ready = inPlay(f) && !f.blocking && !f.cd.shot;
    drawStickman(f, f.minion ? '#333' : '#000', f.alive && (f.drawing || ready));
    if (ready && !f.isBot) drawAimGuides(f);
  }
  for (const a of M.arrows) drawFlyingArrow(a);
  drawParticles();

  screenTransform();
  if (settings.wind && M.wind) drawStreaks();
  for (const f of M.fighters) drawFighterOverlay(f);
  for (const p of M.popups) {
    const s = toScreen(p.x, p.y);
    ctx.globalAlpha = Math.max(0, 1 - p.t / 1.4);
    text(p.text, s.x, s.y - p.t * 40, p.big ? 30 : 22, p.color || '#000');
    ctx.globalAlpha = 1;
  }
  drawHUD();
}
