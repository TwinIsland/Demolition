import { bombWarning, finalCountdown } from "../core/bomb-warning";
import { ITEMS, PERKS, SKILLS, TIERS, isEquipment, perkById } from "../core/content";
import type { GameEvent, GameSnapshot, Player, Vec2 } from "../core/types";
import { SUMMON_TIME } from "../core/zombies";
import { AudioEngine } from "./audio-engine";
import type { PlayOptions } from "./audio-engine";
import { BassPulse } from "./bass-pulse";
import { MAPS } from "../core/maps";
import { groundAt, type GroundKind } from "../core/pack-api";
import {
  BANK_CUES,
  CREDITS_MUSIC,
  FIRE_LOOP,
  JUNGLE_LOOP,
  POOL_LOOP,
  OFFICE_LOOP,
  MENU_MUSIC,
  MUSIC_VOLUME,
  RAIN_LOOP,
  THUNDER,
  cue,
  type CueSpec,
} from "./sound-bank";
import { distanceTo, falloff, panTo } from "./spatial";
import { faderGain, loadVolumes, saveVolumes, type VolumeChannel, type Volumes } from "./volume-settings";
import type { Listener } from "./spatial";

const MENU_CUES = { click: "ui-click", accept: "ui-accept", back: "ui-back" } as const;
const STRIDE_LENGTH = 0.85;
const BLAST_RING_COOLDOWN = 1.45;
/** Footstep cue family for each kind of ground; paving and slabs share the hard step. */
const STEP_FAMILY: Record<GroundKind, string> = {
  slab: "footstep",
  stone: "footstep",
  grass: "footstep-grass",
  mud: "footstep-mud",
  water: "footstep-water",
  carpet: "footstep-carpet",
};

/** Levels for cues whose file is chosen by a content module, by the role they play. */
const LEVEL = {
  equipmentUse: 0.46,
  meleeSwing: 0.46,
  meleeHit: 0.6,
  coverHit: 0.58,
  shieldBroken: 0.7,
  shieldExpired: 0.45,
  skill: 0.42,
  perk: 0.46,
  landing: 0.7,
} as const;
/** How far, in cells, the actions of other operators and of zombies carry. */
/**
 * Linear, like the game the zombie voices come from: full level beside the listener, silent at
 * the range. Zombies carry furthest because hearing them coming is the point.
 */
const EARSHOT = { action: 7, kick: 8, fall: 10, zombie: 9, groan: 12, zombieStep: 9, step: 9 } as const;
/** Seconds between one zombie's idle groans, shortest to longest; the first comes sooner. */
const GROAN_GAP = [3, 7.5] as const;
/** Cells a zombie shuffles between footfalls. */
const ZOMBIE_STRIDE = 0.75;
const GROANS = 3;
const ZOMBIE_STEPS = 3;

/** What the audio remembers of one zombie between snapshots. */
interface ZombieTrace extends Vec2 {
  travel: number;
  step: number;
  nextGroan: number;
  struck?: number;
}

interface Stride extends Vec2 {
  travel: number;
  index: number;
}

/** Maps snapshots and UI moments to cues. Recordings only, except the rain bed and thunder, which are noise rendered offline to files. */
export class GameAudio {
  private readonly engine = new AudioEngine();
  private readonly menuPulse = new BassPulse();
  private readonly faders = loadVolumes();
  private readonly strides = new Map<string, Stride>();
  private readonly fuseBeats = new Map<number, number>();
  private fireLevel = 0;
  private rainLevel = 0;
  private bed?: CueSpec;
  private lastResetId?: number;
  private lastResetSecond?: number;
  private countdownBeat?: string;
  private collapseBeat?: number;
  private aimedCell?: Vec2;
  private lastEventId = 0;
  private nextBlastRing = 0;
  /** State of the previous snapshot, for the cues that mark a change rather than an event. */
  private readonly seen = {
    primed: false,
    skills: new Set<string>(),
    sliding: new Set<number>(),
    airborne: new Set<string>(),
    fallen: new Set<string>(),
    zombies: new Map<number, ZombieTrace>(),
    ringsClosed: 0,
  };

