// Music: two 8-bar loops, scheduled a little ahead of time so they stay in rhythm
// (see updateAudio in audio.js). Add a song by adding an entry to SONGS.
import { audio, midi, noise, tone } from './synth.js';

// Match: Am F C G with bass, pads, melody and soft drums.
const MUSIC_ROOTS = [45, 41, 48, 43];
const MUSIC_CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
const MUSIC_BASS = [0, null, 12, null, 0, null, 7, 12];
const MUSIC_MELODY = [
  69, 0, 72, 0, 76, 0, 74, 72,   69, 0, 0, 0, 72, 74, 72, 0,
  67, 0, 72, 0, 76, 0, 79, 76,   74, 0, 0, 0, 74, 72, 67, 0,
  69, 0, 72, 0, 76, 0, 79, 0,    81, 0, 79, 76, 74, 0, 72, 0,
  72, 0, 76, 0, 74, 72, 69, 0,   67, 0, 69, 0, 71, 0, 74, 0,
];

function musicStep(s, t, d) {
  const dest = audio.music, i = s % 8, chord = Math.floor(s / 8) % 4;
  if (MUSIC_BASS[i] !== null) tone({ freq: midi(MUSIC_ROOTS[chord] + MUSIC_BASS[i]), type: 'triangle', at: t, dur: d * 1.6, vol: 0.22, dest });
  if (i === 0) for (const n of MUSIC_CHORDS[chord]) tone({ freq: midi(n), at: t, dur: d * 8, vol: 0.045, attack: 0.15, dest });
  if (MUSIC_MELODY[s]) tone({ freq: midi(MUSIC_MELODY[s]), type: 'triangle', at: t, dur: d * 1.5, vol: 0.13, dest });
  if (i === 0 || i === 4) tone({ freq: 150, at: t, dur: 0.18, vol: 0.4, slideTo: 45, dest });   // kick
  if (i === 2 || i === 6) noise({ at: t, dur: 0.12, vol: 0.12, type: 'bandpass', freq: 1800, dest }); // snare
  noise({ at: t, dur: 0.03, vol: i % 2 ? 0.025 : 0.04, type: 'highpass', freq: 7000, dest });        // hat
}

// Menu: a calm C Am F G loop of soft arpeggios with a slow melody, no drums.
const MENU_ROOTS = [36, 33, 29, 31];
const MENU_CHORDS = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
const MENU_ARP = [0, 1, 2, 3, 2, 1, 2, 1];
const MENU_MELODY = [
  76, 0, 0, 0, 74, 0, 72, 0,   72, 0, 0, 0, 69, 0, 0, 0,
  69, 0, 72, 0, 77, 0, 76, 0,  74, 0, 0, 0, 0, 0, 0, 0,
  76, 0, 79, 0, 76, 0, 74, 0,  72, 0, 74, 0, 76, 0, 0, 0,
  77, 0, 76, 0, 74, 0, 72, 0,  71, 0, 72, 0, 74, 0, 0, 0,
];

function menuStep(s, t, d) {
  const dest = audio.music, i = s % 8, chord = Math.floor(s / 8) % 4;
  if (i === 0) tone({ freq: midi(MENU_ROOTS[chord] + 12), at: t, dur: d * 8, vol: 0.16, attack: 0.05, dest });
  tone({ freq: midi(MENU_CHORDS[chord][MENU_ARP[i]]), type: 'triangle', at: t, dur: d * 1.8, vol: 0.06, dest });
  if (MENU_MELODY[s]) tone({ freq: midi(MENU_MELODY[s]), at: t, dur: d * 3, vol: 0.11, attack: 0.03, dest });
  if (i % 2 === 0) noise({ at: t, dur: 0.05, vol: 0.012, type: 'highpass', freq: 6000, dest });     // soft shaker
}

export const SONGS = {
  match: { bpm: 112, length: MUSIC_MELODY.length, step: musicStep, vol: 0.55 },
  menu:  { bpm: 84,  length: MENU_MELODY.length,  step: menuStep,  vol: 0.5 },
};

