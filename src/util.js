export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mod = (a, n) => ((a % n) + n) % n;
export const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const bump = (u, c, w) => Math.exp(-(((u - c) / w) ** 2));
export const opp = side => side === 'L' ? 'R' : 'L';
export const pick = list => list[Math.floor(Math.random() * list.length)];

export function distToSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp(((px - a.x) * dx + (py - a.y) * dy) / len2, 0, 1) : 0;
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
