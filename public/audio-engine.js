/**
 * TympanIQ Audio Engine
 * Real-time Web Audio API synthesis for therapeutic sound generation.
 * No audio files — everything is generated mathematically.
 */
class TympanIQEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.nodes = [];
    this.isPlaying = false;
    this.currentPhase = null;
    this.phaseTimer = null;
    this.sessionTimer = null;
    this.elapsed = 0;
    this.totalDuration = 0;
    this.onTick = null;
    this.onPhaseChange = null;
    this.onComplete = null;
    this.onFreqUpdate = null;
    this.onPhaseProgress = null;
    this._currentFadeGain = null;
    this.volume = 0.4;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    // Keep audio alive when app loses focus (mobile)
    this._keepAlive();
  }

  _keepAlive() {
    if (this._keepAliveSetup) return;
    this._keepAliveSetup = true;

    // Create a MediaStream with a near-silent oscillator → <audio> element.
    // This tricks iOS/Android into treating the page as a media playback session,
    // preventing AudioContext suspension when the app goes to background.
    // The actual audio plays through ctx.destination normally (no doubling).
    try {
      const dest = this.ctx.createMediaStreamDestination();
      const osc = this.ctx.createOscillator();
      const silentGain = this.ctx.createGain();
      silentGain.gain.value = 0.001; // near-silent
      osc.connect(silentGain);
      silentGain.connect(dest);
      osc.start();
      this._keepAliveOsc = osc;
      const audio = new Audio();
      audio.srcObject = dest.stream;
      this._streamAudio = audio;
    } catch (e) {
      // Fallback: silent audio element
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.loop = true;
      audio.volume = 0.01;
      this._streamAudio = audio;
    }

    // Resume AudioContext when returning to app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isPlaying) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this._streamAudio) this._streamAudio.play().catch(() => {});
      }
    });
  }

  _startKeepAlive() {
    if (this._streamAudio) {
      this._streamAudio.play().catch(() => {});
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'TympanIQ Session',
        artist: 'Sonic Ear Therapy',
        album: 'TympanIQ',
      });
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  _stopKeepAlive() {
    if (this._streamAudio) {
      this._streamAudio.pause();
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  // --- Noise Generators ---

  createPinkNoise() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  createWhiteNoise() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  // --- Tone Generators ---

  createBinauralBeat(baseFreq, beatFreq) {
    const merger = this.ctx.createChannelMerger(2);
    const oscL = this.ctx.createOscillator();
    const oscR = this.ctx.createOscillator();
    const gainL = this.ctx.createGain();
    const gainR = this.ctx.createGain();

    oscL.frequency.value = baseFreq;
    oscR.frequency.value = baseFreq + beatFreq;
    oscL.type = 'sine';
    oscR.type = 'sine';
    gainL.gain.value = 0.5;
    gainR.gain.value = 0.5;

    oscL.connect(gainL);
    oscR.connect(gainR);
    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 1);

    return { merger, oscL, oscR, gainL, gainR, baseFreq, beatFreq };
  }

  createFrequencySweep(startFreq, endFreq, durationSec) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = startFreq;
    osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + durationSec);
    gain.gain.value = 0.3;
    osc.connect(gain);
    return { osc, gain, startFreq, endFreq };
  }

  createNotchedNoise(notchFreq, bandwidth) {
    const noise = this.createPinkNoise();
    const lowpass = this.ctx.createBiquadFilter();
    const highpass = this.ctx.createBiquadFilter();
    const merger = this.ctx.createGain();

    // Split into below-notch and above-notch bands
    const lowGain = this.ctx.createGain();
    const highGain = this.ctx.createGain();

    lowpass.type = 'lowpass';
    lowpass.frequency.value = notchFreq - bandwidth / 2;
    lowpass.Q.value = 1;

    highpass.type = 'highpass';
    highpass.frequency.value = notchFreq + bandwidth / 2;
    highpass.Q.value = 1;

    noise.connect(lowpass);
    noise.connect(highpass);
    lowpass.connect(lowGain);
    highpass.connect(highGain);
    lowGain.connect(merger);
    highGain.connect(merger);

    return { noise, lowpass, highpass, merger };
  }

  createACRNTones(tinnitusFreq) {
    const ratios = [0.85, 0.93, 1.07, 1.17];
    const oscs = ratios.map(r => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = tinnitusFreq * r;
      return osc;
    });
    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    oscs.forEach(o => o.connect(gain));
    return { oscs, gain, frequencies: ratios.map(r => Math.round(tinnitusFreq * r)) };
  }

  // --- Session Protocols ---

  getProtocol(mode, settings) {
    const baseFreq = settings.baseFreq || 440;
    const beatRate = settings.beatRate || 10;
    const tinnitusFreq = settings.tinnitusFreq || 6000;
    const notched = settings.notched || false;

    switch (mode) {
      case 'quick':
        return {
          totalDuration: 10 * 60,
          phases: [
            { name: 'Broadband Enrichment', type: 'pink_noise', duration: 180, level: 0.35 },
            { name: 'Alpha Binaural', type: 'binaural', duration: 240, baseFreq, beatFreq: 10, level: 0.4 },
            { name: 'Rest Interval', type: 'silence', duration: 30 },
            { name: 'Mixed Enrichment', type: 'pink_binaural', duration: 120, baseFreq, beatFreq: beatRate, level: 0.35 },
            { name: 'Cool Down', type: 'pink_noise', duration: 30, level: 0.2 },
          ]
        };

      case 'daily':
        return {
          totalDuration: 20 * 60,
          phases: [
            { name: 'Broadband Enrichment', type: 'pink_noise', duration: 180, level: 0.3 },
            { name: 'Low Frequency Sweep', type: 'sweep', duration: 120, startFreq: 250, endFreq: 1000, level: 0.25 },
            { name: 'Rest Interval', type: 'silence', duration: 60 },
            { name: 'Mid Frequency Sweep', type: 'sweep', duration: 120, startFreq: 500, endFreq: 4000, level: 0.25 },
            { name: 'Alpha Binaural', type: 'binaural', duration: 180, baseFreq, beatFreq: beatRate, level: 0.35 },
            { name: 'Rest Interval', type: 'silence', duration: 60 },
            { name: 'High Frequency Sweep', type: 'sweep', duration: 120, startFreq: 1000, endFreq: 4000, level: 0.2 },
            { name: 'Mixed Enrichment', type: 'pink_binaural', duration: 240, baseFreq, beatFreq: beatRate, level: 0.3 },
            { name: 'Rest Interval', type: 'silence', duration: 60 },
            { name: 'Cool Down', type: 'pink_noise', duration: 60, level: 0.15 },
          ]
        };

      case 'deep':
        const phases = [
          { name: 'Broadband Enrichment', type: 'pink_noise', duration: 180, level: 0.3 },
          { name: 'Low Frequency Sweep', type: 'sweep', duration: 120, startFreq: 250, endFreq: 1000, level: 0.25 },
          { name: 'Rest Interval', type: 'silence', duration: 60 },
          { name: 'Mid Frequency Sweep', type: 'sweep', duration: 150, startFreq: 500, endFreq: 4000, level: 0.25 },
          { name: 'Theta Binaural', type: 'binaural', duration: 180, baseFreq, beatFreq: 6, level: 0.35 },
          { name: 'Rest Interval', type: 'silence', duration: 60 },
          { name: 'Alpha Binaural', type: 'binaural', duration: 180, baseFreq, beatFreq: 10, level: 0.35 },
          { name: 'High Frequency Sweep', type: 'sweep', duration: 120, startFreq: 1000, endFreq: 4000, level: 0.2 },
          { name: 'Rest Interval', type: 'silence', duration: 60 },
        ];

        if (notched) {
          phases.push(
            { name: 'Notched Audio Therapy', type: 'notched', duration: 180, notchFreq: tinnitusFreq, level: 0.3 },
            { name: 'Rest Interval', type: 'silence', duration: 60 }
          );
        }

        phases.push(
          { name: 'ACRN Neuromodulation', type: 'acrn', duration: 180, tinnitusFreq, level: 0.2 },
          { name: 'Rest Interval', type: 'silence', duration: 60 },
          { name: 'Cool Down', type: 'pink_noise', duration: 60, level: 0.1 }
        );

        return { totalDuration: 30 * 60, phases };

      default:
        return this.getProtocol('quick', settings);
    }
  }

  // --- Playback ---

  stopAllNodes() {
    this.nodes.forEach(n => {
      try { n.stop(); } catch(e) {}
      try { n.disconnect(); } catch(e) {}
    });
    this.nodes = [];
  }

  playPhase(phase) {
    // Crossfade: fade out old nodes over 3 seconds, then stop them
    const oldNodes = [...this.nodes];
    const oldGain = this._currentFadeGain;
    if (oldGain) {
      const now = this.ctx.currentTime;
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + 3);
      setTimeout(() => {
        oldNodes.forEach(n => {
          try { n.stop(); } catch(e) {}
          try { n.disconnect(); } catch(e) {}
        });
        try { oldGain.disconnect(); } catch(e) {}
      }, 3200);
    } else {
      this.stopAllNodes();
    }
    this.nodes = [];

    this.currentPhase = phase;

    if (this.onPhaseChange) this.onPhaseChange(phase);

    if (phase.type === 'silence') {
      this._currentFadeGain = null;
      if (this.onFreqUpdate) this.onFreqUpdate({ left: '—', right: '—', beat: 'Rest' });
      return;
    }

    const fadeIn = this.ctx.createGain();
    fadeIn.gain.value = 0;
    fadeIn.gain.linearRampToValueAtTime(phase.level || 0.3, this.ctx.currentTime + 3);
    fadeIn.connect(this.masterGain);
    this._currentFadeGain = fadeIn;

    switch (phase.type) {
      case 'pink_noise': {
        const noise = this.createPinkNoise();
        noise.connect(fadeIn);
        noise.start();
        this.nodes.push(noise);
        if (this.onFreqUpdate) this.onFreqUpdate({ left: 'Pink', right: 'Noise', beat: '—' });
        break;
      }

      case 'binaural': {
        const bb = this.createBinauralBeat(phase.baseFreq, phase.beatFreq);
        bb.merger.connect(fadeIn);
        bb.oscL.start();
        bb.oscR.start();
        this.nodes.push(bb.oscL, bb.oscR);
        if (this.onFreqUpdate) {
          this.onFreqUpdate({
            left: `${phase.baseFreq} Hz`,
            right: `${phase.baseFreq + phase.beatFreq} Hz`,
            beat: `${phase.beatFreq} Hz`
          });
        }
        break;
      }

      case 'pink_binaural': {
        const noise = this.createPinkNoise();
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.5;
        noise.connect(noiseGain);
        noiseGain.connect(fadeIn);
        noise.start();

        const bb = this.createBinauralBeat(phase.baseFreq, phase.beatFreq);
        const bbGain = this.ctx.createGain();
        bbGain.gain.value = 0.5;
        bb.merger.connect(bbGain);
        bbGain.connect(fadeIn);
        bb.oscL.start();
        bb.oscR.start();

        this.nodes.push(noise, bb.oscL, bb.oscR);
        if (this.onFreqUpdate) {
          this.onFreqUpdate({
            left: `${phase.baseFreq} Hz`,
            right: `${phase.baseFreq + phase.beatFreq} Hz`,
            beat: `${phase.beatFreq} Hz +Pink`
          });
        }
        break;
      }

      case 'sweep': {
        const sweep = this.createFrequencySweep(phase.startFreq, phase.endFreq, phase.duration);
        sweep.gain.connect(fadeIn);
        sweep.osc.start();
        this.nodes.push(sweep.osc);

        // Also add stereo sweep with offset for spatial effect
        const sweep2 = this.createFrequencySweep(phase.startFreq * 1.005, phase.endFreq * 1.005, phase.duration);
        const merger = this.ctx.createChannelMerger(2);
        sweep.gain.connect(merger, 0, 0);
        sweep2.gain.connect(merger, 0, 1);
        merger.connect(fadeIn);
        sweep2.osc.start();
        this.nodes.push(sweep2.osc);

        if (this.onFreqUpdate) {
          this.onFreqUpdate({
            left: `${phase.startFreq} Hz`,
            right: `→ ${phase.endFreq} Hz`,
            beat: 'Sweep'
          });
        }
        break;
      }

      case 'notched': {
        const notched = this.createNotchedNoise(phase.notchFreq, phase.notchFreq * 0.25);
        notched.merger.connect(fadeIn);
        notched.noise.start();
        this.nodes.push(notched.noise);
        if (this.onFreqUpdate) {
          this.onFreqUpdate({
            left: 'Notched',
            right: `@ ${phase.notchFreq} Hz`,
            beat: 'Therapy'
          });
        }
        break;
      }

      case 'acrn': {
        const acrn = this.createACRNTones(phase.tinnitusFreq);
        acrn.gain.connect(fadeIn);

        // Play ACRN tones in randomized sequences
        const playSequence = () => {
          const shuffled = [...acrn.oscs].sort(() => Math.random() - 0.5);
          shuffled.forEach((osc, i) => {
            const g = this.ctx.createGain();
            g.gain.value = 0;
            g.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.3);
            g.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + i * 0.3 + 0.05);
            g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + i * 0.3 + 0.25);
            osc.connect(g);
            g.connect(acrn.gain);
          });
        };

        acrn.oscs.forEach(o => o.start());
        this.nodes.push(...acrn.oscs);
        playSequence();
        const acrnInterval = setInterval(playSequence, 1500);
        this._acrnInterval = acrnInterval;

        if (this.onFreqUpdate) {
          this.onFreqUpdate({
            left: `${acrn.frequencies[0]}`,
            right: `${acrn.frequencies[3]} Hz`,
            beat: 'ACRN'
          });
        }
        break;
      }
    }
  }

  startSession(mode, settings) {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._startKeepAlive();

    const protocol = this.getProtocol(mode, settings);
    this.totalDuration = protocol.totalDuration;
    this.protocol = protocol;
    this.elapsed = 0;
    this.isPlaying = true;

    let phaseIndex = 0;
    let phaseElapsed = 0;

    const startPhase = (idx) => {
      if (idx >= protocol.phases.length) {
        this.stopSession(true);
        return;
      }
      phaseIndex = idx;
      phaseElapsed = 0;
      this.playPhase(protocol.phases[idx]);
    };

    // Emit initial phase list so UI can build the timeline
    if (this.onPhaseProgress) {
      this.onPhaseProgress(0, 0, protocol.phases);
    }

    startPhase(0);

    // Use AudioContext.currentTime as clock source — immune to browser throttling
    this._sessionStartTime = this.ctx.currentTime;
    this._pauseOffset = 0;
    this._lastTickElapsed = -1;

    const tick = () => {
      if (!this.isPlaying) return;

      const now = this.ctx.currentTime;
      const realElapsed = Math.floor(now - this._sessionStartTime + this._pauseOffset);

      // Only fire callbacks when a new second ticks over
      if (realElapsed > this._lastTickElapsed) {
        this._lastTickElapsed = realElapsed;
        this.elapsed = realElapsed;

        // Recalculate phase elapsed from real time
        let accumulated = 0;
        let currentPhaseIdx = 0;
        for (let i = 0; i < protocol.phases.length; i++) {
          if (accumulated + protocol.phases[i].duration > realElapsed) {
            currentPhaseIdx = i;
            break;
          }
          accumulated += protocol.phases[i].duration;
          currentPhaseIdx = i + 1;
        }

        if (currentPhaseIdx >= protocol.phases.length) {
          this.stopSession(true);
          return;
        }

        if (currentPhaseIdx !== phaseIndex) {
          startPhase(currentPhaseIdx);
        }
        phaseElapsed = realElapsed - accumulated;

        if (this.onTick) {
          this.onTick(this.totalDuration - realElapsed, realElapsed, this.totalDuration);
        }

        if (this.onPhaseProgress) {
          const phaseDuration = protocol.phases[currentPhaseIdx].duration;
          this.onPhaseProgress(currentPhaseIdx, phaseElapsed / phaseDuration, protocol.phases);
        }

        if (realElapsed >= this.totalDuration) {
          this.stopSession(true);
          return;
        }
      }
    };

    // Use setInterval but it self-corrects from AudioContext.currentTime
    this.sessionTimer = setInterval(tick, 250);
  }

  pause() {
    if (this.ctx && this.isPlaying) {
      this._pauseOffset += (this.ctx.currentTime - this._sessionStartTime);
      this.ctx.suspend();
      this.isPlaying = false;
      clearInterval(this.sessionTimer);
    }
  }

  resume() {
    if (this.ctx && !this.isPlaying) {
      this.ctx.resume();
      this.isPlaying = true;
      this._sessionStartTime = this.ctx.currentTime;
      this.sessionTimer = setInterval(() => {
        if (!this.isPlaying) return;
        const realElapsed = Math.floor(this.ctx.currentTime - this._sessionStartTime + this._pauseOffset);
        if (realElapsed > this._lastTickElapsed) {
          this._lastTickElapsed = realElapsed;
          this.elapsed = realElapsed;
          const remaining = this.totalDuration - realElapsed;
          if (this.onTick) this.onTick(remaining, realElapsed, this.totalDuration);
          if (remaining <= 0) this.stopSession(true);
        }
      }, 250);
    }
  }

  stopSession(completed = false) {
    this.isPlaying = false;
    this._stopKeepAlive();
    clearInterval(this.sessionTimer);
    if (this._acrnInterval) clearInterval(this._acrnInterval);
    this.stopAllNodes();
    if (this.onComplete) this.onComplete(completed, this.elapsed);
  }

  // --- Visualizer Data ---

  getAnalyserNode() {
    if (!this.ctx) return null;
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256;
    this.masterGain.connect(analyser);
    return analyser;
  }
}

