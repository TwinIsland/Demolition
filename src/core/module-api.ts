import type { InferOutput } from "valibot";
import type {
  BaseConfigSchema,
  DROP_POOL_IDS,
  ItemConfigSchema,
  PerkConfigSchema,
  SkillConfigSchema,
  TIER_IDS,
} from "./schema";
import type { GameSnapshot, Player, ThrownItem, Vec2 } from "./types";

/** Declarative config types are inferred from the schemas that validate them at load time. */
export type Tier = (typeof TIER_IDS)[number];
export type DropPool = (typeof DROP_POOL_IDS)[number];
export type BaseConfig = InferOutput<typeof BaseConfigSchema>;
export type SkillConfig = InferOutput<typeof SkillConfigSchema>;
export type PerkConfig = InferOutput<typeof PerkConfigSchema>;
export type ItemConfig = InferOutput<typeof ItemConfigSchema>;

export type ModifiedStat =
  | "moveSpeed"
  | "placementRadius"
  | "bombRange"
  /** Seconds from planting a charge to its detonation. */
  | "bombFuse"
  /** Blast power of a charge at the moment it is planted. */
  | "bombPower"
  /** Number of destructible obstacles a blast passes through before it stops. Base 0. */
  | "blastPierce"
  /** Coins credited for one reward. */
  | "coinGain"
  | "blastDuration"
  | "cooldown"
  | `duration:${string}`
  | "crateScore"
  | "staminaRegen";
export type Modifier = (value: number, player: Readonly<Player>, stacks: number, time: number) => number;
export interface EffectContext {
  stat(key: ModifiedStat, base: number): number;
  requestTerrainReset?(delay: number): boolean;
  /** Pay to build a crate on the cell ahead. False when coins or terrain rule it out. */
  build?(): boolean;
  forceArenaView?(duration: number, warningSeconds?: number): boolean;
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
}

export interface Impact {
  projectile: Readonly<ThrownItem>;
  /** `fuse` leaves a live charge on the cell for that many seconds; `powerScale` scales the thrower's attack. */
  explode(range: number, options?: { fuse?: number; powerScale?: number }): void;
  smoke(duration: number, radius: number): void;
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
