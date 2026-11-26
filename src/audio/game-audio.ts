import { bombWarning, finalCountdown } from "../core/bomb-warning";
import { ITEMS, SKILLS, TIERS, isEquipment, perkById } from "../core/content";
import type { GameEvent, GameSnapshot, Player, Vec2 } from "../core/types";
import { AudioEngine } from "./audio-engine";
import type { PlayOptions } from "./audio-engine";
import { BassPulse } from "./bass-pulse";
import { BANK_CUES, FIRE_LOOP, MENU_MUSIC, MUSIC_VOLUME, RAIN_LOOP, THUNDER, cue } from "./sound-bank";
import { distanceTo, falloff, panTo } from "./spatial";
import type { Listener } from "./spatial";

const MENU_CUES = { click: "ui-click", accept: "ui-accept", back: "ui-back" } as const;
const STRIDE_LENGTH = 0.85;
const BLAST_RING_COOLDOWN = 1.45;

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
} as const;

interface Stride extends Vec2 {
  travel: number;
  index: number;
}

/** Maps snapshots and UI moments to cues. Recordings only, except the rain bed and thunder, which are noise rendered offline to files. */
export class GameAudio {
  private readonly engine = new AudioEngine();
  private readonly menuPulse = new BassPulse();
  private readonly strides = new Map<string, Stride>();
  private readonly fuseBeats = new Map<number, number>();
  private fireLevel = 0;
  private rainLevel = 0;
  private lastResetId?: number;
  private lastResetSecond?: number;
  private countdownBeat?: string;
  private collapseBeat?: number;
  private aimedCell?: Vec2;
  private lastEventId = 0;
  private nextBlastRing = 0;

  constructor() {
    this.engine.preload([...BANK_CUES, ...contentCues()].map(cue));
    this.engine.preload(Object.values(THUNDER));
    this.engine.setLoopLevel(FIRE_LOOP, 0);
    this.engine.setLoopLevel(RAIN_LOOP, 0);
    this.engine.playMusic(MENU_MUSIC, { volume: MUSIC_VOLUME });
  }

  get enabled() {
    return !this.engine.muted;
  }

  toggle() {
    this.engine.setMuted(!this.engine.muted);
    return this.enabled;
  }

  /**
   * Fetches every cue, loop and music track up front, including one field track per map, so that
   * nothing is requested mid-match. Returns one promise per sound for the loading screen.
   */
  preloadAll(fieldTracks: Iterable<string>): Promise<void>[] {
    for (const url of fieldTracks) if (url) this.engine.preloadMusic(url, true);
    return this.engine.loading();
  }

  /** Menu music resumes where it left off; field tracks stream and start from the top. */
  setMusic(path: string) {
    const menu = path === MENU_MUSIC;
    this.engine.playMusic(path, { volume: MUSIC_VOLUME, stream: !menu, restart: !menu });
  }

  /** Bass-onset pulse (0..1) of the menu track for the lobby backdrop; `time` in seconds. */
  menuBeat(time: number) {
    const analyser = this.engine.isMusicAudible(MENU_MUSIC) ? this.engine.spectrumTap() : undefined;
    return analyser ? this.menuPulse.sample(analyser, time, this.engine.musicGain()) : this.menuPulse.reset();
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

  /** Fire bed level, plus the terrain-reset countdown identified by `resetId` / `seconds`. */
  battleFire(volume: number, resetId?: number, seconds?: number) {
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
    if (seconds === 0) {
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

  /** Thunder after a lightning flash; closer strokes are louder and use the sharper sound. */
  thunder(strength: number) {
    this.engine.play(strength > 0.7 ? THUNDER.near : THUNDER.far, { gain: 0.45 + 0.55 * strength });
  }

  reset() {
    this.battleFire(0);
    this.rain(0);
    this.lastResetId = this.lastResetSecond = undefined;
    this.lastEventId = 0;
    this.nextBlastRing = 0;
    this.countdownBeat = undefined;
    this.collapseBeat = undefined;
    this.aimedCell = undefined;
    this.fuseBeats.clear();
    this.strides.clear();
    this.engine.stopVoices();
  }

  update(state: Readonly<GameSnapshot>, localId: string) {
    const self = state.players.find((p) => p.id === localId)!;
    if (state.phase === "playing") this.footsteps(state.players, self);
    for (const event of state.events) {
      if (event.id <= this.lastEventId) continue;
      this.lastEventId = event.id;
      if (this.enabled) this.worldEvent(event, self);
    }
    this.fuseBeeps(state, self);
  }

  dispose() {
    this.reset();
    this.engine.dispose();
  }

  private play(ref: string, options?: PlayOptions) {
    this.engine.play(cue(ref), options);
  }

  private footsteps(players: readonly Player[], self: Player) {
    for (const p of players) {
      if (!p.alive) continue;
      const stride = this.strides.get(p.id) ?? { x: p.x, z: p.z, travel: 0, index: p.id.length % 3 };
      if (p.verticalSpeed === 0) stride.travel += Math.hypot(p.x - stride.x, p.z - stride.z);
      stride.x = p.x;
      stride.z = p.z;
      this.strides.set(p.id, stride);
      if (stride.travel < STRIDE_LENGTH) continue;
      stride.travel %= STRIDE_LENGTH;
      const step = `footstep-${stride.index}`;
      stride.index = (stride.index + 1) % 3;
      if (p.id === self.id) this.play(step);
      else this.play(step, { gain: 0.62 * falloff(distanceTo(self, p), 6), pan: panTo(self, p) });
    }
  }

  private worldEvent(event: GameEvent, self: Listener & { id: string }) {
    const distance = distanceTo(self, event);
    const own = event.playerId === self.id;
    const pan = own ? 0 : panTo(self, event);
    if (event.type === "hit" && event.zombie && distance < 9) {
      const voice = event.zombie.outcome === "hurt" ? `zombie-hurt-${1 + (event.id % 2)}` : "zombie-death";
      this.play(voice, { gain: falloff(distance, 10), pan: panTo(self, event), priority: own });
    }
    if (own && event.type === "blast-contact" && event.at >= this.nextBlastRing) {
      this.play("blast-ringing", { priority: true });
      this.nextBlastRing = event.at + BLAST_RING_COOLDOWN;
    }
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
        return this.play("skill-cast", { level: 0.46, priority: true });
      case "perk": {
        const perk = perkById(event.perk);
        if (perk) this.play(perk.sound ?? TIERS[perk.tier].sound, { level: LEVEL.perk, priority: true });
        return;
      }
      case "hurt":
        return this.play(event.blocked ? "shield-block" : "hurt");
      case "hit": {
        const sound = event.item ? ITEMS[event.item]?.melee?.hitSound : undefined;
        return this.play(sound ?? "hit", { level: LEVEL.meleeHit, priority: true });
      }
    }
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
  for (const skill of Object.values(SKILLS)) if (skill.sound) refs.add(skill.sound);
  return refs;
}