/**
 * Music Player — plays background music clips mapped to session phases.
 * Handles looping (crossfade when clip is shorter than phase),
 * fade-in/out on phase transitions, and a separate volume control.
 */
class MusicPlayer {
  constructor() {
    this.ctx = null;
    this.gainNode = null;
    this.volume = 0.3;
    this.enabled = true;
    this.buffers = {};      // keyed by phase name
    this.currentSource = null;
    this.loopTimer = null;
    this.fadeTimer = null;
    this._phaseEndFadeTimer = null;
  }

  // Phase-name → music file mapping
  static TRACK_MAP = {
    'Broadband Enrichment': 'music/broadband-enrichment.mp3',
    'Alpha Binaural': 'music/alpha-binaural.mp3',
    'Mixed Enrichment': 'music/mixed-enrichment.mp3',
    // Add more as clips are provided:
    // 'Theta Binaural': 'music/theta-binaural.mp3',
    // 'Low Frequency Sweep': 'music/lo-sweep.mp3',
    // 'Mid Frequency Sweep': 'music/mid-sweep.mp3',
    // 'High Frequency Sweep': 'music/hi-sweep.mp3',
    // 'Cool Down': 'music/cool-down.mp3',
  };

  init(audioCtx) {
    this.ctx = audioCtx;
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.ctx.destination);
  }

  setVolume(v) {
    this.volume = v;
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop();
  }

  async preloadAll() {
    const entries = Object.entries(MusicPlayer.TRACK_MAP);
    for (const [name, url] of entries) {
      if (this.buffers[name]) continue;
      try {
        const resp = await fetch(url);
        const arrayBuf = await resp.arrayBuffer();
        this.buffers[name] = await this.ctx.decodeAudioData(arrayBuf);
      } catch (e) {
        console.warn(`MusicPlayer: could not load ${url}`, e);
      }
    }
  }

  /**
   * Start music for a phase. Handles looping and scheduled fade-out.
   * @param {string} phaseName - The phase name to look up in TRACK_MAP
   * @param {number} phaseDuration - Phase duration in seconds
   * @param {object} opts - { fadeOutEarly: seconds before phase end to start fading }
   */
  playForPhase(phaseName, phaseDuration, opts = {}) {
    this.stop();
    if (!this.enabled) return;

    const buffer = this.buffers[phaseName];
    if (!buffer) return; // no music mapped for this phase

    const fadeIn = 3;          // seconds
    const fadeOut = opts.fadeOutEarly || 0; // seconds before end to start fading
    const crossfade = 2.5;     // loop crossfade duration
    const clipDuration = buffer.duration;

    const startSource = (offset = 0) => {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const env = this.ctx.createGain();
      // Fade in
      env.gain.value = 0;
      env.gain.linearRampToValueAtTime(1, this.ctx.currentTime + fadeIn);
      source.connect(env);
      env.connect(this.gainNode);
      source.start(0, offset);
      this.currentSource = source;
      this._currentEnv = env;
      return { source, env };
    };

    startSource();

    // Set up looping if clip is shorter than phase
    if (clipDuration < phaseDuration) {
      const loopAt = clipDuration - crossfade;
      const scheduleLoop = () => {
        this.loopTimer = setTimeout(() => {
          if (!this.currentSource) return;
          // Fade out current
          const now = this.ctx.currentTime;
          if (this._currentEnv) {
            this._currentEnv.gain.cancelScheduledValues(now);
            this._currentEnv.gain.setValueAtTime(this._currentEnv.gain.value, now);
            this._currentEnv.gain.linearRampToValueAtTime(0, now + crossfade);
          }
          const oldSource = this.currentSource;
          setTimeout(() => {
            try { oldSource.stop(); } catch(e) {}
            try { oldSource.disconnect(); } catch(e) {}
          }, (crossfade + 0.5) * 1000);
          // Start fresh
          startSource();
          scheduleLoop();
        }, loopAt * 1000);
      };
      scheduleLoop();
    }

    // Schedule phase-end fade-out
    if (fadeOut > 0) {
      const fadeStart = (phaseDuration - fadeOut) * 1000;
      this._phaseEndFadeTimer = setTimeout(() => {
        if (!this._currentEnv) return;
        const now = this.ctx.currentTime;
        this._currentEnv.gain.cancelScheduledValues(now);
        this._currentEnv.gain.setValueAtTime(this._currentEnv.gain.value, now);
        this._currentEnv.gain.linearRampToValueAtTime(0, now + fadeOut);
      }, fadeStart);
    }
  }

  stop() {
    if (this.loopTimer) { clearTimeout(this.loopTimer); this.loopTimer = null; }
    if (this._phaseEndFadeTimer) { clearTimeout(this._phaseEndFadeTimer); this._phaseEndFadeTimer = null; }
    if (this.currentSource) {
      if (this._currentEnv) {
        const now = this.ctx.currentTime;
        this._currentEnv.gain.cancelScheduledValues(now);
        this._currentEnv.gain.setValueAtTime(this._currentEnv.gain.value, now);
        this._currentEnv.gain.linearRampToValueAtTime(0, now + 2);
        const src = this.currentSource;
        setTimeout(() => {
          try { src.stop(); } catch(e) {}
          try { src.disconnect(); } catch(e) {}
        }, 2200);
      } else {
        try { this.currentSource.stop(); } catch(e) {}
        try { this.currentSource.disconnect(); } catch(e) {}
      }
      this.currentSource = null;
      this._currentEnv = null;
    }
  }
}

window.TympanIQEngine = TympanIQEngine;
window.MusicPlayer = MusicPlayer;
