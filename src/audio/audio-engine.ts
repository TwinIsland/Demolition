import { Howl, Howler } from "howler";
import { AUDIO_BUSES, type AudioBus, type CueSpec } from "./sound-bank";
import { SustainedVoice } from "./sustained-voice";

/** One-shot voices across all cues; beyond this only priority plays are admitted. */
const MAX_VOICES = 16;
const MIN_AUDIBLE = 0.01;
const RELEASE_MS = 60;
const CROSSFADE_MS = 700;
const LOOP_FADE_MS = 350;
const BUS_FADE_MS = 120;
const DUCK_ATTACK_MS = 60;

export interface PlayOptions {
  /** Replaces the cue's bank volume (content-defined cues carry no mix level). */
  level?: number;
  /** Multiplier for distance attenuation and similar per-play scaling. */
  gain?: number;
  /** Stereo position, -1 (left) to 1 (right). */
  pan?: number;
  /** Admitted even when the voice budget is full. */
  priority?: boolean;
  /** Playback-rate multiplier; above 1 raises the pitch. */
  rate?: number;
}

export interface MusicOptions {
  volume: number;
  /** Stream through an HTML5 element instead of decoding the whole file. */
  stream?: boolean;
  /** Start from the top instead of resuming where the track was faded out. */
  restart?: boolean;
}

interface CuePool {
  howl: Howl;
  lastPlayedAt: number;
}
interface Voice {
  howl: Howl;
  id: number;
  bus: AudioBus;
}
interface Sustained {
  voice: SustainedVoice;
  /** Level before bus volume. */
  level: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Howler-backed mixer: pooled one-shots, sustained loops, crossfading music and bus volumes. */
export class AudioEngine {
  private readonly buses = Object.fromEntries(AUDIO_BUSES.map((bus) => [bus, 1])) as Record<AudioBus, number>;
  private master = 1;
  private readonly pools = new Map<string, CuePool>();
  private readonly loops = new Map<string, Sustained & { bus: AudioBus }>();
  private readonly tracks = new Map<string, Sustained>();
  private voices: Voice[] = [];
  private musicUrl?: string;
  private crossfadeUntil = -Infinity;
  private duckTimer?: ReturnType<typeof setTimeout>;
  private analyser?: AnalyserNode;
  private isMuted = false;

  constructor() {
    // Music may be the only sound for minutes; a suspended context would stall the menu spectrum.
    Howler.autoSuspend = false;
  }

  get muted() {
    return this.isMuted;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    Howler.mute(muted);
    // Tails must not reappear when the mix is switched back on.
    if (muted) this.stopVoices(undefined, 0);
  }

  get masterVolume() {
    return this.master;
  }

  /** Output fader over every bus; independent of the mute switch. */
  setMasterVolume(volume: number) {
    this.master = clamp01(volume);
    Howler.volume(this.master);
  }

  busVolume(bus: AudioBus) {
    return this.buses[bus];
  }

  setBusVolume(bus: AudioBus, volume: number) {
    this.buses[bus] = clamp01(volume);
    if (bus === "music") this.currentTrack()?.voice.setVolume(this.musicGain(), BUS_FADE_MS);
    for (const loop of this.loops.values())
      if (loop.bus === bus) loop.voice.setVolume(clamp01(loop.level * this.buses[bus]), BUS_FADE_MS);
  }

  preload(specs: Iterable<CueSpec>) {
    for (const spec of specs) this.pool(spec);
  }

  /** Creates a music track without starting it, so its data is fetched ahead of use. */
  preloadMusic(url: string, stream = false) {
    this.track(url, stream);
  }

  /**
   * One promise per sound created so far (cues, loops and music). Each settles when its file is
   * decoded or has failed: a missing sound must not block the game from starting.
   */
  loading(): Promise<void>[] {
    const howls = [
      ...[...this.pools.values()].map((pool) => pool.howl),
      ...[...this.loops.values(), ...this.tracks.values()].map((entry) => entry.voice.howl),
    ];
    return howls.map(
      (howl) =>
        new Promise<void>((resolve) => {
          if (howl.state() === "loaded") return resolve();
          howl.once("load", () => resolve());
          howl.once("loaderror", () => resolve());
        }),
    );
  }

  play(
    spec: CueSpec,
    { level = spec.volume, gain = 1, pan = 0, priority = false, rate = 1 }: PlayOptions = {},
  ) {
    if (this.isMuted || !this.canStart()) return;
    const volume = clamp01(level * gain * this.buses[spec.bus]);
    if (volume < MIN_AUDIBLE) return;
    const pool = this.pool(spec);
    const now = performance.now();
    if (now - pool.lastPlayedAt < spec.minInterval * 1000) return;

    this.voices = this.voices.filter((voice) => voice.howl.playing(voice.id));
    const sameCue = this.voices.filter((voice) => voice.howl === pool.howl);
    if (sameCue.length >= spec.voices) this.release(sameCue[0]);
    else if (this.voices.length >= MAX_VOICES) {
      if (!priority) return;
      this.release(this.voices[0]);
    }

    pool.lastPlayedAt = now;
    const { howl } = pool;
    const id = howl.play();
    howl.volume(volume, id);
    const jitter = spec.pitchJitter ? 1 + (Math.random() * 2 - 1) * spec.pitchJitter : 1;
    // Always set the rate: a pooled voice may still carry the rate of its previous play.
    howl.rate(rate * jitter, id);
    if (Math.abs(pan) > 0.02 && Howler.usingWebAudio) howl.stereo(pan, id);
    this.voices.push({ howl, id, bus: spec.bus });
  }

