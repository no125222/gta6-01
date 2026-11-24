// Sound, synthesized live with WebAudio — no audio files, no network. Engine
// hum, siren, gunshot, pickup chime, mission jingle and a lazy synthwave pad
// that loops under the game. Everything is guarded so the game plays silent
// (never crashing) when audio is unavailable or muted.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Ignore.
    }
  }

  // A slow two-chord pad: Am9 -> Fmaj7, one bar each, quiet underneath play.
  const CHORDS = [
    [110, 164.8, 220, 261.6, 329.6],
    [87.3, 174.6, 220, 261.6, 329.6],
  ];

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const chord = CHORDS[musicStep % CHORDS.length];
      musicStep += 1;
      for (const freq of chord) tone(freq, 3.6, 'triangle', 0.035);
      tone(chord[0] / 2, 3.6, 'sine', 0.05);
    }, 3600);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.14, 0.35, 2500);
      tone(180, 0.08, 'square', 0.12, 60);
    },
    punch() {
      noise(0.08, 0.25, 700);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.2);
      window.setTimeout(() => tone(990, 0.18, 'sine', 0.2), 90);
    },
    cash() {
      tone(880, 0.1, 'triangle', 0.2);
      window.setTimeout(() => tone(1174, 0.14, 'triangle', 0.2), 80);
      window.setTimeout(() => tone(1568, 0.22, 'triangle', 0.2), 170);
    },
    missionDone() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => window.setTimeout(() => tone(f, 0.25, 'triangle', 0.22), i * 110));
    },
    wantedUp() {
      tone(220, 0.3, 'sawtooth', 0.14, 440);
    },
    siren() {
      tone(700, 0.5, 'sine', 0.07, 950);
    },
    crash() {
      noise(0.25, 0.4, 500);
    },
    horn() {
      tone(370, 0.25, 'square', 0.12);
      tone(466, 0.25, 'square', 0.1);
    },
    busted() {
      const notes = [392, 311, 233];
      notes.forEach((f, i) => window.setTimeout(() => tone(f, 0.4, 'sawtooth', 0.15), i * 180));
    },
    setEngine(running, speedNorm) {
      if (!ensure() || muted) {
        if (engineOsc) { try { engineOsc.stop(); } catch { /* ignore */ } engineOsc = null; }
        return;
      }
      if (running && !engineOsc) {
        try {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 70;
          engineGain.gain.value = 0.03;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        } catch {
          engineOsc = null;
        }
      } else if (!running && engineOsc) {
        try { engineOsc.stop(); } catch { /* ignore */ }
        engineOsc = null;
      }
      if (engineOsc) {
        engineOsc.frequency.value = 60 + speedNorm * 160;
        engineGain.gain.value = 0.02 + speedNorm * 0.05;
      }
    },
  };
}
