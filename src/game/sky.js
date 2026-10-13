// Background: drifting clouds, and wind streaks on the screen.
import { W, H } from '../config.js';
import { rand } from '../util.js';
import { M } from './match.js';

export const CLOUD_SPAN = 7000, CLOUD_PARALLAX = 0.5;
export const CLOUD_PUFFS = [[-45, 5, 24], [-15, -12, 32], [22, -6, 28], [50, 8, 20], [0, 12, 26]];
export const makeClouds = () => Array.from({ length: 16 }, () => ({ x: rand(0, CLOUD_SPAN), y: rand(-950, -380), s: rand(0.7, 1.5) }));
export const makeStreaks = () => Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, H), len: rand(30, 90), sp: rand(0.6, 1.4) }));

export function updateSky(dt) {
  M.cloudDrift += (8 + M.wind * 60) * dt;
  for (const s of M.streaks) {
    s.x += M.wind * 700 * s.sp * dt;
    if (s.x > W + 100) s.x -= W + 200;
    if (s.x < -100) s.x += W + 200;
  }
}
