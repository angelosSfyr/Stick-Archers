// Called every frame: picks the music, keeps it scheduled, and drives the wind and arrow whoosh.
import { SPEED_SCALE } from '../config.js';
import { T } from '../core/clock.js';
import { settings } from '../core/settings.js';
import { M } from '../game/match.js';
import { screen } from '../screens/screens.js';
import { clamp } from '../util.js';
import { SONGS } from './music.js';
import { audio, audioReady } from './synth.js';

const soundHintEl = document.getElementById('soundHint');

export function updateAudio() {
  const ready = audioReady();
  const wantHint = !!audio.ctx && !ready && (settings.music || settings.sfx);
  soundHintEl.classList.toggle('hidden', !wantHint);
  if (!ready) return;

  const ac = audio.ctx, now = ac.currentTime;
  const inMatch = screen === 'match' && !!M;
  audio.sfx.gain.setTargetAtTime(settings.sfx ? 1 : 0, now, 0.05);

  // menu music on the settings screen and lobby, match music while playing
  const songName = settings.music ? (inMatch ? 'match' : 'menu') : null;
  const song = SONGS[songName];
  audio.music.gain.setTargetAtTime(song ? song.vol : 0, now, 0.4);
  if (song) {
    const d = 60 / song.bpm / 2;               // eighth notes
    if (audio.song !== songName || audio.nextStepAt < now) { audio.step = 0; audio.nextStepAt = now + 0.05; }
    audio.song = songName;
    while (audio.nextStepAt < now + 0.15) {
      song.step(audio.step, audio.nextStepAt, d);
      audio.step = (audio.step + 1) % song.length;
      audio.nextStepAt += d;
    }
  } else {
    audio.song = null;
  }

  // wind: a constant gusting rush while the round has wind
  const wind = inMatch && settings.wind ? Math.abs(M.wind) : 0;
  const gust = 0.75 + 0.25 * Math.sin(T * 0.7) + 0.12 * Math.sin(T * 2.3);
  audio.wind.gain.gain.setTargetAtTime(wind ? (0.12 + 0.3 * wind) * gust : 0, now, 0.2);
  audio.wind.filter.frequency.setTargetAtTime(350 + 300 * wind + 150 * Math.sin(T * 0.5), now, 0.3);

  // arrows in flight: a whoosh that follows the fastest arrow
  let speed = 0;
  if (inMatch) for (const a of M.arrows) speed = Math.max(speed, Math.hypot(a.vx, a.vy) * SPEED_SCALE[settings.speed]);
  audio.whoosh.gain.gain.setTargetAtTime(speed ? clamp(speed / 2500, 0.06, 0.4) : 0, now, 0.05);
  audio.whoosh.filter.frequency.setTargetAtTime((500 + speed * 0.6) * (1 + 0.08 * Math.sin(T * 30)), now, 0.03);
}
