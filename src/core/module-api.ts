import type { InferOutput } from "valibot";
import type {
  BaseConfigSchema,
  ItemConfigSchema,
  PerkConfigSchema,
  SkillConfigSchema,
  TIER_IDS,
} from "./schema";
import type { GameSnapshot, Player, ThrownItem, Vec2 } from "./types";

export interface StrikeOptions {
  /** Seconds from the call to the impact. */
  delay: number;
  /** Blast radius in cells; walls do not shelter anyone inside it. */
  radius: number;
  power: number;
}

/** Declarative config types are inferred from the schemas that validate them at load time. */
export type Tier = (typeof TIER_IDS)[number];
export type BaseConfig = InferOutput<typeof BaseConfigSchema>;
export type SkillConfig = InferOutput<typeof SkillConfigSchema>;
export type PerkConfig = InferOutput<typeof PerkConfigSchema>;
export type ItemConfig = InferOutput<typeof ItemConfigSchema>;

type ModifiedStat =
  | "moveSpeed"
  | "placementRadius"
  | "bombRange"
  /** Seconds from planting a charge to its detonation. */
  | "bombFuse"
  /** Blast power of a charge at the moment it is planted. */
  | "bombPower"
  /** Number of destructible obstacles a blast passes through before it stops. Base 0. */
  | "blastPierce"
  /** Above 0, a charge planted now hides its blast path from everyone but its owner. Base 0. */
  | "bombConcealed"
  /** Coins credited for one reward. */
  | "coinGain"
  | "blastDuration"
  | "cooldown"
  | `duration:${string}`
  | "crateScore"
  | "staminaRegen";
type Modifier = (value: number, player: Readonly<Player>, stacks: number, time: number) => number;
export interface EffectContext {
  stat(key: ModifiedStat, base: number): number;
  /** `scorch` also sweeps the floor with fire when the reset lands, costing every other operator that much health. */
  requestTerrainReset?(delay: number, scorch?: number): boolean;
  /** Build a crate from the stock on the cell ahead. False when the stock or terrain rule it out. */
  build?(): boolean;
  forceArenaView?(duration: number, warningSeconds?: number): boolean;
  /** Cell the player picked, for perks declared `targeted`. */
  target?: Vec2;
  /** Calls a missile onto a cell of the arena. False when the cell is outside it. */
  callStrike?(target: Vec2, options: StrikeOptions): boolean;
  /** Hands the player every other operator's charge whose blast path joins up with the player's own. Returns how many changed hands. */
  seizeLinkedBombs?(): number;
}

/** Skills and perks receive these hooks while owned. Time and dt use simulation seconds. */
export interface Hooks {
  onTick?(player: Player, state: GameSnapshot, dt: number, stacks: number): void;
  modifiers?: Partial<Record<ModifiedStat, Modifier>>;
  onCoverDestroyed?(player: Player, stacks: number): void;
  onDamageDealt?(player: Player, damage: number, stacks: number): void;
  onBombContact?(kick: () => void): void;
}

export interface SkillBehavior extends Hooks {
  canActivate?(player: Readonly<Player>, time: number): boolean;
  activate?(player: Player, state: GameSnapshot, duration: number): void;
  /** Simulation timestamp at which the HUD indicator expires. */
  activeUntil?(player: Readonly<Player>): number;
  isActive?(player: Readonly<Player>, time: number): boolean;
  /** Positive values request a cast. Contacts come from the bot's own observations. */
  aiCastPriority?(player: Readonly<Player>, time: number, contacts: readonly Vec2[]): number;
}

export interface PerkBehavior extends Hooks {
  /** Spend one owned copy only after the simulation accepts the action. */
  use?(player: Player, context: EffectContext): boolean;
  canUse?(player: Readonly<Player>, state: Readonly<GameSnapshot>): boolean;
  aiShouldUse?(player: Readonly<Player>, state: GameSnapshot): boolean;
  eligible?(player: Readonly<Player>): boolean;
  onAcquire?(player: Player, context?: EffectContext): void;
  aiPriority?(player: Readonly<Player>): number;
  /** Targeted perks: the cell a bot should aim at, from its own sightings, or nothing to hold fire. */
  aiTarget?(
    player: Readonly<Player>,
    state: Readonly<GameSnapshot>,
    contacts: readonly Vec2[],
  ): Vec2 | undefined;
}

interface Impact {
  projectile: Readonly<ThrownItem>;
  /** `fuse` leaves a live charge on the cell for that many seconds; `powerScale` scales the thrower's attack. */
  explode(range: number, options?: { fuse?: number; powerScale?: number }): void;
  /** Lights the floor around the landing cell; walls and cover stop the flames. */
  burn(fire: { radius: number; duration: number; damage: number }): void;
}

export interface ItemBehavior {
  /** Self-use equipment. Return true only when one inventory unit should be spent. */
  onUse?(player: Player, context?: EffectContext): boolean;
  onPickup?(player: Player): void;
  dropWeight?(player: Readonly<Player>, base: number): number;
  onLand?(impact: Impact): void;
  aiPickupValue?(player: Readonly<Player>): number;
}

export type SkillDefinition = SkillConfig & SkillBehavior & { kind: "skill" };
export type PerkDefinition = PerkConfig & PerkBehavior & { kind: "perk" };
export type ItemDefinition = ItemConfig & ItemBehavior & { kind: "item" };
export type MutationDefinition = BaseConfig & {
  apply(player: Player): void;
  /** Mutations that would be wasted on this player are left out of the roll. */
  eligible?(player: Readonly<Player>): boolean;
};
export type ContentModule = SkillDefinition | PerkDefinition | ItemDefinition;

export const defineSkill = (config: SkillConfig, behavior: SkillBehavior): SkillDefinition => ({
  ...config,
  ...behavior,
  kind: "skill",
});
export const definePerk = (config: PerkConfig, behavior: PerkBehavior): PerkDefinition => ({
  ...config,
  ...behavior,
  kind: "perk",
});
export const defineItem = (config: ItemConfig, behavior: ItemBehavior): ItemDefinition => ({
  ...config,
  ...behavior,
  kind: "item",
});
export const defineMutation = (
  config: BaseConfig,
  behavior: Pick<MutationDefinition, "apply" | "eligible">,
): MutationDefinition => ({ ...config, ...behavior });
