// Entry point: the frame loop. Each frame reads the controllers, updates the
// current screen, keeps the audio going, then draws.
import { advanceClock } from './core/clock.js';
import { pollPads } from './core/input.js';
import { updateAudio } from './audio/audio.js';
import { M, updateMatch } from './game/match.js';
import { screenTransform } from './render/camera.js';
import { canvas, ctx } from './render/canvas.js';
import { drawLobby } from './render/draw-lobby.js';
import { drawMatch } from './render/draw-match.js';
import { updateLobby } from './screens/lobby.js';
import { screen, showScreen } from './screens/screens.js';
import { updateSettingsScreen } from './screens/settings-screen.js';

function update(dt) {
  advanceClock(dt);
  pollPads(dt);
  if (screen === 'settings') updateSettingsScreen();
  else if (screen === 'lobby') updateLobby(dt);
  else if (M) updateMatch(dt);
  updateAudio();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (screen === 'lobby') { screenTransform(); drawLobby(); }
  else if (screen === 'match' && M) drawMatch();
}

let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
showScreen('settings');
requestAnimationFrame(frame);
