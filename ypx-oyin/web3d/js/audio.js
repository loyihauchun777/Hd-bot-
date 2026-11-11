// Sound effects (WebAudio, generated) and voice-line playback (mp3 files).
let ctx = null;
let master = null;
let ambient = null;
let rainSnd = null;
let muted = false;

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'square', vol = 0.06, slide = 0, delay = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noiseBuffer(c, seconds) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export const sfx = {
  unlock() { ac(); },
  whistle() {
    const c = ac(); if (!c) return;
    // police whistle: trill = high sine with fast vibrato
    const t0 = c.currentTime;
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 2900;
    lfo.frequency.value = 38; lg.gain.value = 180;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
    g.gain.setValueAtTime(0.12, t0 + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    o.connect(g); g.connect(master);
    o.start(t0); lfo.start(t0); o.stop(t0 + 0.75); lfo.stop(t0 + 0.75);
  },
  horn() { tone(330, 0.35, { type: 'sawtooth', vol: 0.05 }); tone(415, 0.35, { type: 'sawtooth', vol: 0.04 }); },
  siren() { for (let i = 0; i < 3; i++) { tone(700, 0.25, { type: 'triangle', vol: 0.05, slide: 400, delay: i * 0.5 }); tone(1100, 0.25, { type: 'triangle', vol: 0.05, slide: -400, delay: i * 0.5 + 0.25 }); } },
  click() { tone(900, 0.05, { type: 'square', vol: 0.03 }); },
  good() { tone(660, 0.1, { vol: 0.05 }); tone(990, 0.16, { vol: 0.05, delay: 0.1 }); },
  bad() { tone(220, 0.35, { type: 'sawtooth', vol: 0.06, slide: -90 }); },
  cash() { tone(1500, 0.06, { vol: 0.04 }); tone(2000, 0.12, { vol: 0.04, delay: 0.07 }); },
  beep() { tone(1800, 0.08, { type: 'sine', vol: 0.06 }); },
  ambientStart() {
    const c = ac(); if (!c || ambient) return;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 3); src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = c.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    ambient = { src, g };
  },
  ambientStop() { if (ambient) { try { ambient.src.stop(); } catch (e) {} ambient = null; } },
  rain(on) {
    const c = ac(); if (!c) return;
    if (on && !rainSnd) {
      const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 3); src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
      const g = c.createGain(); g.gain.value = 0.035;
      src.connect(f); f.connect(g); g.connect(master); src.start();
      rainSnd = src;
    } else if (!on && rainSnd) { try { rainSnd.stop(); } catch (e) {} rainSnd = null; }
  },
  setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; },
  isMuted() { return muted; },
};

// ---- voice lines ----
const voiceCache = new Map();
let current = null;

export function stopVoice() {
  if (current) { try { current.pause(); } catch (e) {} current = null; }
}

// Plays audio/<voice>/<id>.mp3; resolves when finished, or after a reading-time fallback if the file is missing.
export function playVoice(voice, id, text) {
  stopVoice();
  const fallback = Math.min(4500, 900 + (text || '').length * 45);
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const src = `audio/${voice}/${id}.mp3`;
    let a = voiceCache.get(src);
    if (a === null) { setTimeout(finish, fallback); return; } // known missing
    if (!a) { a = new Audio(src); a.preload = 'auto'; voiceCache.set(src, a); }
    current = a;
    a.currentTime = 0;
    a.muted = muted;
    a.onended = finish;
    a.onerror = () => { voiceCache.set(src, null); setTimeout(finish, fallback); };
    const p = a.play();
    if (p && p.catch) p.catch(() => setTimeout(finish, fallback));
    setTimeout(finish, 9000); // safety
  });
}
