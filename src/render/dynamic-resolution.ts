/** Frame-time budget in seconds: a little slower than 60 Hz, so vsync jitter does not trigger a drop. */
const OVER_BUDGET = 1 / 52;
/** Three coarse levels: every change reallocates the post-processing buffers, which costs a frame. */
const LEVELS = [1, 0.85, 0.72];
/** Seconds of sustained slowness before resolution drops. */
const DROP_AFTER = 1;

/**
 * Trades resolution for frame rate. The scale steps down while frames run over budget and then
 * stays there until `reset`, which the renderer calls between matches. It never creeps back up
 * mid-match: under vsync a fast frame only proves the current scale is affordable, and probing
 * for more showed up as a hitch every few seconds on machines near the limit.
 */
export class DynamicResolution {
  scale = 1;
  private level = 0;
  private average = 1 / 60;
  private slowFor = 0;

  /** Feed one frame's duration in seconds. Returns true when `scale` changed. */
  sample(dt: number) {
    // Tab switches and loading hitches say nothing about steady-state cost.
    if (!(dt > 0) || dt > 0.25) return false;
    this.average += (dt - this.average) * 0.12;
    this.slowFor = this.average > OVER_BUDGET ? this.slowFor + dt : 0;
    if (this.slowFor <= DROP_AFTER || this.level >= LEVELS.length - 1) return false;
    this.scale = LEVELS[++this.level];
    this.slowFor = 0;
    // Do not judge the frames that pay for the resize.
    this.average = 1 / 60;
    return true;
  }

  /** Back to full resolution. Returns true when `scale` changed. */
  reset() {
    const changed = this.level !== 0;
    this.level = 0;
    this.scale = 1;
    this.slowFor = 0;
    this.average = 1 / 60;
    return changed;
  }
}