  constructor() {
    for (const channel of Object.keys(this.faders) as VolumeChannel[]) this.applyVolume(channel);
    this.engine.preload([...BANK_CUES, ...contentCues()].map(cue));
    this.engine.preload(Object.values(THUNDER));
    this.engine.setLoopLevel(FIRE_LOOP, 0);
    this.engine.setLoopLevel(RAIN_LOOP, 0);
    this.engine.setLoopLevel(JUNGLE_LOOP, 0);
    this.engine.setLoopLevel(POOL_LOOP, 0);
    this.engine.setLoopLevel(OFFICE_LOOP, 0);
    this.engine.playMusic(MENU_MUSIC, { volume: MUSIC_VOLUME });
  }

  get enabled() {
    return !this.engine.muted;
  }

  toggle() {
    this.engine.setMuted(!this.engine.muted);
    return this.enabled;
  }

  /** Fader positions (0..1) as the player set them. */
  get volumes(): Readonly<Volumes> {
    return this.faders;
  }

  /** Moves one fader; heard at once and remembered for the next visit. */
  setVolume(channel: VolumeChannel, position: number) {
    this.faders[channel] = Math.max(0, Math.min(1, position));
    this.applyVolume(channel);
    saveVolumes(this.faders);
  }

  /** A sample at the fader's new level. Music needs none: the menu track is already playing. */
  previewVolume(channel: VolumeChannel) {
    if (channel === "sfx") this.play("blast", { priority: true });
    else if (channel === "steps") this.play("footstep-0", { priority: true });
    else if (channel === "ambience") this.engine.play(THUNDER.far, { priority: true });
    else if (channel !== "music") this.menu();
  }

  /**
   * Fetches every cue, loop and music track up front, including one field track per map, so that
   * nothing is requested mid-match. Returns one promise per sound for the loading screen.
   */
  preloadAll(fieldTracks: Iterable<string>): Promise<void>[] {
    for (const url of fieldTracks) if (url) this.engine.preloadMusic(url, url !== CREDITS_MUSIC);
    return this.engine.loading();
  }

  /** Menu music resumes; credits decode like the menu, while field tracks stream. */
  setMusic(path: string) {
    const menu = path === MENU_MUSIC;
    // A map may ask for its own track to sit higher or lower in the mix.
    const gain = menu ? 1 : (MAPS.find((map) => map.bgm === path)?.bgmGain ?? 1);
    this.engine.playMusic(path, {
      volume: Math.min(1, MUSIC_VOLUME * gain),
      stream: !menu && path !== CREDITS_MUSIC,
      restart: !menu,
    });
  }

  /** Reuses the mixer tap for the live spectrum on the closing credits card. */
  creditsSpectrum() {
    if (!this.engine.isMusicAudible(CREDITS_MUSIC)) return undefined;
    const analyser = this.engine.spectrumTap();
    const gain = this.engine.musicGain() * this.engine.masterVolume;
    return analyser && gain > 0 ? { analyser, gain } : undefined;
  }

  /** Bass-onset pulse (0..1) of the menu track for the lobby backdrop; `time` in seconds. */
  menuBeat(time: number) {
    const analyser = this.engine.isMusicAudible(MENU_MUSIC) ? this.engine.spectrumTap() : undefined;
    // The tap sits after the master fader, so the pulse has to discount both gains.
    const gain = this.engine.musicGain() * this.engine.masterVolume;
    return analyser ? this.menuPulse.sample(analyser, time, gain) : this.menuPulse.reset();
  }

  menu(name: keyof typeof MENU_CUES = "click") {
    this.play(MENU_CUES[name], { priority: true });
  }

  confirmEquipment() {
    this.play("gear-equip", { priority: true });
  }

  selectionTick() {
    this.play("aim-step");
  }

  aimAt(cell?: Vec2) {
    if (cell && this.aimedCell && (cell.x !== this.aimedCell.x || cell.z !== this.aimedCell.z))
      this.selectionTick();
    this.aimedCell = cell;
  }

  perkReady() {
    this.play("perk-embers", { priority: true });
  }

  mutationReady() {
    this.play("mutation-award", { priority: true });
  }

  victory() {
    this.play("match-victory", { priority: true });
  }

  eliminated() {
    this.play("match-eliminated", { priority: true });
  }

