import type { coverLayout } from "../cover-layout";
import type { MapDefinition } from "../maps";
import type { GameSnapshot, PerkId } from "../types";
import type { ZombieDirector } from "../zombies";

export interface OfferHistory {
  previous: PerkId[];
  silverHands: number;
}

/**
 * Everything a system may read or mutate. Systems are plain functions over this object, so the
 * authoritative state stays in one place and every RNG draw and id allocation is explicit.
 */
export interface SimContext {
  /** The serializable snapshot. Everything outside it is bookkeeping that never leaves the server. */
  readonly state: GameSnapshot;
  readonly map: MapDefinition;
  readonly coverAt: ReturnType<typeof coverLayout>;
  /** Seeded stream. Draw order is part of the deterministic contract. */
  readonly random: () => number;
  /** One monotonic sequence shared by bombs, blasts, items, zombies and events. */
  readonly nextId: () => number;
  readonly undead: ZombieDirector;
  /** Consecutive empty crates per player; index into CRATE_CHANCES. */
  readonly crateMisses: Map<string, number>;
  readonly offerHistory: Map<string, OfferHistory>;
  /** Zone fire: fractional damage owed, last burn event, and the no-healing ceiling of the firestorm. */
  readonly zoneBurn: Map<string, number>;
  readonly zoneBurnEventAt: Map<string, number>;
  readonly healthCaps: Map<string, number>;
  /** Passive health regeneration: health last seen, when recovery may start, and the fraction owed. */
  readonly regen: Map<string, { hp: number; from: number; owed: number }>;
  /** Simulation time of the next field supply drop. */
  nextSupplyAt: number;
  /**
   * Cover cells opened by explosions during the tick at `time`. Charges set off later in the same
   * tick still treat them as standing cover, so one crate shields against a whole chain reaction.
   */
  openedCover?: { time: number; cells: Set<number> };
}
