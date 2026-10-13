// Settings screen (mouse or controller)
import { SETTINGS_DEF, settings, saveSettings } from '../core/settings.js';
import { pads } from '../core/input.js';
import { DMG, damageLoaded } from '../data/weapons.js';
import { showScreen } from './screens.js';

const rowsEl = document.getElementById('rows');
const damageEl = document.getElementById('damage');
let focusRow = 0;

function setSetting(i, value) {
  focusRow = i;
  settings[SETTINGS_DEF[i].key] = value;
  saveSettings();
  buildSettings();
}

function cycleSetting(i) {
  const d = SETTINGS_DEF[i];
  const idx = d.options.findIndex(o => o[0] === settings[d.key]);
  setSetting(i, d.options[(idx + 1) % d.options.length][0]);
}

export function buildSettings() {
  rowsEl.innerHTML = '';
  SETTINGS_DEF.forEach((d, i) => {
    const label = document.createElement('div');
    label.className = 'row-label' + (i === focusRow ? ' focus' : '');
    label.textContent = d.label;

    const opts = document.createElement('div');
    const value = settings[d.key];
    if (d.kind === 'check') {
      opts.className = 'check';
      opts.innerHTML = `<div class="box">${value ? '&#10003;' : ''}</div><span>${value ? 'On' : 'Off'}</span>`;
      opts.onclick = () => setSetting(i, !value);
    } else {
      opts.className = d.kind === 'bar' ? 'bar' : 'opts';
      for (const [v, name] of d.options) {
        const b = document.createElement('button');
        b.className = d.kind === 'bar' ? 'seg' + (v <= value ? ' fill' : '') : 'opt' + (v === value ? ' on' : '');
        b.textContent = name;
        b.onclick = () => setSetting(i, v);
        opts.appendChild(b);
      }
    }
    rowsEl.append(label, opts);
  });
  damageEl.textContent =
    `Damage per hit (out of 100 health), read from config/damage.js:  head ${DMG.head}  ·  torso ${DMG.torso}  ·  ` +
    `arm ${DMG.arm}  ·  leg ${DMG.leg}.  An arrow to the head always kills.` +
    (damageLoaded ? '' : '  (config/damage.js not found or has an error, so these are the defaults.)');
}

export function updateSettingsScreen() {
  for (const p of pads.values()) {
    for (const e of p.ev) {
      if (e === 'tapL') { focusRow = (focusRow + 1) % SETTINGS_DEF.length; buildSettings(); }
      else if (e === 'tapR') cycleSetting(focusRow);
      else if (e === 'hold') { showScreen('lobby'); return; }
    }
  }
}
