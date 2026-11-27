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
    const id = (this.id = this.howl.play(this.id));
    this.active = true;
    const rise = () => {
      if (!this.active || this.id !== id) return;
      if (ms > 0) this.howl.fade(0, this.target, ms, id);
      else this.howl.volume(this.target, id);
    };
    // A streamed (HTML5) sound is locked until the browser has started it. Howler queues a fade
    // asked for meanwhile and then never runs it, leaving the track silent, so wait for the start.
    if (this.streamed) this.howl.once("play", rise, id);
    else rise();
  }

  /** Whether the sound plays through an audio element instead of a decoded buffer. */
  private get streamed() {
    return (this.howl as unknown as { _html5?: boolean })._html5 === true;
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

  /** Holds the exact position while another player temporarily owns the music bus. */
  pause() {
    clearTimeout(this.pauseTimer);
    this.active = false;
    if (this.id !== undefined) this.howl.pause(this.id);
  }

  dispose() {
    clearTimeout(this.pauseTimer);
    this.active = false;
    this.howl.unload();
  }
}
