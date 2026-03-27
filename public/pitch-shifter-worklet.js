/**
 * Two-tap crossfading delay-line pitch shifter (AudioWorkletProcessor)
 * Shifts pitch without changing tempo. Works well for ±30% shifts on ambient music.
 *
 * Algorithm: Write input at normal speed into a circular buffer. Two read
 * pointers advance at pitchRatio speed. A raised-cosine crossfade ensures
 * smooth transitions when a pointer wraps. Output is always at original tempo.
 */
class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.pitchRatio = options.processorOptions?.pitchRatio || 1.0;

    // Grain size controls latency vs quality — 2048 is good for music
    this.grainSize = 2048;
    // Buffer must be > 2x grain size
    this.bufSize = this.grainSize * 4;
    this.bufL = new Float32Array(this.bufSize);
    this.bufR = new Float32Array(this.bufSize);
    this.writePos = 0;

    // Two read heads offset by half a grain for continuous crossfade
    this.readPos0 = 0;
    this.readPos1 = this.grainSize;

    this.port.onmessage = (e) => {
      if (e.data.pitchRatio !== undefined) {
        this.pitchRatio = e.data.pitchRatio;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inL = input[0];
    const inR = input.length > 1 ? input[1] : inL;
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : outL;
    const n = outL.length;
    const bs = this.bufSize;
    const gs = this.grainSize;
    const ratio = this.pitchRatio;

    for (let i = 0; i < n; i++) {
      // Write input into circular buffer
      this.bufL[this.writePos] = inL[i];
      this.bufR[this.writePos] = inR[i];

      // Linear interpolation read for tap 0
      const i0 = this.readPos0 | 0;
      const f0 = this.readPos0 - i0;
      const i0a = i0 % bs;
      const i0b = (i0 + 1) % bs;
      const s0L = this.bufL[i0a] + f0 * (this.bufL[i0b] - this.bufL[i0a]);
      const s0R = this.bufR[i0a] + f0 * (this.bufR[i0b] - this.bufR[i0a]);

      // Linear interpolation read for tap 1
      const i1 = this.readPos1 | 0;
      const f1 = this.readPos1 - i1;
      const i1a = i1 % bs;
      const i1b = (i1 + 1) % bs;
      const s1L = this.bufL[i1a] + f1 * (this.bufL[i1b] - this.bufL[i1a]);
      const s1R = this.bufR[i1a] + f1 * (this.bufR[i1b] - this.bufR[i1a]);

      // Crossfade weights based on distance from write pointer within grain cycle
      const d0 = ((this.readPos0 - this.writePos + bs * 2) % bs) % gs;
      const d1 = ((this.readPos1 - this.writePos + bs * 2) % bs) % gs;
      // Raised cosine window: peaks at center of grain, zero at edges
      const w0 = 0.5 * (1 - Math.cos(2 * Math.PI * d0 / gs));
      const w1 = 0.5 * (1 - Math.cos(2 * Math.PI * d1 / gs));
      const wSum = w0 + w1 + 1e-8;

      outL[i] = (s0L * w0 + s1L * w1) / wSum;
      outR[i] = (s0R * w0 + s1R * w1) / wSum;

      // Advance read pointers at pitch ratio speed
      this.readPos0 += ratio;
      this.readPos1 += ratio;

      // Keep read pointers in buffer range
      if (this.readPos0 >= bs) this.readPos0 -= bs;
      if (this.readPos1 >= bs) this.readPos1 -= bs;

      // If a read pointer is about to collide with write pointer, jump it ahead
      const gap0 = ((this.readPos0 - this.writePos + bs) % bs);
      const gap1 = ((this.readPos1 - this.writePos + bs) % bs);
      if (gap0 < 4 || gap0 > bs - 4) {
        this.readPos0 = (this.writePos + gs) % bs;
      }
      if (gap1 < 4 || gap1 > bs - 4) {
        this.readPos1 = (this.writePos + gs * 2) % bs;
      }

      this.writePos = (this.writePos + 1) % bs;
    }

    return true;
  }
}

registerProcessor('pitch-shifter', PitchShifterProcessor);
