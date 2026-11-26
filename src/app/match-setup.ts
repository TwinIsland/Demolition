import { MAPS } from "../core/maps";
import { DEFAULT_MODE, type MatchMode } from "../core/match-modes";
import { defaultSlots, type Appearance, type BotSlot, type ZombieRate } from "../core/room";
import type { MatchOptions } from "../core/types";
import { field } from "../i18n";
import {
  loadAppearance,
  loadZombieRate,
  loadZoneDuration,
  saveAppearance,
  saveZombieRate,
  saveZoneDuration,
} from "./settings";

const FALLBACK_MUSIC = "./assets/bgm.ogg";

/**
 * The choices made in the lobby and the match room, and the `MatchOptions` built from them.
 * Seeds are produced here, outside the simulation, which only ever consumes the one it is given.
 */
export class MatchSetup {
  mode: MatchMode = DEFAULT_MODE;
  mapId = MAPS[0].id;
  readonly slots: BotSlot[] = defaultSlots();
  readonly appearance: Appearance = loadAppearance();
  private rate: ZombieRate = loadZombieRate();
  /** Seconds until the safe zone reaches its minimum size. */
  private zone = loadZoneDuration();
  private seed = 74691;

  constructor(private readonly humanId: string) {}

  get zombieRate(): ZombieRate {
    return this.rate;
  }

  get mapName(): string {
    return field(
      MAPS.find((m) => m.id === this.mapId)!,
      "name",
    );
  }

  get music(): string {
    return MAPS.find((m) => m.id === this.mapId)?.bgm ?? FALLBACK_MUSIC;
  }

  /** A full match needs an opponent; practice can be played alone. */
  get ready(): boolean {
    return this.mode === "practice" || this.slots.some((slot) => slot.enabled);
  }

  /** How much the selected map stretches the chosen match length. */
  get zoneScale(): number {
    return MAPS.find((m) => m.id === this.mapId)?.zoneScale ?? 1;
  }

  get zoneDuration(): number {
    return this.zone;
  }

  setZoneDuration(seconds: number) {
    this.zone = seconds;
    saveZoneDuration(seconds);
  }

  setZombieRate(value: ZombieRate) {
    this.rate = value;
    saveZombieRate(value);
  }

  saveAppearance() {
    saveAppearance(this.appearance);
  }

  /** Options for the session created at startup, before anything was chosen. */
  initialOptions(): MatchOptions {
    return { ...this.backdropOptions(false), humanId: this.humanId, opponents: this.slots };
  }

  /** Options for the idle arena behind the lobby. `reseed` picks a new layout. */
  backdropOptions(reseed = true): MatchOptions {
    if (reseed) this.seed++;
    return { mode: this.mode, appearance: this.appearance, mapId: this.mapId, seed: this.seed };
  }

  /** Options for returning to the lobby, where the local player stands in the backdrop. */
  lobbyOptions(): MatchOptions {
    return { ...this.backdropOptions(), humanId: this.humanId };
  }

  /** Options for a real match. Wall-clock entropy makes every match different. */
  matchOptions(): MatchOptions {
    this.seed = (Date.now() + ++this.seed) >>> 0;
    return {
      ...this.backdropOptions(false),
      humanId: this.humanId,
      opponents: this.slots,
      zombieRate: this.rate,
      zoneDuration: this.zone,
    };
  }
}
