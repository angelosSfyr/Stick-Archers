// Terrain: a height map built from an arena (src/data/arenas.js).
// World x = 0 is team 1's 1st player, x = D is team 2's. y grows downwards, ground at the bases is 0.
import { ARENAS } from '../data/arenas.js';
import { lerp } from '../util.js';
import { M } from './match.js';

export function makeTerrain(arenaId, D) {
  const arena = ARENAS[arenaId];
  const params = arena.setup ? arena.setup(D) : null;
  const step = 10, x0 = -3000, x1 = D + 3000;
  const ys = new Float32Array(Math.ceil((x1 - x0) / step) + 1);
  for (let i = 0; i < ys.length; i++) {
    const x = x0 + i * step;
    ys[i] = arena.height(x / D, Math.min(x, D - x), D, params);
  }
  const t = { x0, step, ys, minY: 0, maxY: 0 };   // highest / lowest ground between the teams
  for (let x = 0; x <= D; x += step) {
    t.minY = Math.min(t.minY, sampleTerrain(t, x));
    t.maxY = Math.max(t.maxY, sampleTerrain(t, x));
  }
  return t;
}

function sampleTerrain(t, x) {
  const f = (x - t.x0) / t.step, i = Math.floor(f);
  if (i < 0) return t.ys[0];
  if (i >= t.ys.length - 1) return t.ys[t.ys.length - 1];
  return lerp(t.ys[i], t.ys[i + 1], f - i);
}
export const groundY = x => sampleTerrain(M.terrain, x);

export function solidAt(x, y) {
  if (y >= groundY(x)) return true;
  return M.platforms.some(p => x >= p.x1 && x <= p.x2 && y >= p.y && y <= p.y + 10);
}
