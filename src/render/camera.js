// Camera: what part of the world is on screen, and the transforms to draw it.
import { H, W } from '../config.js';
import { M } from '../game/match.js';
import { clamp, lerp } from '../util.js';
import { canvas, ctx, view } from './canvas.js';

export const cam = { x: 0, y: 0, z: 1 };
const HUD_RESERVE = 150;   // screen space kept free at the top for the score

function grow(b, x, y, r) {
  if (!b) return { x1: x - r, x2: x + r, y1: y - r, y2: y + r };
  return { x1: Math.min(b.x1, x - r), x2: Math.max(b.x2, x + r), y1: Math.min(b.y1, y - r), y2: Math.max(b.y2, y + r) };
}

// Fits a box on screen; spare height goes to the sky: the box bottom sits near the screen bottom.
function fitBoxGrounded(b, maxZ, minZ) {
  const margin = 40;
  const z = clamp(Math.min(W / (b.x2 - b.x1), (H - HUD_RESERVE - margin) / (b.y2 - b.y1)), minZ, maxZ);
  return { x: (b.x1 + b.x2) / 2, y: b.y2 - (H / 2 - margin) / z, z };
}

// Both teams, their minions and the shots in the air (not what fell into a canyon).
function cameraTarget() {
  const shown = M.fighters.filter(f => f.y < M.terrain.maxY + 200);
  let b = grow(null, M.D / 2, 0, 300);
  for (const f of shown) b = grow(b, f.x, f.y - 70, 160);
  b.y1 = Math.min(b.y1 - 60, M.terrain.minY - 120);
  b.y2 = Math.max(Math.max(...shown.map(f => f.y)) + 30, M.terrain.maxY + 30);
  for (const a of M.arrows) if (a.y < M.terrain.maxY + 200) b = grow(b, a.x, a.y, 200);
  return fitBoxGrounded(b, 1, 0.25);
}

export function updateCamera(dt, snap) {
  const t = cameraTarget();
  const k = snap ? 1 : 1 - Math.exp(-dt * 3);
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
