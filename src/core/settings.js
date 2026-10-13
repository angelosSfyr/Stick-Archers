// Settings (settings screen, remembered between sessions)
import { ARENAS } from '../data/arenas.js';

export const SETTINGS_DEF = [
  { key: 'terrain',  label: 'Terrain', options: Object.entries(ARENAS).map(([id, a]) => [id, a.name]) },
  { key: 'distance', label: 'Distance between teams', options: [[1000, 'Close'], [1500, 'Medium'], [2100, 'Far'], [2800, 'Very far']] },
  { key: 'solo',     label: 'Single player', options: [['1v1', '1 vs 1 bot'], ['2v2', '2 vs 2 (3 bots)']] },
  { key: 'minions',  label: 'Minions per team', options: [[0, 'None'], [2, '2'], [3, '3'], [5, '5'], [8, '8'], [10, '10']] },
  { key: 'rounds',   label: 'Rounds (best of)', options: [[1, '1'], [3, '3'], [5, '5'], [7, '7']] },
  { key: 'speed',    label: 'Arrow speed', kind: 'bar', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
  { key: 'wind',     label: 'Wind', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'balloons', label: 'Power-up balloons', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'blood',    label: 'Blood', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'music',    label: 'Music', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'sfx',      label: 'Sound effects', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
];
const SETTINGS_KEY = 'stickArchers.settings';
// `mode` has no row: free-for-all ('ffa', 'ffa-bots') is switched off until it's decided which
// way fighters face when enemies are on both sides, so it stays 'teams'.
export const settings = { terrain: 'hills', distance: 1500, mode: 'teams', solo: '1v1', minions: 5, rounds: 3,
                          speed: 3, wind: false, balloons: true, blood: true,
                          music: true, sfx: true };
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  for (const d of SETTINGS_DEF) {
    if (d.options.some(o => o[0] === saved[d.key])) settings[d.key] = saved[d.key];
  }
} catch (e) { /* no storage: keep defaults */ }

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

function optionName(key) {
  const d = SETTINGS_DEF.find(d => d.key === key);
  return d.options.find(o => o[0] === settings[key])[1];
}

export function settingsSummary() {
  return [
    settings.mode === 'teams' ? '' : 'free-for-all',
    optionName('terrain').replace(/ \(.*\)/, ''),
    optionName('distance').toLowerCase() + ' range',
    `best of ${settings.rounds}`,
    settings.minions ? `${settings.minions} minions` : 'no minions',
    `arrow speed ${settings.speed}`,
    settings.wind ? 'wind' : 'no wind',
    settings.balloons ? 'balloons' : '',
    settings.blood ? '' : 'no blood',
    settings.music ? '' : 'music off',
    settings.sfx ? '' : 'sounds off',
  ].filter(Boolean).join('  ·  ');
}
