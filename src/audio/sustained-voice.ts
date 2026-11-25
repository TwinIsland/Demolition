import type { Howl } from "howler";

type Timer = ReturnType<typeof setTimeout>;

/** Moves one playing sound to `volume` without the snap of a direct set. */
export function fadeTo(howl: Howl, id: number, volume: number, ms: number) {
  const from = howl.volume(id) as number;
  // Howler divides by the volume delta when it schedules fade steps.
  if (ms <= 0 || Math.abs(from - volume) < 0.005) howl.volume(volume, id);
  else howl.fade(from, volume, ms, id);
}

/** A single long-running sound (music track or ambience loop) that only ever fades in and out. */
export class SustainedVoice {
  private id?: number;
  private active = false;
  private target = 0;
  private pauseTimer?: Timer;

  constructor(readonly howl: Howl) {
    // Autoplay can be refused before the first gesture (HTML5 fallback); start again once unlocked.
    howl.on("playerror", () =>
      howl.once("unlock", () => {
        if (!this.active) return;
        this.active = false;
        this.fadeIn(this.target, 0);
      }),
    );
  }

  /** True from fade-in until the fade-out has finished. */
  get playing() {
    return this.active;
  }

  /** True while samples are actually being produced. */
  get audible() {
    return this.active && this.id !== undefined && this.howl.playing(this.id);
  }

  fadeIn(volume: number, ms: number, restart = false) {
    clearTimeout(this.pauseTimer);
    this.target = volume;
    if (this.active && this.id !== undefined) return fadeTo(this.howl, this.id, volume, ms);
    if (restart && this.id !== undefined) this.howl.seek(0, this.id);
    this.id = this.howl.play(this.id);
    this.active = true;
    if (ms > 0) this.howl.fade(0, volume, ms, this.id);
    else this.howl.volume(volume, this.id);
  }

  /** Retargets the level of a voice that is already playing. */
  setVolume(volume: number, ms: number) {
    if (!this.active || this.id === undefined) return;
    this.target = volume;
    fadeTo(this.howl, this.id, volume, ms);
  }

  /** Fades to silence, then pauses so the next fade-in resumes from the same position. */
  fadeOut(ms: number) {
    const id = this.id;
    if (!this.active || id === undefined) return;
    this.target = 0;
    fadeTo(this.howl, id, 0, ms);
    clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      this.howl.pause(id);
      this.active = false;
    }, ms + 20);
  }

  dispose() {
    clearTimeout(this.pauseTimer);
    this.active = false;
    this.howl.unload();
  }
}
