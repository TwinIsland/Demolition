const FFT_SIZE = 2048;
const BASS_LOW_HZ = 32;
const BASS_HIGH_HZ = 150;
/** Decibel window of the byte spectrum for a signal at unity gain. */
const MIN_DB = -84;
const MAX_DB = -16;
const SAMPLE_INTERVAL = 1 / 60;

/** Turns bass-band energy onsets into a decaying 0..1 pulse for the menu backdrop. */
export class BassPulse {
  private configured?: AnalyserNode;
  private bins = new Uint8Array(0);
  private firstBin = 1;
  private offsetDb = Number.NaN;
  private floor = 0;
  private pulse = 0;
  private lastSample = -Infinity;

  reset() {
    this.lastSample = -Infinity;
    this.pulse = 0;
    return 0;
  }

  /**
   * @param time seconds on the caller's clock
   * @param gain linear gain already applied to the analysed signal; the decibel window follows
   *   it so the pulse does not depend on the music volume
   */
  sample(analyser: AnalyserNode, time: number, gain: number) {
    if (gain <= 0) return this.reset();
    const dt = time - this.lastSample;
    if (dt < SAMPLE_INTERVAL) return this.pulse;
    this.lastSample = time;
    this.configure(analyser, gain);
    analyser.getByteFrequencyData(this.bins);
    let energy = 0;
    for (let i = this.firstBin; i < this.bins.length; i++) energy += (this.bins[i] / 255) ** 2;
    energy /= Math.max(1, this.bins.length - this.firstBin);
    // After a gap the running floor is stale; restart it instead of reporting a false onset.
    if (dt > 0.5) this.floor = energy;
    const attack = Math.max(0, energy - this.floor - 0.018);
    this.floor += (energy - this.floor) * (1 - Math.exp(-dt * 3.8));
    this.pulse = Math.max(this.pulse * Math.exp(-dt * 12), Math.min(1, attack * 4));
    return this.pulse;
  }

  private configure(analyser: AnalyserNode, gain: number) {
    if (this.configured !== analyser) {
      this.configured = analyser;
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.3;
      const binHz = analyser.context.sampleRate / FFT_SIZE;
      this.bins = new Uint8Array(Math.ceil(BASS_HIGH_HZ / binHz));
      this.firstBin = Math.max(1, Math.ceil(BASS_LOW_HZ / binHz));
      this.offsetDb = Number.NaN;
    }
    const offsetDb = Math.min(0, 20 * Math.log10(gain));
    if (offsetDb === this.offsetDb) return;
    this.offsetDb = offsetDb;
    // minDecibels must stay below maxDecibels at every step; start from the widest window.
    analyser.minDecibels = -200;
    analyser.maxDecibels = MAX_DB + offsetDb;
    analyser.minDecibels = MIN_DB + offsetDb;
  }
}
