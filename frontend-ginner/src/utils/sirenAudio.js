/**
 * Native Browser WebAudio API Industrial Klaxon Siren (880Hz / 660Hz Pulsing Square Wave).
 * Zero external MP3 dependencies — triggers instantaneously (<2ms) on contamination >= 70%.
 */

class IndustrialSirenSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.stopTimer = null;
    this.pulseInterval = null;
    this.osc = null;
    this.gain = null;
    this.muted = false;
  }

  _ensureContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  unlock() {
    this._ensureContext();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) {
      this.stop();
    }
  }

  triggerKlaxon(durationMs = 2400) {
    if (this.muted) return;
    this._ensureContext();
    if (!this.audioCtx) return;

    if (this.isPlaying) {
      // Extend active siren window slightly without stacking oscillators
      clearTimeout(this.stopTimer);
      this.stopTimer = setTimeout(() => this.stop(), durationMs);
      return;
    }

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.14, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();

      let highTone = true;
      this.pulseInterval = setInterval(() => {
        if (!this.audioCtx || !this.isPlaying) return;
        highTone = !highTone;
        osc.frequency.setValueAtTime(highTone ? 880 : 660, this.audioCtx.currentTime);
      }, 180);

      this.osc = osc;
      this.gain = gain;
      this.isPlaying = true;

      this.stopTimer = setTimeout(() => this.stop(), durationMs);
    } catch {
      this.isPlaying = false;
    }
  }

  stop() {
    clearTimeout(this.stopTimer);
    clearInterval(this.pulseInterval);
    if (this.osc) {
      try {
        this.osc.stop();
        this.osc.disconnect();
      } catch {
        // Ignore already-stopped oscillator
      }
      this.osc = null;
    }
    if (this.gain) {
      try {
        this.gain.disconnect();
      } catch {
        // Ignore
      }
      this.gain = null;
    }
    this.isPlaying = false;
  }
}

export const industrialSiren = new IndustrialSirenSynthesizer();