  /** One key strike of the typed after-action report. */
  typeTick() {
    this.play("type-tick");
  }

  /** Shop feedback: the crate lid, a completed trade and a refused one. */
  shop(cue: "open" | "close" | "buy" | "deny") {
    this.play(`shop-${cue}`, { priority: true });
  }

  levelUp() {
    this.play("level-up", { priority: true });
  }

  /** Start countdown, "go", and the last five seconds before the zone is smallest, each announced once. */
  matchClock(state: Readonly<GameSnapshot>) {
    let beat: string | undefined;
    if (state.phase === "countdown") beat = "start-" + Math.ceil(state.countdown);
    else if (state.phase === "playing" && this.countdownBeat?.startsWith("start-")) beat = "go";
    else if (state.phase === "playing" && state.mode !== "practice") {
      const left = Math.ceil(state.duration - state.time);
      if (left > 0 && left <= 5) beat = "end-" + left;
    }
    if (beat && beat !== this.countdownBeat)
      this.play(beat === "go" ? "deploy-signal" : "clock-pulse", { priority: true });
    this.countdownBeat = beat;
  }

  /** Arena-collapse warning ticks; 0 marks the switch itself. */
  collapseClock(warningSeconds?: number) {
    if (warningSeconds !== undefined && warningSeconds !== this.collapseBeat) {
      const switching = warningSeconds === 0;
      this.play(switching ? "deploy-signal" : "clock-pulse", {
        gain: switching ? 0.8 : 0.72,
        priority: true,
      });
    }
    this.collapseBeat = warningSeconds;
  }

  /**
   * Fire bed level, plus the terrain-reset countdown identified by `resetId` / `seconds`. `shift`
   * marks a map rearranging itself, which lands with a heavy thud instead of a blast.
   */
  battleFire(volume: number, resetId?: number, seconds?: number, shift = false) {
    if (volume !== this.fireLevel) {
      this.fireLevel = volume;
      this.engine.setLoopLevel(FIRE_LOOP, volume);
    }
    if (
      resetId === undefined ||
      seconds === undefined ||
      (this.lastResetId === resetId && this.lastResetSecond === seconds)
    )
      return;
    this.lastResetId = resetId;
    this.lastResetSecond = seconds;
    if (seconds === 0 && shift) this.play("room-shift", { priority: true });
    else if (seconds === 0) {
      this.play("blast", { level: 0.72, priority: true });
      this.engine.duckMusic();
    } else this.play("reset-signal", { priority: true });
  }

  /** Rain bed for wet maps; 0 fades it out. */
  rain(level: number) {
    if (level === this.rainLevel) return;
    this.rainLevel = level;
    this.engine.setLoopLevel(RAIN_LOOP, level);
  }

  /**
   * The place's own sound bed for the map being played: wildlife in a forest, the hum of a tiled
   * hall. Maps without one, and calls outside a match, pass nothing.
   */
  wildlife(mapId?: string) {
    const theme = MAPS.find((map) => map.id === mapId)?.theme;
    const bed =
      theme === "rainforest"
        ? JUNGLE_LOOP
        : theme === "poolrooms"
          ? POOL_LOOP
          : theme === "backrooms"
            ? OFFICE_LOOP
            : undefined;
    if (bed === this.bed) return;
    if (this.bed) this.engine.setLoopLevel(this.bed, 0);
    if (bed) this.engine.setLoopLevel(bed, 1);
    this.bed = bed;
  }

  /** Thunder after a lightning flash; closer strokes are louder and use the sharper sound. */
  thunder(strength: number) {
    this.engine.play(strength > 0.7 ? THUNDER.near : THUNDER.far, { gain: 0.45 + 0.55 * strength });
  }

  /** Killcam: the music steps back for the `seconds` the replay runs. */
  beginReplay(seconds: number) {
    this.engine.duckMusic(0.4, seconds * 1000, 900);
  }

