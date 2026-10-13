// Settings (settings screen, remembered between sessions)
import { ARENAS } from '../data/arenas.js';
import { DMG } from '../data/weapons.js';

export const SETTINGS_DEF = [
  { key: 'terrain',  label: 'Terrain', options: Object.entries(ARENAS).map(([id, a]) => [id, a.name]) },
  { key: 'distance', label: 'Distance between teams', options: [[1000, 'Close'], [1500, 'Medium'], [2100, 'Far'], [2800, 'Very far']] },
  { key: 'view',     label: 'Camera', options: [['both', 'See both teams'], ['own', 'Only my team, follow the arrow']] },
  { key: 'mode',     label: 'Game mode', options: [['teams', 'Teams'], ['ffa-bots', 'Free-for-all (bots fill empty spots)'], ['ffa', 'Free-for-all (players only)']] },
  { key: 'turns',    label: 'Turns', options: [['single', 'One player at a time'], ['team', 'Whole team at once (teams)'], ['all', 'Everyone at the same time']] },
  { key: 'rounds',   label: 'Rounds (best of)', options: [[1, '1'], [3, '3'], [5, '5'], [7, '7']] },
  { key: 'turnTime', label: 'Time per turn', options: [[5, '5s'], [10, '10s'], [15, '15s'], [20, '20s'], [30, '30s'], [0, 'No limit']] },
  { key: 'speed',    label: 'Arrow speed', kind: 'bar', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
  { key: 'headshot', label: 'Headshot kills instantly', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'wind',     label: 'Wind', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'balloons', label: 'Power-up balloons', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'blood',    label: 'Blood', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'music',    label: 'Music', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
  { key: 'sfx',      label: 'Sound effects', kind: 'check', options: [[false, 'Off'], [true, 'On']] },
];
const SETTINGS_KEY = 'stickArchers.settings';
export const settings = { terrain: 'hills', distance: 1500, view: 'both', mode: 'teams', turns: 'single', rounds: 3,
                          turnTime: 15, speed: 3, headshot: true, wind: false, balloons: true, blood: true,
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

// Free-for-all has no teams, so "whole team at once" turns become one player at a time.
export const turnsFor = mode => settings.turns === 'team' && mode !== 'teams' ? 'single' : settings.turns;

export function settingsSummary() {
  const turns = turnsFor(settings.mode);
  return [
    settings.mode === 'teams' ? '' : 'free-for-all',
    optionName('terrain').replace(/ \(.*\)/, ''),
    optionName('distance').toLowerCase() + ' range',
    settings.view === 'both' || turns === 'all' ? 'both sides visible' : 'own side view',
    { single: 'one player per turn', team: 'whole-team turns', all: 'everyone at once' }[turns],
    `best of ${settings.rounds}`,
    turns === 'all' ? '' : settings.turnTime ? `${settings.turnTime}s per turn` : 'no time limit',
    `arrow speed ${settings.speed}`,
    settings.headshot ? 'headshot kills' : `headshot -${DMG.head}`,
    settings.wind ? 'wind' : 'no wind',
    settings.balloons ? 'balloons' : '',
    settings.blood ? '' : 'no blood',
    settings.music ? '' : 'music off',
    settings.sfx ? '' : 'sounds off',
  ].filter(Boolean).join('  ·  ');
}
