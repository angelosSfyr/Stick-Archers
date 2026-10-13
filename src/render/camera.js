// Camera: what part of the world is on screen, and the transforms to draw it.
import { H, OWN_VIEW_ZOOM, W } from '../config.js';
import { settings } from '../core/settings.js';
import { M } from '../game/match.js';
import { groundY } from '../game/terrain.js';
import { clamp, lerp } from '../util.js';
import { canvas, ctx, view } from './canvas.js';

export const cam = { x: 0, y: 0, z: 1 };
const HUD_RESERVE = 150;   // screen space kept free at the top for the score

function grow(b, x, y, r) {
  if (!b) return { x1: x - r, x2: x + r, y1: y - r, y2: y + r };
  return { x1: Math.min(b.x1, x - r), x2: Math.max(b.x2, x + r), y1: Math.min(b.y1, y - r), y2: Math.max(b.y2, y + r) };
}

function fitBox(b, maxZ, minZ, reserve) {
  const z = clamp(Math.min(W / (b.x2 - b.x1), (H - reserve) / (b.y2 - b.y1)), minZ, maxZ);
  return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 - reserve / 2 / z, z };
}

// Like fitBox, but spare height goes to the sky: the box bottom sits near the screen bottom.
function fitBoxGrounded(b, maxZ, minZ) {
  const margin = 40;
  const z = clamp(Math.min(W / (b.x2 - b.x1), (H - HUD_RESERVE - margin) / (b.y2 - b.y1)), minZ, maxZ);
  return { x: (b.x1 + b.x2) / 2, y: b.y2 - (H / 2 - margin) / z, z };
}

function cameraTarget() {
  // "Everyone at the same time" always shows both teams: nobody's view can be the "own" one.
  if (settings.view === 'both' || M.turns === 'all' || M.phase === 'matchOver') {
    let b = null;
    for (const f of M.fighters) b = grow(b, f.x, f.y - 70, 160);
    b.y1 = Math.min(b.y1 - 60, M.terrain.minY - 120);
    b.y2 = Math.max(Math.max(...M.fighters.map(f => f.y)) + 30, M.terrain.maxY + 30);
    for (const a of M.arrows) b = grow(b, a.x, a.y, 200);
    return fitBoxGrounded(b, 1, 0.25);
  }
  // "only my team": chase the latest arrows, show where they landed, then the shooting team
  if (M.arrows.length) {
    const latest = Math.max(...M.arrows.map(a => a.volley));
    let b = null;
    for (const a of M.arrows) if (a.volley === latest) b = grow(b, a.x + a.vx * 0.3, a.y + a.vy * 0.15, 0);
    b = { x1: b.x1 - 500, x2: b.x2 + 500, y1: b.y1 - 300, y2: b.y2 + 300 };
    return fitBox(b, OWN_VIEW_ZOOM, 0.45, 0);
  }
  if ((M.impactHold > 0 || M.phase === 'roundOver') && M.lastImpact) {
    return { x: M.lastImpact.x, y: M.lastImpact.y - 260, z: OWN_VIEW_ZOOM };
  }
  const baseX = M.side === 'L' ? 0 : M.D, facing = M.side === 'L' ? 1 : -1;
  return { x: baseX + facing * 230, y: groundY(baseX) - 260, z: OWN_VIEW_ZOOM };
}

export function updateCamera(dt, snap) {
  const t = cameraTarget();
  const k = snap ? 1 : 1 - Math.exp(-dt * (M.arrows.length ? 5 : 3));
  cam.x += (t.x - cam.x) * k;
  cam.y += (t.y - cam.y) * k;
  cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(t.z), k));
}

const jitter = { x: 0, y: 0 };    // screen shake, picked once per frame
export function worldTransform(newShake = true) {
  if (newShake) {
    jitter.x = M.shake > 0 ? (Math.random() - 0.5) * 30 * M.shake : 0;
    jitter.y = M.shake > 0 ? (Math.random() - 0.5) * 30 * M.shake : 0;
  }
  const s = view.s * cam.z;
  ctx.setTransform(s, 0, 0, s, view.ox + view.s * (W / 2 + jitter.x) - cam.x * s, view.oy + view.s * (H / 2 + jitter.y) - cam.y * s);
}

export function screenTransform() {
  ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
}

export function visibleWorld() {
  const s = view.s * cam.z;
  const ox = view.ox + view.s * W / 2 - cam.x * s, oy = view.oy + view.s * H / 2 - cam.y * s;
  return { x1: -ox / s, x2: (canvas.width - ox) / s, y1: -oy / s, y2: (canvas.height - oy) / s };
}

export const toScreen = (x, y) => ({ x: (x - cam.x) * cam.z + W / 2, y: (y - cam.y) * cam.z + H / 2 });