  /**
   * Killcam: sounds what the slowed picture is showing, pitched down with it. `rate` is the
   * playback rate of the replay and `focus` the cell its camera looks at, which is where it listens.
   */
  replayCues(events: readonly GameEvent[], focus: Vec2, rate: number) {
    if (!this.enabled) return;
    // Half the slow-down reaches the pitch: a blast at a fifth of its speed would be a rumble.
    const pitch = 0.5 + 0.5 * rate;
    for (const event of events) {
      const near = falloff(distanceTo(focus, event), 12, 0.15);
      if (event.type === "blast") this.play("blast", { gain: near, rate: pitch, priority: true });
      else if (event.type === "cover") this.play(`cover-break-${event.id % 2}`, { gain: near, rate: pitch });
      else if (event.type === "bomb") this.play("bomb-place", { gain: near, rate: pitch });
      else if (event.type === "kill") this.play("body-fall", { gain: near, rate: pitch, priority: true });
    }
  }

  /** Killcam over, or skipped: the music comes back up. */
  endReplay() {
    this.engine.duckMusic(1, 0, 400);
  }

  reset() {
    this.battleFire(0);
    this.rain(0);
    this.wildlife();
    this.lastResetId = this.lastResetSecond = undefined;
    this.lastEventId = 0;
    this.nextBlastRing = 0;
    this.countdownBeat = undefined;
    this.collapseBeat = undefined;
    this.aimedCell = undefined;
    this.fuseBeats.clear();
    this.strides.clear();
    this.seen.primed = false;
    this.engine.stopVoices();
  }

  update(state: Readonly<GameSnapshot>, localId: string) {
    const self = state.players.find((p) => p.id === localId)!;
    if (state.phase === "playing") this.footsteps(state, self);
    for (const event of state.events) {
      if (event.id <= this.lastEventId) continue;
      this.lastEventId = event.id;
      if (this.enabled) this.worldEvent(event, self);
    }
    this.fuseBeeps(state, self);
    this.changes(state, self);
  }

  dispose() {
    this.reset();
    this.engine.dispose();
  }

  private applyVolume(channel: VolumeChannel) {
    const gain = faderGain(this.faders[channel]);
    if (channel === "master") this.engine.setMasterVolume(gain);
    else this.engine.setBusVolume(channel, gain);
  }

  private play(ref: string, options?: PlayOptions) {
    this.engine.play(cue(ref), options);
  }

  private footsteps(state: Readonly<GameSnapshot>, self: Player) {
    const map = MAPS.find((candidate) => candidate.id === state.mapId);
    for (const p of state.players) {
      if (!p.alive) continue;
      const stride = this.strides.get(p.id) ?? { x: p.x, z: p.z, travel: 0, index: p.id.length % 3 };
      if (p.verticalSpeed === 0) stride.travel += Math.hypot(p.x - stride.x, p.z - stride.z);
      stride.x = p.x;
      stride.z = p.z;
      this.strides.set(p.id, stride);
      if (stride.travel < STRIDE_LENGTH) continue;
      stride.travel %= STRIDE_LENGTH;
      const step = `${map ? STEP_FAMILY[groundAt(map, p.x, p.z)] : "footstep"}-${stride.index}`;
      stride.index = (stride.index + 1) % 3;
      if (p.id === self.id) this.play(step);
      else this.play(step, { gain: 0.8 * falloff(distanceTo(self, p), EARSHOT.step), pan: panTo(self, p) });
    }
  }

