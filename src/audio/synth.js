// Sound: everything is synthesized with the Web Audio API, no sound files.
// Browsers keep audio off until the page gets a click or key press.
export const audio = { ctx: null, master: null, music: null, sfx: null, noise: null, wind: null, whoosh: null,
                       step: 0, nextStepAt: 0, song: null };

(function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ac = new AC();
  audio.ctx = ac;
  audio.master = ac.createGain();
  audio.master.gain.value = 0.8;
  audio.master.connect(ac.destination);
  audio.music = ac.createGain();
  audio.music.gain.value = 0;
  audio.music.connect(audio.master);
  audio.sfx = ac.createGain();
  audio.sfx.connect(audio.master);
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);   // 2s of white noise
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  audio.noise = buf;
  audio.wind = noiseLoop('lowpass', 500, 0.8);
  audio.whoosh = noiseLoop('bandpass', 1200, 3);
})();

function noiseLoop(type, freq, q) {
  const ac = audio.ctx;
  const src = ac.createBufferSource();
  src.buffer = audio.noise;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(audio.sfx);
  src.start();
  return { filter, gain };
}

export const audioReady = () => !!audio.ctx && audio.ctx.state === 'running';
export function unlockAudio() {
  if (audio.ctx && audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {});
}
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);

// One enveloped oscillator note. `at` is an AudioContext time (defaults to now).
export function tone({ freq, type = 'sine', at = 0, dur = 0.2, vol = 0.3, attack = 0.005, slideTo = 0, dest = audio.sfx }) {
  const ac = audio.ctx, t = at || ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// A short burst of filtered noise.
export function noise({ at = 0, dur = 0.1, vol = 0.3, type = 'highpass', freq = 2000, q = 1, slideTo = 0, dest = audio.sfx }) {
  const ac = audio.ctx, t = at || ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = audio.noise;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

export const midi = n => 440 * 2 ** ((n - 69) / 12);
