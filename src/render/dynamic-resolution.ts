/** Frame-time budget in seconds: a little slower than 60 Hz, so vsync jitter does not trigger a drop. */
const OVER_BUDGET = 1 / 52;
/** Frames this fast leave headroom to try a higher resolution again. */
const UNDER_BUDGET = 1 / 57;
const MIN_SCALE = 0.75;
const STEP_DOWN = 0.125;
const STEP_UP = 0.0625;
/** Seconds of sustained slowness before resolution drops. */
const DROP_AFTER = 0.6;
/** Seconds of sustained headroom before the first attempt to raise it. */
const RAISE_AFTER = 4;
const MAX_RAISE_AFTER = 32;

/**
 * Trades resolution for frame rate. The scale steps down while frames run over budget and
 * creeps back up when there is headroom. Under vsync a fast frame only proves the current
 * scale is affordable, so each raise that is followed by a drop doubles the wait before the
 * next attempt.
 */
export class DynamicResolution {
  scale = 1;
  private average = 1 / 60;
  private slowFor = 0;
  private fastFor = 0;
  private raiseAfter = RAISE_AFTER;
  private raisedAt = -Infinity;
  private clock = 0;

  /** Feed one frame's duration in seconds. Returns true when `scale` changed. */
  sample(dt: number) {
    // Tab switches and loading hitches say nothing about steady-state cost.
    if (!(dt > 0) || dt > 0.25) return false;
    this.clock += dt;
    this.average += (dt - this.average) * 0.12;
    this.slowFor = this.average > OVER_BUDGET ? this.slowFor + dt : 0;
    this.fastFor = this.average < UNDER_BUDGET ? this.fastFor + dt : 0;
    if (this.slowFor > DROP_AFTER && this.scale > MIN_SCALE) {
      if (this.clock - this.raisedAt < 3) this.raiseAfter = Math.min(MAX_RAISE_AFTER, this.raiseAfter * 2);
      return this.set(Math.max(MIN_SCALE, this.scale - STEP_DOWN));
    }
    if (this.fastFor > this.raiseAfter && this.scale < 1) {
      this.raisedAt = this.clock;
      return this.set(Math.min(1, this.scale + STEP_UP));
    }
    return false;
  }

  reset() {
    this.scale = 1;
    this.slowFor = this.fastFor = 0;
    this.raiseAfter = RAISE_AFTER;
    this.average = 1 / 60;
  }

  private set(scale: number) {
    this.scale = scale;
    this.slowFor = this.fastFor = 0;
    // A resize reallocates every post-processing buffer; do not judge the frames that pay for it.
    this.average = 1 / 60;
    return true;
  }
}
