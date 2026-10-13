// Terrain: a height map built from an arena (src/data/arenas.js).
// World x = 0 is team 1's 1st player, x = D is team 2's. y grows downwards, ground at the bases is 0.
import { CANYON_HALF } from '../config.js';
import { ARENAS } from '../data/arenas.js';
import { lerp, smoothstep } from '../util.js';
import { M } from './match.js';

const CANYON_DEPTH = 2500;

export function makeTerrain(arenaId, D) {
  const arena = ARENAS[arenaId];
  const params = arena.setup ? arena.setup(D) : null;
  const step = 10, x0 = -3000, x1 = D + 3000;
  const ys = new Float32Array(Math.ceil((x1 - x0) / step) + 1);
  for (let i = 0; i < ys.length; i++) {
    const x = x0 + i * step;
    ys[i] = arena.height(x / D, Math.min(x, D - x), D, params);
  }
  const t = { x0, step, ys, minY: 0, maxY: 0 };   // highest / lowest ground between the teams (canyon left out)
  for (let x = 0; x <= D; x += step) {
    t.minY = Math.min(t.minY, sampleTerrain(t, x));
    t.maxY = Math.max(t.maxY, sampleTerrain(t, x));
  }
  t.canyon = arena.middle === 'canyon' ? { x1: D / 2 - CANYON_HALF, x2: D / 2 + CANYON_HALF } : null;
  if (t.canyon) {
    for (let i = 0; i < ys.length; i++) {
      ys[i] += CANYON_DEPTH * smoothstep(CANYON_HALF + 12, CANYON_HALF - 12, Math.abs(x0 + i * step - D / 2));
    }
  }
  placeLedges(t, arena.ledges ? arena.ledges(D, params) : [], D);
  return t;
}

// Ledges (one-way platforms: branches and wooden ledges) and the trees they hang on, from the
// arena's list for team 1's side, mirrored onto team 2's so neither gets the better ones.
function placeLedges(t, list, D) {
  t.ledges = [];
  t.trees = [];
  const highestGround = (x1, x2) => {
    let y = Infinity;
    for (let x = x1; x <= x2; x += 5) y = Math.min(y, sampleTerrain(t, x));
    return y;
  };
  for (const side of [1, -1]) {
    const X = m => side > 0 ? m : D - m;
    // never sunk into the ground, even on a slope
    const ledge = (m1, m2, y, look) => {
      const x1 = Math.min(X(m1), X(m2)), x2 = Math.max(X(m1), X(m2));
      const p = { x1, x2, y: Math.min(y, highestGround(x1, x2) - 50), look };
      t.ledges.push(p);
      return p;
    };
    for (const d of list) {
      if (d.tree !== undefined) {
        const x = X(d.tree), base = sampleTerrain(t, x);
        const branches = d.branches.map((rise, i) => {
          const tip = d.tree + (i % 2 ? -1 : 1) * 120;
          return Object.assign(ledge(d.tree, tip, base - rise, 'branch'), { tip: X(tip) });
        });
        t.trees.push({ x, y: base, top: Math.min(...branches.map(b => b.y)) });
      } else {
        ledge(d.ledge - d.w / 2, d.ledge + d.w / 2, sampleTerrain(t, X(d.ledge)) - d.rise, 'plank');
      }
    }
  }
}

function sampleTerrain(t, x) {
  const f = (x - t.x0) / t.step, i = Math.floor(f);
  if (i < 0) return t.ys[0];
  if (i >= t.ys.length - 1) return t.ys[t.ys.length - 1];
  return lerp(t.ys[i], t.ys[i + 1], f - i);
}
export const groundY = x => sampleTerrain(M.terrain, x);

// A step in the ground too steep to walk up: you have to jump it.
const STEP_UP = 40;
export const wallAhead = (x, y, dir, reach = 8) => !!dir && groundY(x + dir * reach) < y - STEP_UP;

// Below this a fighter has fallen into the canyon.
export const deathDepth = () => M.terrain.maxY + 500;

export function solidAt(x, y) {
  if (y >= groundY(x)) return true;
  return M.platforms.some(p => x >= p.x1 && x <= p.x2 && y >= p.y && y <= p.y + 10);
}
