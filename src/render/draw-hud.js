// Screen-space overlays during a match: names and meters, score, banners.
import { H, W } from '../config.js';
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { POWERUPS } from '../data/powerups.js';
import { getPose } from '../game/fighter.js';
import { M, sideName, teamMembers, teamName, winnerName } from '../game/match.js';
import { PAUSE_ITEMS } from '../screens/pause.js';
import { toScreen } from './camera.js';
import { ctx, text, view } from './canvas.js';

function bar(x, y, w, h, frac, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), h);
  ctx.strokeRect(x - w / 2, y, w, h);
}

// Name, health, and (for archers) shield and ultimate meters, and what they're carrying.
export function drawFighterOverlay(f) {
  if (!f.alive) return;
  const P = getPose(f);
  const head = toScreen(P.head.x, P.head.y - 20 * f.size);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#000';
  if (f.minion) {
    ctx.lineWidth = 1;
    bar(head.x, head.y - 10, 26, 3, f.hp / f.maxHp, '#777');
    return;
  }
  const top = head.y - 4;
  const u = f.cls.ultimate, ultFull = u && f.ult >= u.charge;
  bar(head.x, top - 22, 54, 6, f.hp / f.maxHp, '#000');
  if (f.shield) bar(head.x, top - 14, 54, 3, f.shieldHp / f.shield.durability, f.shieldBroken ? '#d93636' : '#888');
  if (u) bar(head.x, top - 9, 54, 3, f.ult / u.charge, ultFull && Math.sin(T * 8) > 0 ? '#ffd24a' : '#c99a12');
  text(f.name, head.x, top - 36, 20, f.color);

  // badges: potions, power-up for the next shot, ultimate, shaky arm, broken shield
  const badges = [];
  if (f.cls.potions) badges.push(['✚' + f.potions, f.potions ? '#2c9e4b' : '#bbb']);
  if (f.ultArmed) badges.push([u.name, '#c99a12']);
  else if (ultFull) badges.push(['△ ULT', '#c99a12']);
  if (f.nextShot) badges.push([POWERUPS[f.nextShot].label, POWERUPS[f.nextShot].color]);
  if (f.shieldBroken) badges.push(['NO SHIELD', '#d93636']);
  if (f.shaky > 0) badges.push(['SHAKY', '#888']);
  let bx = head.x + 34;
  ctx.font = 'bold 12px system-ui, "Segoe UI", sans-serif';
  for (const [label, color] of badges) {
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, top - 45, w, 18, 9);
    ctx.fill();
    text(label, bx + w / 2, top - 35.5, 12, '#fff', 'bold');
    bx += w + 4;
  }

  if (f.drawing && !f.isBot) {
    const len = 70 + 120 * f.power + 26;
    const s = toScreen(P.bowHand.x + P.d.x * len, P.bowHand.y + P.d.y * len);
    text(Math.round(f.power * 100) + '%', s.x, s.y, 16, '#555');
  }
}

function drawWindIndicator(x, y) {
  const dir = Math.sign(M.wind), level = Math.ceil(Math.abs(M.wind) * 3);
  text('WIND', x, y - 28, 15, '#777');
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let j = 0; j < 3; j++) {           // j counts downwind; the pulse travels with the wind
    const cx = x + dir * (j - 1) * 24;
    const pulse = 0.5 + 0.5 * Math.sin(T * 7 - j * 1.3);
    ctx.strokeStyle = j < level ? `rgba(0,0,0,${0.3 + 0.7 * pulse})` : '#e2e2e2';
    ctx.beginPath();
    ctx.moveTo(cx - dir * 7, y - 11);
    ctx.lineTo(cx + dir * 7, y);
    ctx.lineTo(cx - dir * 7, y + 11);
    ctx.stroke();
  }
  text(`favors ${sideName(dir > 0 ? 'L' : 'R')}`, x, y + 28, 15, '#555', 'normal');
}

export function drawStreaks() {
  const dir = Math.sign(M.wind);
  ctx.strokeStyle = 'rgba(0,0,0,0.09)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const s of M.streaks) {
    const len = s.len * Math.abs(M.wind);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(s.x - dir * len / 2, s.y + Math.sin(T * 3 + s.y) * 5, s.x - dir * len, s.y);
    ctx.stroke();
  }
}

// Teams: "TEAM 1  2 : 1  TEAM 2". Free-for-all: every archer's name and rounds won.
function drawScore(y, size) {
  if (!M.ffa) {
    text(`${teamName('L')}   ${M.score.L} : ${M.score.R}   ${teamName('R')}`, W / 2, y, size);
    return;
  }
  const parts = M.roster.map(r => [`${r.name} ${M.score[r.name]}`, r.color]);
  ctx.font = `bold ${size}px system-ui, "Segoe UI", sans-serif`;
  const gap = size * 1.4;
  const total = parts.reduce((w, [t]) => w + ctx.measureText(t).width, 0) + gap * (parts.length - 1);
  let x = W / 2 - total / 2;
  for (const [t, color] of parts) {
    text(t, x, y, size, color, 'bold', 'left');
    x += ctx.measureText(t).width + gap;
  }
}

export function drawHUD() {
  drawScore(36, M.ffa ? 26 : 30);
  text(`Round ${M.round}  ·  best of ${settings.rounds}${M.ffa ? '  ·  free-for-all' : ''}`, W / 2, 68, 17, '#777', 'normal');

  if (settings.wind && M.wind) drawWindIndicator(W - 150, 56);

  if (M.phase === 'roundIntro') {
    text(`ROUND ${M.round}`, W / 2, 330, 90);
    if (settings.wind && M.wind) text(`Wind favors ${sideName(M.wind > 0 ? 'L' : 'R')}`, W / 2, 400, 26, '#555', 'normal');
  } else if (M.phase === 'roundOver') {
    const w = M.roundWinner;
    if (!w) {
      text(`ROUND ${M.round} IS A DRAW`, W / 2, 300, 72);
    } else {
      text(`${winnerName(w)} WINS ROUND ${M.round}`, W / 2, 300, 72);
      if (!M.ffa && teamName(w).startsWith('TEAM')) text(teamMembers(w), W / 2, 360, 26, '#555', 'normal');
    }
  } else if (M.phase === 'matchOver') {
    const w = M.roundWinner;
    text(`${winnerName(w)} WINS THE MATCH!`, W / 2, 290, 76);
    if (M.ffa) drawScore(365, 30);
    else text(`${M.score.L} : ${M.score.R}`, W / 2, 365, 40, '#000', 'normal');
    text('Hold LT + RT to continue', W / 2, 425, 24, '#777', 'normal');
  } else if (M.banner) {
    ctx.globalAlpha = Math.min(1, M.banner.t * 2);
    text(M.banner.text, W / 2, 330, 72);
    ctx.globalAlpha = 1;
  }
  if (M.paused) drawPauseMenu();
}

function drawPauseMenu() {
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(view.left, 0, view.right - view.left, H);
  text('PAUSED', W / 2, 270, 80);
  PAUSE_ITEMS.forEach((item, i) => {
    const y = 380 + i * 70, on = i === M.paused.sel;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 140, y - 26, 280, 52, 8);
    ctx.fillStyle = on ? '#000' : '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    text(item, W / 2, y, 26, on ? '#fff' : '#000');
  });
  text('↑ ↓ pick  ·  ✕ choose  ·  START continue      (keyboard: ↑ ↓  ·  J  ·  Esc)', W / 2, 620, 17, '#777', 'normal');
}
