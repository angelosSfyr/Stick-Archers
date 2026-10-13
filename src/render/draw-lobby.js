// The lobby screen. Its logic is in src/screens/lobby.js.
import { BOT_COLOR, HOLD_TIME, PLAYER_COLORS, W } from '../config.js';
import { settings, settingsSummary } from '../core/settings.js';
import { padState, pads } from '../core/input.js';
import { CLASSES, DEFAULT_CLASS } from '../data/classes.js';
import { WEAPONS } from '../data/weapons.js';
import { countdownT, GEAR, humans, LOBBY_SLOTS, lobbyStatus, slotIsHigh } from '../screens/lobby.js';
import { ctx, line, text, view } from './canvas.js';
import { drawStickman } from './draw-common.js';

function drawGear(x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    line(x + Math.cos(a) * 22, y + Math.sin(a) * 22, x + Math.cos(a) * 31, y + Math.sin(a) * 31);
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHumanLabels(list, x, y, crowded, showClass) {
  for (const h of list) {
    const p = padState(h.pad);
    const clash = crowded || h.flash > 0;
    const name = 'P' + h.num + (h.pad === 'kb' ? ' ⌨' : '') + (clash ? ' !' : '');
    text(name, x, y, p.lt || p.rt ? 28 : 24, clash ? '#d93636' : PLAYER_COLORS[h.num - 1]);
    if (showClass) text(CLASSES[h.cls].name.toUpperCase() + (h.ready ? '' : '  △'), x, y + 22, 14, '#555');
    const ry = y + (showClass ? 40 : 22);
    if (h.ready) {
      text('READY', x, ry, 15, '#1a9e4b');
    } else if (p.g.holdT > 0) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 25, ry - 5, 50, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 25, ry - 5, 50 * p.g.holdT / HOLD_TIME, 6);
    }
    y -= showClass ? 70 : 52;
  }
}

export function drawLobby() {
  const st = lobbyStatus();

  text('STICK ARCHERS', W / 2, 62, 60);
  text(settingsSummary(), W / 2, 110, 16, '#888', 'normal');
  if (!navigator.getGamepads) {
    text('This browser has no controller support - use Chrome or Edge', W / 2, 154, 26, '#d93636');
  } else if (pads.size === 0) {
    text('No controller found - connect one and press a trigger, or press A / D to play on the keyboard', W / 2, 154, 24, '#555', 'normal');
  } else {
    text(st.mode || `${humans.length} joined`, W / 2, 154, 30);
  }
  text('Tap LT / RT: change spot   ·   △: change class   ·   Hold LT + RT: ready', W / 2, 196, 22, '#000', 'normal');
  text('In game:  stick move · ↓ crouch   ·   LT aim · RT draw, release to shoot   ·   ✕ jump · ○ block · □ potion · △ ultimate',
       W / 2, 230, 17, '#777', 'normal');
  text('Keyboard:  A = LT · D = RT · arrow keys move   ·   J = ✕ · K = ○ · L = □ · I = △', W / 2, 258, 16, '#999', 'normal');

  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  line(view.left - 20, 826, view.right + 20, 826);
  ctx.lineWidth = 10;
  line(160, 495, 280, 495);
  line(1320, 495, 1440, 495);

  const onGear = humans.filter(h => h.slot === -1);
  drawGear(GEAR.x, GEAR.y, onGear.length ? '#000' : '#bbb');
  text('SETTINGS', GEAR.x, GEAR.y + 50, 14, onGear.length ? '#000' : '#aaa');
  drawHumanLabels(onGear, GEAR.x, GEAR.y - 62, false);

  for (let s = 0; s < 4; s++) {
    const slot = LOBBY_SLOTS[s];
    const on = humans.filter(h => h.slot === s);
    const isBot = st.bots.includes(s);
    const cls = CLASSES[on.length ? on[0].cls : DEFAULT_CLASS];   // shows the class picked there
    const dummy = { x: slot.x, y: slot.y, facing: s < 2 ? 1 : -1, angle: 20, cls, weapon: WEAPONS[cls.weapon],
                    drawing: false, power: 0, alive: true, stuck: [] };
    drawStickman(dummy, on.length ? '#000' : isBot ? '#999' : '#e4e4e4', false);
    text(settings.mode === 'teams' ? slot.name : slot.ffaName, slot.x, slot.y + (slotIsHigh(s) ? 32 : 34), 14, '#999', 'normal');

    if (on.length) drawHumanLabels(on, slot.x, slot.y - 232, on.length > 1, true);
    else text(isBot ? 'BOT' : 'empty', slot.x, slot.y - 192, isBot ? 22 : 18, isBot ? BOT_COLOR : '#bbb', isBot ? 'bold' : 'normal');
  }

  if (countdownT !== null) text(`Starting in ${Math.ceil(countdownT)}`, W / 2, 420, 64);
  else if (st.msg) text(st.msg, W / 2, 870, 22, '#000', 'normal');
}
