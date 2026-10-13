// Arenas: the shape of the ground. Both teams stand on flat ground; the shape is in between.
// height(u, m, D, params) gives the ground height at one point (y grows downwards,
// 0 = the ground the teams stand on, so negative is a hill):
//   u:      0 at team 1, 1 at team 2 (can go past both ends)
//   m:      distance in px from the nearest team (negative behind it)
//   D:      distance between the teams
//   params: whatever setup(D) returned, for arenas that are random
// Steep steps in the ground (see `cliff`) are walls: fighters have to jump up them.
// ledges(D, params): what stands on team 1's side, by m; it's mirrored onto team 2's side.
//   { tree: m, branches: [rise, ...] }   a tree with branches to stand on, alternating sides
//                                        of the trunk (the first one toward the middle)
//   { ledge: m, w, rise }                a wooden ledge on posts, centred on m
//   rise is px above the ground. Fighters jump up through ledges and land on top; ↓ + ✕ drops
//   back down. An archer jumps 420 px, so keep each level within ~380 of the one below it.
// newEachRound: build a fresh one every round instead of once per match.
// middle: 'canyon' cuts a deadly canyon into the middle of the map. Every arena needs something
//         in the middle that splits the sides: a canyon, or a hill in its own height().
// The settings screen lists arenas in this order.
import { MID_STOP } from '../config.js';
import { bump, clamp, lerp, pick, rand, smoothstep } from '../util.js';

// keeps the ground flat near both teams
const nearBases = m => smoothstep(150, 450, m);
// a sharp step of h px at m = at (positive steps down toward the middle, negative up)
const cliff = (m, at, h) => h * smoothstep(at - 5, at + 5, m);
// a raised rock shelf h px high behind each team, to fall back to
const shelf = (m, h) => -h * smoothstep(-225, -235, m);
// a spot between a team and the furthest it can walk toward the middle (k: 0 near, 1 far)
const front = (D, k) => lerp(240, D / 2 - MID_STOP - 70, k);
// a smooth 0..1 shape cut into n flat steps
const stairs = (v, n) => (Math.floor(v * n) + smoothstep(0.8, 1, (v * n) % 1)) / n;

const tallTree = m => ({ tree: m, branches: [150, 290, 430] });

export const ARENAS = {
  flat: {
    name: 'Flat', middle: 'canyon', height: () => 0,
    ledges: D => [tallTree(-330), { ledge: front(D, 1), w: 150, rise: 190 },
                  ...(D >= 1500 ? [{ tree: front(D, 0), branches: [170, 330] }] : [])],
  },

  hills: {
    name: 'Hills',
    height: (u, m) => shelf(m, 150) - (170 * bump(u, 0.27, 0.09) + 230 * bump(u, 0.5, 0.08) + 170 * bump(u, 0.73, 0.09)) * nearBases(m),
    ledges: D => [{ tree: -340, branches: [160, 320] }, { tree: front(D, 0.15), branches: [180, 340] }],
  },

  valley: {
    name: 'Valley', middle: 'canyon',
    // the teams stand on a plateau; the ground steps down into the valley
    height: (u, m) => shelf(m, 140) + cliff(m, 210, 140) + cliff(m, 300, 140) + cliff(m, 390, 140),
    ledges: D => [tallTree(-340), { ledge: front(D, 1), w: 140, rise: 220 }],
  },

  mountain: {
    name: 'Mountain',
    // terraces up the mountain, each a jump high
    height: (u, m, D) => {
      const top = clamp(D * 0.28, 300, 700);
      return shelf(m, 120) - top * stairs(bump(u, 0.5, 0.15) * nearBases(m), Math.round(top / 130));
    },
    ledges: D => [{ tree: -330, branches: [170, 340] }, { ledge: front(D, 0.1), w: 130, rise: 200 }],
  },

  random: {
    name: 'Random (new each round)',
    newEachRound: true,
    middle: 'canyon',
    setup: D => ({
      waves: Array.from({ length: 4 }, () => ({ a: rand(-1, 1), k: rand(1, 4), ph: rand(0, Math.PI * 2) })),
      shelf: pick([0, 120, 170]),
      ledges: [
        Math.random() < 0.5 ? tallTree(-330) : { tree: -330, branches: [rand(140, 200), rand(300, 360)] },
        pick([{ tree: front(D, rand(0, 0.4)), branches: [rand(150, 200), rand(300, 350)] },
              { ledge: front(D, rand(0, 0.4)), w: rand(110, 170), rise: rand(150, 260) }]),
        ...(D >= 1500 ? [{ ledge: front(D, 1), w: rand(110, 170), rise: rand(150, 260) }] : []),
      ],
    }),
    height(u, m, D, p) {
      let g = 0;                           // mirrored, so neither side gets the better ground
      for (const v of p.waves) g += v.a * (Math.sin(v.k * Math.PI * u + v.ph) + Math.sin(v.k * Math.PI * (1 - u) + v.ph));
      return g * 45 * nearBases(m) + shelf(m, p.shelf);
    },
    ledges: (D, p) => p.ledges,
  },
};