  /** Releases one-shots, optionally only those on `bus`, and forgets rate-limit history. */
  stopVoices(bus?: AudioBus, fadeMs = RELEASE_MS) {
    for (const voice of this.voices) if (!bus || voice.bus === bus) this.release(voice, fadeMs);
    for (const pool of this.pools.values()) pool.lastPlayedAt = -Infinity;
  }

  /** Drives a looping bed; level 0 fades it out and pauses it (and preloads it on first use). */
  setLoopLevel(spec: CueSpec, level: number) {
    let loop = this.loops.get(spec.url);
    if (!loop) {
      const howl = new Howl({ src: [spec.url], loop: true, volume: 0 });
      loop = { voice: new SustainedVoice(howl), level: 0, bus: spec.bus };
      this.loops.set(spec.url, loop);
    }
    loop.level = spec.volume * level;
    if (level <= 0) loop.voice.fadeOut(LOOP_FADE_MS);
    else loop.voice.fadeIn(clamp01(loop.level * this.buses[spec.bus]), LOOP_FADE_MS);
  }

  /** Crossfades to `url`; a no-op when it is already the current track. */
  playMusic(url: string, { volume, stream = false, restart = false }: MusicOptions) {
    if (url === this.musicUrl) return;
    clearTimeout(this.duckTimer);
    this.currentTrack()?.voice.fadeOut(CROSSFADE_MS);
    const track = this.track(url, stream);
    track.level = volume;
    this.musicUrl = url;
    this.crossfadeUntil = performance.now() + CROSSFADE_MS;
    track.voice.fadeIn(this.musicGain(), CROSSFADE_MS, restart);
  }

  /** Fades the current track out and leaves silence until the next `playMusic`. */
  stopMusic() {
    clearTimeout(this.duckTimer);
    this.currentTrack()?.voice.fadeOut(CROSSFADE_MS);
    this.musicUrl = undefined;
  }

  /** Borrows the music bus, keeping the story's position for the return from the music box. */
  holdMusic() {
    const url = this.musicUrl;
    const level = this.currentTrack()?.level ?? 0;
    clearTimeout(this.duckTimer);
    for (const track of this.tracks.values()) track.voice.pause();
    this.musicUrl = undefined;
    return {
      url,
      resume: () => {
        if (url) this.playMusic(url, { volume: level });
      },
    };
  }

  /** True while `url` is the current track and is producing sound. */
  isMusicAudible(url: string) {
    return !this.isMuted && url === this.musicUrl && !!this.currentTrack()?.voice.audible;
  }

  /** Linear gain the current track settles at (track level times bus volume), before the master fader. */
  musicGain() {
    return clamp01((this.currentTrack()?.level ?? 0) * this.buses.music);
  }

  /** Dips the music to `depth` of its level, holds, then eases back, leaving room for a loud effect. */
  duckMusic(depth = 0.45, holdMs = 240, releaseMs = 900) {
    const track = this.currentTrack();
    if (!track?.voice.playing || performance.now() < this.crossfadeUntil) return;
    track.voice.setVolume(this.musicGain() * depth, DUCK_ATTACK_MS);
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(
      () => this.currentTrack()?.voice.setVolume(this.musicGain(), releaseMs),
      DUCK_ATTACK_MS + holdMs,
    );
  }

  /**
   * Analyser fed by everything routed through Web Audio (post-fader), or undefined while the
   * context is unavailable or not yet running.
   */
  spectrumTap(): AnalyserNode | undefined {
    if (!Howler.usingWebAudio || !Howler.ctx || !Howler.masterGain) return undefined;
    if (Howler.ctx.state !== "running") return undefined;
    if (this.analyser?.context !== Howler.ctx) {
      // A dead-end branch: the analyser only observes, the audible path stays Howler's.
      this.analyser = Howler.ctx.createAnalyser();
      Howler.masterGain.connect(this.analyser);
    }
    return this.analyser;
  }

  dispose() {
    clearTimeout(this.duckTimer);
    for (const { voice } of [...this.tracks.values(), ...this.loops.values()]) voice.dispose();
    for (const { howl } of this.pools.values()) howl.unload();
    this.tracks.clear();
    this.loops.clear();
    this.pools.clear();
    this.voices = [];
    this.musicUrl = undefined;
    if (this.analyser?.context === Howler.ctx) Howler.masterGain.disconnect(this.analyser);
    this.analyser = undefined;
  }

  private currentTrack() {
    return this.musicUrl === undefined ? undefined : this.tracks.get(this.musicUrl);
  }

  private track(url: string, stream: boolean) {
    let track = this.tracks.get(url);
    if (!track) {
      const howl = new Howl({ src: [url], loop: true, volume: 0, html5: stream });
      track = { voice: new SustainedVoice(howl), level: 0 };
      this.tracks.set(url, track);
    }
    return track;
  }

  private pool(spec: CueSpec) {
    let pool = this.pools.get(spec.url);
    if (!pool) {
      pool = { howl: new Howl({ src: [spec.url], pool: spec.voices }), lastPlayedAt: -Infinity };
      this.pools.set(spec.url, pool);
    }
    return pool;
  }

  /**
   * Howler queues plays made while the context is locked and fires them all on unlock; only
   * accept a play that the current gesture is about to unlock.
   */
  private canStart() {
    if (!Howler.usingWebAudio || !Howler.ctx) return true;
    return Howler.ctx.state === "running" || !!navigator.userActivation?.isActive;
  }

  private release({ howl, id }: Voice, fadeMs = RELEASE_MS) {
    if (fadeMs <= 0 || !howl.playing(id)) {
      howl.stop(id);
      return;
    }
    howl.fade(howl.volume(id) as number, 0, fadeMs, id);
    setTimeout(() => howl.stop(id), fadeMs + 10);
  }
}
