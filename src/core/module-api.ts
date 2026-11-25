import type { GameSnapshot, Player, ThrownItem, Vec2 } from "./types";

export type Tier = "silver" | "gold" | "diamond" | "mythic";
export type DropPool = "supply" | "elite";

export interface BaseConfig {
  translations?: import("../i18n").Translations;
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Optional audio asset for successful item use, skill activation, or perk acquisition. */
  sound?: string;
  order?: number;
  stats?: Readonly<Record<string, number>>;
}

export interface SkillConfig extends BaseConfig {
  price: number;
  cooldown: number;
  duration: number;
  key: string;
  code?: string;
  passive?: boolean;
}
export type MutationDefinition = BaseConfig & { apply(player: Player):void };
export const defineMutation = (config:BaseConfig, behavior:Pick<MutationDefinition,"apply">):MutationDefinition =>
  ({...config,...behavior});

export interface PerkConfig extends BaseConfig {
  color: string;
  tier: Tier;
  tag: string;
  weight: number;
  requiresSkill?: string;
  requiresActiveSkill?: boolean;
  requiresTerrainReset?: boolean;
}

export interface ItemConfig extends BaseConfig {
  color: string;
  pool: DropPool;
  weight: number;
  model?: string;
  permanent?: boolean;
  /** Optional default physical key for selecting this equipment. */
  quickEquipCode?: string;
  pickupScore?: number;
  shieldSounds?: {broken:string; expired:string};
  melee?: { reach:number; damage:number; cooldown:number; inputBuffer?:number; hitSound?:string;
    coverDamage?:number; coverSounds?:Partial<Record<import("./pack-api").CoverSurface,string>> };
  throwable?: { reach: number; flight: number; blastRange?: number; trajectory?: "lob" };
}

export type ModifiedStat = "moveSpeed" | "placementRadius" | "bombRange" | "blastDuration" | "cooldown"
  | `duration:${string}` | "crateScore" | "staminaRegen";
export type Modifier = (value: number, player: Readonly<Player>, stacks: number, time: number) => number;
export interface EffectContext {
  stat(key:ModifiedStat,base:number):number;
  requestTerrainReset?(delay:number):boolean;
  forceArenaView?(duration:number, warningSeconds?:number):boolean;
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
  canActivate?(player: Readonly<Player>, time:number): boolean;
  activate?(player: Player, state: GameSnapshot, duration: number): void;
  /** Simulation timestamp at which the HUD indicator expires. */
  activeUntil?(player: Readonly<Player>): number;
  isActive?(player: Readonly<Player>, time:number): boolean;
  /** Positive values request a cast. Contacts come from the bot's own observations. */
  aiCastPriority?(player: Readonly<Player>, time: number, contacts: readonly Vec2[]): number;
}

export interface PerkBehavior extends Hooks {
  /** Spend one owned copy only after the simulation accepts the action. */
  use?(player:Player, context:EffectContext):boolean;
  canUse?(player:Readonly<Player>,state:Readonly<GameSnapshot>):boolean;
  aiShouldUse?(player:Readonly<Player>, state:GameSnapshot):boolean;
  eligible?(player: Readonly<Player>): boolean;
  onAcquire?(player: Player, context?: EffectContext): void;
  aiPriority?(player: Readonly<Player>): number;
}

export interface Impact {
  projectile: Readonly<ThrownItem>;
  explode(range: number): void;
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
export type ContentModule = SkillDefinition | PerkDefinition | ItemDefinition;

export const defineSkill = (config: SkillConfig, behavior: SkillBehavior): SkillDefinition =>
  ({ ...config, ...behavior, kind: "skill" });
export const definePerk = (config: PerkConfig, behavior: PerkBehavior): PerkDefinition =>
  ({ ...config, ...behavior, kind: "perk" });
export const defineItem = (config: ItemConfig, behavior: ItemBehavior): ItemDefinition =>
  ({ ...config, ...behavior, kind: "item" });