  private worldEvent(event: GameEvent, self: Player) {
    const distance = distanceTo(self, event);
    const own = event.playerId === self.id;
    const pan = own ? 0 : panTo(self, event);
    // Damage dealt to another operator, by any means, ticks; an elimination rings over it. A kill
    // credited to someone who is down was their own charge or a zombie, and earns nothing.
    if (own && event.type === "hit" && !event.zombie)
      this.play(`player-attack-${event.id % 3}`, { priority: true });
    if (own && event.type === "kill" && self.alive) this.play("kill-confirm", { priority: true });
    if (event.type === "hit" && event.zombie && distance < 9) {
      const voice = event.zombie.outcome === "hurt" ? `zombie-hurt-${1 + (event.id % 2)}` : "zombie-death";
      this.play(voice, { gain: falloff(distance, 10), pan: panTo(self, event), priority: own });
    }
    if (own && event.type === "blast-contact" && event.at >= this.nextBlastRing) {
      this.play("blast-ringing", { priority: true });
      this.nextBlastRing = event.at + BLAST_RING_COOLDOWN;
    }
    if (event.type === "ignite" && distance < 12) {
      const landing = event.item ? ITEMS[event.item]?.throwable?.landSound : undefined;
      // A thrown bottle comes down away from its owner, so its break is placed like anyone else's.
      if (landing)
        this.play(landing, {
          level: LEVEL.landing,
          gain: falloff(distance, 12, 0.1),
          pan: panTo(self, event),
          priority: own,
        });
      this.play("fire-ignite", { gain: own ? 1 : falloff(distance, 12), pan, priority: own });
    }
    if (event.type === "cover" && distance < 10)
      this.play(`cover-break-${event.id % 2}`, {
        gain: falloff(distance, 10, 0.1),
        pan: panTo(self, event),
        priority: own,
      });
    if (event.type === "build") {
      if (own) this.play("crate-build", { priority: true });
      else if (distance < 9) this.play("crate-build", { gain: 0.8 * falloff(distance, 9), pan });
    } else if (event.type === "shield-end") {
      const sound = ITEMS.shield?.shieldSounds?.[event.reason];
      const level = event.reason === "broken" ? LEVEL.shieldBroken : LEVEL.shieldExpired;
      if (sound && own) this.play(sound, { level, priority: true });
      else if (sound && distance < 7) this.play(sound, { level, gain: 0.6 * falloff(distance, 7), pan });
    } else if (event.type === "cover-hit") {
      const sound = ITEMS[event.item]?.melee?.coverSounds?.[event.coverSurface];
      if (sound && own) this.play(sound, { level: LEVEL.coverHit, priority: true });
      else if (sound && distance < 6)
        this.play(sound, { level: LEVEL.coverHit, gain: 0.55 * falloff(distance, 6), pan });
    } else if (event.type === "strike") {
      // The warning and the falling whistle carry across the whole arena.
      this.play("missile-incoming", {
        gain: Math.max(0.45, falloff(distance, 14, 0.1)),
        pan,
        priority: true,
      });
    } else if (event.type === "strike-impact") {
      const gain = Math.max(0.4, falloff(distance, 16, 0.1));
      this.play("missile-impact", { gain, pan: panTo(self, event), priority: true });
      this.engine.duckMusic();
    } else if (event.type === "blast" && distance < 9) {
      const gain = falloff(distance, 10, 0.1);
      this.play("blast", { gain, pan: panTo(self, event) });
      // Only close blasts push the music down; distant ones sit under it.
      if (gain > 0.5) this.engine.duckMusic();
    } else if (own) this.localEvent(event);
    else if (distance < EARSHOT.action) this.overheard(event, falloff(distance, EARSHOT.action), pan);
  }

  /** What another operator nearby is doing, quieter than the listener's own actions. */
  private overheard(event: GameEvent, nearness: number, pan: number) {
    const gain = 0.6 * nearness;
    switch (event.type) {
      case "bomb":
        return this.play("bomb-place", { gain, pan });
      case "equipment": {
        const item = ITEMS[event.item];
        const fallback = item?.throwable ? "gear-throw" : "gear-equip";
        return this.play(item?.sound ?? fallback, { level: LEVEL.equipmentUse, gain, pan });
      }
      case "melee":
        return this.play(ITEMS[event.item]?.sound ?? "gear-throw", { level: LEVEL.meleeSwing, gain, pan });
    }
  }

