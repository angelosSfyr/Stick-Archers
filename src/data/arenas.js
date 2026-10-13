// Arenas: the shape of the ground. Both teams stand on flat ground; the shape is in between.
// height(u, m, D, params) gives the ground height at one point (y grows downwards,
// 0 = the ground the teams stand on, so negative is a hill):
//   u:      0 at team 1, 1 at team 2 (can go past both ends)
//   m:      distance in px from the nearest team (negative behind it)
//   D:      distance between the teams
//   params: whatever setup(D) returned, for arenas that are random
// newEachRound: build a fresh one every round instead of once per match.
// The settings screen lists arenas in this order.
import { bump, clamp, rand, smoothstep } from '../util.js';

// keeps the ground flat near both teams
const nearBases = m => smoothstep(150, 450, m);

export const ARENAS = {
  flat: { name: 'Flat', height: () => 0 },

  hills: {
    name: 'Hills',
    height: (u, m) => -(170 * bump(u, 0.27, 0.09) + 110 * bump(u, 0.5, 0.08) + 170 * bump(u, 0.73, 0.09)) * nearBases(m),
  },

  valley: { name: 'Valley', height: (u, m) => 420 * smoothstep(180, 340, m) },

  mountain: { name: 'Mountain', height: (u, m, D) => -clamp(D * 0.28, 300, 700) * bump(u, 0.5, 0.15) * nearBases(m) },

  random: {
    name: 'Random (new each round)',
    newEachRound: true,
    setup: () => Array.from({ length: 4 }, () => ({ a: rand(-1, 1), k: rand(1, 4), ph: rand(0, Math.PI * 2) })),
    height(u, m, D, waves) {
      let g = 0;                           // mirrored, so neither side gets the better ground
      for (const v of waves) g += v.a * (Math.sin(v.k * Math.PI * u + v.ph) + Math.sin(v.k * Math.PI * (1 - u) + v.ph));
      return g * 45 * nearBases(m);
    },
  },
};
