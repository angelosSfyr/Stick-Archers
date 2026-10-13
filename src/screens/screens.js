// Screens: 'settings' -> 'lobby' -> 'match' -> back to 'lobby'
import { consumeAll } from '../core/input.js';
import { endMatch } from '../game/match.js';
import { buildSettings } from './settings-screen.js';
import { enterLobby } from './lobby.js';

export let screen = 'settings';

const settingsEl = document.getElementById('settings');
const toSettingsBtn = document.getElementById('toSettings');

export function showScreen(s) {
  screen = s;
  settingsEl.classList.toggle('hidden', s !== 'settings');
  toSettingsBtn.classList.toggle('hidden', s !== 'lobby');
  document.body.classList.toggle('playing', s === 'match');
  consumeAll();
  if (s === 'settings') buildSettings();
  if (s === 'lobby') { endMatch(); enterLobby(); }
}

document.getElementById('continue').onclick = () => showScreen('lobby');
toSettingsBtn.onclick = () => showScreen('settings');
addEventListener('keydown', e => {
  if (e.key === 'Enter' && screen === 'settings') { e.preventDefault(); showScreen('lobby'); }
  if (e.key === 'Escape' && screen === 'match') showScreen('lobby');
});
