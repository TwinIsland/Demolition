/** Longest frame, in seconds, handed to the session: a background tab must not replay minutes of match. */
const MAX_FRAME_SECONDS = 0.1;

export type FrameScheduler = (callback: (timeMs: number) => void) => void;

/**
 * Turns display frames into `(now, dt)` in seconds. The loop itself is variable-rate; the session
 * accumulates `dt` and steps the authoritative simulation at its fixed 60 Hz.
 */
export class GameLoop {
  private previous = 0;

  constructor(private readonly onFrame: (now: number, dt: number) => void) {}

  start(schedule: FrameScheduler) {
    schedule((timeMs) => {
      const now = timeMs / 1000;
      const dt = this.previous ? Math.min(MAX_FRAME_SECONDS, now - this.previous) : 0;
      this.previous = now;
      this.onFrame(now, dt);
    });
  }

  /** Forgets the last timestamp so time spent off the loop does not arrive as one large step. */
  resetClock() {
    this.previous = 0;
  }
}

/** Gate for work that should run at most once per `interval` seconds of frame time. */
export class Throttle {
  private next = 0;

  constructor(private readonly interval: number) {}

  ready(now: number): boolean {
    if (now < this.next) return false;
    this.next = now + this.interval;
    return true;
  }
}
