import { Howl } from "howler";
import { STORY_MUSIC } from "./sound-bank";
import type { SpectrumReader } from "../ui/credits-spectrum";

export const MUSIC_BOX_TRACKS = [
  { title: "电动少女 (8-Bit Remix)", artist: "Chinese Football", url: STORY_MUSIC.opening },
  { title: "Share Friendship", artist: "黒魔", url: STORY_MUSIC.duel },
  { title: "Clumsy Communication", artist: "黒魔", url: STORY_MUSIC.lesson },
  { title: "献花の番人", artist: "黒魔", url: STORY_MUSIC.shutdown },
  { title: "人间失格 Human Lost", artist: "Chinese Football", url: STORY_MUSIC.farewell },
  { title: "电动少女", artist: "Chinese Football", url: STORY_MUSIC.home },
] as const;

/** A temporary Web Audio player: uses the game's mixer and releases every voice on close. */
export class MusicPlayer {
  private howl?: Howl;
  private closed = false;
  private requestedPlay = true;
  index = 0;
  error = false;

  constructor(
    initialUrl: string | undefined,
    private readonly mix: (url: string) => { level: number; volume: number; muted: boolean },
    readonly spectrum: SpectrumReader,
    private readonly restore: () => void,
  ) {
    const index = MUSIC_BOX_TRACKS.findIndex((track) => track.url === initialUrl);
    this.select(Math.max(0, index));
  }

  get track() {
    return MUSIC_BOX_TRACKS[this.index];
  }

  get playing() {
    return this.requestedPlay && !this.error;
  }

  get loading() {
    return this.howl?.state() !== "loaded" && !this.error;
  }

  get position() {
    return Number(this.howl?.seek()) || 0;
  }

  get duration() {
    return this.howl?.duration() ?? 0;
  }

  get volume() {
    return this.mix(this.track.url).volume;
  }

  get muted() {
    return this.mix(this.track.url).muted;
  }

  select(index: number) {
    if (this.closed) return;
    this.howl?.unload();
    this.index = (index + MUSIC_BOX_TRACKS.length) % MUSIC_BOX_TRACKS.length;
    this.error = false;
    this.requestedPlay = true;
    const howl = new Howl({
      src: [this.track.url],
      html5: false,
      volume: this.mix(this.track.url).level,
      onend: () => this.select(this.index + 1),
      onloaderror: () => {
        this.error = true;
      },
      onplayerror: () => {
        this.error = true;
        howl.once("unlock", () => {
          if (this.closed || this.howl !== howl || !this.requestedPlay) return;
          this.error = false;
          howl.play();
        });
      },
    });
    this.howl = howl;
    howl.play();
  }

  toggle() {
    if (this.error) return this.select(this.index);
    this.requestedPlay = !this.requestedPlay;
    if (this.requestedPlay) this.howl?.play();
    else this.howl?.pause();
  }

  seek(seconds: number) {
    if (this.howl?.state() === "loaded") this.howl.seek(Math.max(0, Math.min(this.duration, seconds)));
  }

  syncVolume() {
    this.howl?.volume(this.mix(this.track.url).level);
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.howl?.unload();
    this.restore();
  }
}