  /** Feedback for the local player's own actions, unattenuated and centred. */
  private localEvent(event: GameEvent) {
    switch (event.type) {
      case "equip":
        return this.confirmEquipment();
      case "bomb":
        return this.play("bomb-place");
      case "equipment": {
        const item = ITEMS[event.item];
        const fallback = item?.throwable ? "gear-throw" : "gear-equip";
        return this.play(item?.sound ?? fallback, { level: LEVEL.equipmentUse });
      }
      case "melee":
        return this.play(ITEMS[event.item]?.sound ?? "gear-throw", {
          level: LEVEL.meleeSwing,
          priority: true,
        });
      case "pickup": {
        const item = ITEMS[event.item];
        return this.play(item && isEquipment(item) ? "gear-pickup" : "pickup-confirm");
      }
      case "skill":
        return this.play(SKILLS[event.skill]?.sound || "skill-cast", { level: LEVEL.skill });
      case "perk-use":
        return this.play(perkById(event.perk)?.useSound ?? "skill-cast", { level: 0.46, priority: true });
      case "perk": {
        const perk = perkById(event.perk);
        if (perk) this.play(perk.sound ?? TIERS[perk.tier].sound, { level: LEVEL.perk, priority: true });
        return;
      }
      case "hurt":
        if (event.blocked) return this.play("shield-block");
        // Any damage that gets through, whatever dealt it: the blow under the hurt cue.
        this.play("hurt");
        return this.play(`player-hurt-${event.id % 3}`, { priority: true });
      case "hit": {
        const sound = event.item ? ITEMS[event.item]?.melee?.hitSound : undefined;
        return this.play(sound ?? "hit", { level: LEVEL.meleeHit, priority: true });
      }
    }
  }

  /**
   * Cues for things the snapshot shows changing without an event of their own: an effect running
   * out, a charge kicked, a landing, an operator going down, the zone wall closing, zombies.
   * The first snapshot of a match only records what is already there.
   */
  private changes(state: Readonly<GameSnapshot>, self: Player) {
    const seen = this.seen,
      audible = seen.primed && this.enabled && state.phase === "playing";
    const placed = (at: Vec2, reach: number, level = 1): PlayOptions => ({
      gain: level * falloff(distanceTo(self, at), reach, 0.1),
      pan: panTo(self, at),
    });

    const skills = new Set<string>(),
      airborne = new Set<string>(),
      fallen = new Set<string>();
    for (const p of state.players) {
      const own = p.id === self.id,
        distance = distanceTo(self, p);
      if (!p.alive) {
        fallen.add(p.id);
        // The last operator to fall ends the match in the same snapshot, and is still heard.
        if (seen.primed && this.enabled && !seen.fallen.has(p.id) && (own || distance < EARSHOT.fall))
          this.play("body-fall", own ? {} : placed(p, EARSHOT.fall));
        continue;
      }
      for (const id of p.skills) {
        const skill = SKILLS[id];
        if (!skill?.endSound || !skill.activeUntil) continue;
        const key = `${p.id}:${id}`;
        if (skill.activeUntil(p) > state.time) skills.add(key);
        else if (audible && seen.skills.has(key)) {
          if (own) this.play(skill.endSound, { level: LEVEL.skill, priority: true });
          else if (skill.endSoundRange && distance < skill.endSoundRange)
            this.play(skill.endSound, { level: LEVEL.skill, ...placed(p, skill.endSoundRange, 0.8) });
        }
      }
      if (p.verticalSpeed !== 0) airborne.add(p.id);
      else if (audible && seen.airborne.has(p.id) && (own || distance < EARSHOT.action)) {
        // Coming down from a jump: the surface's own step, heavier and lower.
        const map = MAPS.find((candidate) => candidate.id === state.mapId);
        const step = `${map ? STEP_FAMILY[groundAt(map, p.x, p.z)] : "footstep"}-0`;
        this.play(step, { rate: 0.78, ...(own ? { gain: 1.7 } : placed(p, EARSHOT.action, 1.1)) });
      }
    }
    seen.skills = skills;
    seen.airborne = airborne;
    seen.fallen = fallen;

    const sliding = new Set<number>();
    for (const bomb of state.bombs) {
      if (!bomb.slide) continue;
      sliding.add(bomb.id);
      if (audible && !seen.sliding.has(bomb.id) && distanceTo(self, bomb) < EARSHOT.kick)
        this.play("bomb-kick", placed(bomb, EARSHOT.kick));
    }
    seen.sliding = sliding;

    const closed = state.zone?.closed ?? 0;
    if (audible && closed > seen.ringsClosed) {
      this.play("zone-wall", { priority: true });
      this.engine.duckMusic();
    }
    seen.ringsClosed = closed;

    const zombies = new Map<number, ZombieTrace>();
    for (const zombie of state.zombies) {
      const distance = distanceTo(self, zombie),
        struck = zombie.attack?.at,
        known = seen.zombies.get(zombie.id),
        risen = zombie.spawnAt === undefined || state.time >= zombie.spawnAt + SUMMON_TIME;
      const trace: ZombieTrace = known ?? {
        x: zombie.x,
        z: zombie.z,
        travel: 0,
        step: zombie.id % ZOMBIE_STEPS,
        nextGroan: state.time + 0.5 + Math.random() * GROAN_GAP[0],
      };
      zombies.set(zombie.id, trace);
      // Every zombie keeps its own stride and its own voice, heard from where it stands.
      trace.travel += Math.hypot(zombie.x - trace.x, zombie.z - trace.z);
      trace.x = zombie.x;
      trace.z = zombie.z;
      const footfall = trace.travel >= ZOMBIE_STRIDE,
        groans = risen && state.time >= trace.nextGroan,
        attacked = struck !== undefined && struck !== trace.struck;
      if (footfall) trace.travel %= ZOMBIE_STRIDE;
      if (groans) trace.nextGroan = state.time + GROAN_GAP[0] + Math.random() * (GROAN_GAP[1] - GROAN_GAP[0]);
      trace.struck = struck;
      if (!audible) continue;
      if (!known && !risen && distance < EARSHOT.zombie)
        this.play("zombie-spawn", placed(zombie, EARSHOT.zombie));
      if (known && attacked && distance < EARSHOT.zombie)
        this.play(`zombie-attack-${zombie.id % 2}`, placed(zombie, EARSHOT.zombie));
      if (footfall && risen && distance < EARSHOT.zombieStep) {
        this.play(`zombie-step-${trace.step}`, {
          gain: falloff(distance, EARSHOT.zombieStep),
          pan: panTo(self, zombie),
        });
        trace.step = (trace.step + 1) % ZOMBIE_STEPS;
      }
      if (groans && distance < EARSHOT.groan)
        this.play(`zombie-groan-${Math.floor(Math.random() * GROANS)}`, {
          gain: falloff(distance, EARSHOT.groan),
          pan: panTo(self, zombie),
        });
    }
    seen.zombies = zombies;
    seen.primed = true;
  }

