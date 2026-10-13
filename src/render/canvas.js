// The canvas, its scaling to the window, and small drawing helpers.
import { H, W } from '../config.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
export const view = { s: 1, ox: 0, oy: 0, left: 0, right: W };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  view.s = Math.min(canvas.width / W, canvas.height / H);
  view.ox = (canvas.width - W * view.s) / 2;
  view.oy = (canvas.height - H * view.s) / 2;
  view.left = -view.ox / view.s;
  view.right = (canvas.width - view.ox) / view.s;
}
addEventListener('resize', resize);
resize();

export function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function text(str, x, y, size, color = '#000', weight = 'bold', align = 'center') {
  ctx.font = `${weight} ${size}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}
