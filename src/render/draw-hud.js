// Screen-space overlays during a match: names and health bars, score, turn timer, banners.
import { W } from '../config.js';
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { POWERUPS } from '../data/powerups.js';
import { getPose } from '../game/fighter.js';
import { M, isActive, sideName, teamMembers, teamName, winnerName } from '../game/match.js';
import { toScreen } from './camera.js';
import { ctx, text } from './canvas.js';

export function drawFighterOverlay(f) {
  if (!f.alive) return;
  const head = toScreen(f.x, f.y - 145);
  const top = head.y - 16;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.fillRect(head.x - 27, top - 6, 54 * f.hp / f.maxHp, 6);
  ctx.strokeRect(head.x - 27, top - 6, 54, 6);
  text(f.name, head.x, top - 20, 20, f.color);

  // what this archer is carrying: a power-up for the next shot, a shaky arm
  const badges = [];
  if (f.nextShot) badges.push([POWERUPS[f.nextShot].label, POWERUPS[f.nextShot].color]);
  if (f.shaky > 0) badges.push(['SHAKY', '#888']);
  let bx = head.x + 34;
  ctx.font = 'bold 12px system-ui, "Segoe UI", sans-serif';
  for (const [label, color] of badges) {
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, top - 29, w, 18, 9);
    ctx.fill();
    text(label, bx + w / 2, top - 19.5, 12, '#fff', 'bold');
    bx += w + 4;
  }

  if (!isActive(f)) return;
  if (f.locked) {
    text('✓ locked in', head.x, top - 44, 15, '#1a9e4b');
  } else if (M.turns !== 'all') {
    const y = top - 46 + Math.sin(T * 6) * 4;   // bobbing "your turn" marker
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.moveTo(head.x - 10, y - 8);
    ctx.lineTo(head.x + 10, y - 8);
    ctx.lineTo(head.x, y + 6);
    ctx.closePath();
    ctx.fill();
  }
  if (f.drawing && !f.locked && !f.isBot) {
    const P = getPose(f), len = 70 + 120 * f.power + 26;
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

  const turnShown = (M.phase === 'play' || M.phase === 'roundIntro') && M.handoff === null && M.endT === null;
  if (turnShown && M.turns === 'all') {
    text('Everyone shoot!', W / 2, 104, 28);
  } else if (turnShown && M.shooters.length) {
    const single = M.shooters.length === 1;
    const who = single ? M.shooters[0].name : teamName(M.side);
    text(`${who}'s turn`, W / 2, 104, 28, single ? M.shooters[0].color : '#000');
    if (settings.turnTime) {
      const left = Math.max(0, M.turnLeft);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = left < 3 ? '#d93636' : '#000';
      ctx.fillRect(W / 2 - 120, 128, 240 * left / settings.turnTime, 8);
      ctx.strokeRect(W / 2 - 120, 128, 240, 8);
      text(Math.ceil(left) + 's', W / 2 + 148, 132, 16, left < 3 ? '#d93636' : '#000');
    }
    if (!single) text('release RT to lock in your shot - the team shoots together', W / 2, 156, 15, '#777', 'normal');
  }
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
}