  /** One beep per bombWarning() beat, so audio stays on the simulation clock with the warning light. */
  private fuseBeeps(state: Readonly<GameSnapshot>, self: Listener) {
    const live = new Set(state.bombs.map((b) => b.id));
    for (const id of this.fuseBeats.keys()) if (!live.has(id)) this.fuseBeats.delete(id);
    for (const bomb of state.bombs) {
      if (bomb.slide) continue;
      const warning = bombWarning(bomb.detonateAt, state.time);
      const previous = this.fuseBeats.get(bomb.id);
      this.fuseBeats.set(bomb.id, warning.beat);
      const distance = distanceTo(self, bomb);
      if (state.phase !== "playing" || distance >= 8 || previous === warning.beat) continue;
      // The beep climbs slowly through the fuse, then jumps in pitch and level for the final countdown.
      const final = finalCountdown(bomb.detonateAt, state.time);
      const urgency = 0.6 + 0.4 * warning.progress + 0.35 * final;
      this.play("fuse-tick", {
        gain: urgency * falloff(distance, 9, 0.1),
        pan: panTo(self, bomb),
        rate: 1 + 0.1 * warning.progress + (final > 0 ? 0.35 + 0.3 * final : 0),
      });
    }
  }
}

/** Cue URLs declared by content modules, so their first play is not delayed by a download. */
function contentCues() {
  const refs = new Set<string>();
  for (const item of Object.values(ITEMS)) {
    if (item.sound) refs.add(item.sound);
    for (const sound of Object.values(item.shieldSounds ?? {})) refs.add(sound);
    if (item.melee?.hitSound) refs.add(item.melee.hitSound);
    for (const sound of Object.values(item.melee?.coverSounds ?? {})) if (sound) refs.add(sound);
  }
  for (const item of Object.values(ITEMS)) if (item.throwable?.landSound) refs.add(item.throwable.landSound);
  for (const skill of Object.values(SKILLS)) {
    if (skill.sound) refs.add(skill.sound);
    if (skill.endSound) refs.add(skill.endSound);
  }
  for (const perk of PERKS) if (perk.useSound) refs.add(perk.useSound);
  return refs;
}
