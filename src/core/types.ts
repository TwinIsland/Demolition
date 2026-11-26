/** Serializable contracts. This layer deliberately has no DOM or Three.js imports. */
import type { CoverSurface } from "./pack-api";
import type { Appearance, BotSlot, ZombieRate } from "./room";
import type { MatchMode } from "./match-modes";
import type { ZoneState } from "./zone";
export type Tile = 0 | 1 | 2;
export type Phase = "countdown" | "playing" | "finished";
/** Content ids. Plain strings because modules are discovered at runtime. */
export type ItemId = string;
export type SkillId = string;
export type PerkId = string;
export type MutationId = string;
/** An item that is carried in the inventory. */
export type Consumable = ItemId;
/** What a player can hold: the built-in bomb or a carried item. */
export type Equipment = "bomb" | Consumable;
export type ThrowMode = "direct" | "lob";
export interface Vec2 {
  x: number;
  z: number;
}
/** One player's intent for a tick. Actions are edges: set for one submission, not held. */
export interface PlayerInput {
  moveX: number;
  moveZ: number;
  yaw: number;
  sprint?: boolean;
  jump?: boolean;
  /** Switch the held equipment. */
  equip?: Equipment;
  /** Primary action with the held equipment: plant, swing, self-use or throw. */
  useEquipment?: boolean;
  /** Cell the equipment is aimed at: where to plant the bomb or land a throw. */
  aimTarget?: Vec2;
  throwMode?: ThrowMode;
  meleeYaw?: number;
  /** Tactical View: drop a bomb on the cell the player stands on, independently of held equipment. */
  plantHere?: boolean;
  /** Spend coins to build a crate on the cell ahead, independently of equipped gear. */
  build?: boolean;
  activateSkill?: SkillId;
  /** Take one perk from the current offer. */
  choosePerk?: PerkId;
  /** Spend an owned, activatable perk. */
  usePerk?: PerkId;
  /** Cell picked on the targeting panel for a perk that needs one. */
  perkTarget?: Vec2;
  resetTerrain?: boolean;
  /** Pre-match shop commands. */
  /** Buy one unit of this equipment from the supply shop. An edge, like the other purchase fields. */
  buyItem?: ItemId;
  buySkill?: SkillId;
  refundSkill?: SkillId;
}
export const idleInput = (yaw = 0): PlayerInput => ({
  moveX: 0,
  moveZ: 0,
  yaw,
});
export interface Player extends Vec2 {
  /** Feet above the arena floor in world units; x and z are measured in cells. */
  elevation: number;
  verticalSpeed: number;
  id: string;
  name: string;
  color: string;
  bot: boolean;
  difficulty?: Difficulty;
  skin?: Appearance["skin"];
  bombStyle?: Appearance["bombStyle"];
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  staminaRegenAt: number;
  sprinting: boolean;
  credits: number;
  moduleData: Record<string, number>;
  skills: SkillId[];
  inventory: Record<Consumable, number>;
  /** Units bought from the supply shop this match, per item; raises the next price. */
  supplyBought?: Record<string, number>;
  /** Simulation time from which the supply shop sells to this player again. */
  supplyReadyAt?: number;
  equipped: Equipment;
  attack: number;
  score: number;
  alive: boolean;
  /** Seconds remaining unless a blast breaks the shield first. */
  shield: number;
  invulnerableUntil: number;
  speed: number;
  range: number;
  capacity: number;
  kills: number;
  xp: number;
  level: number;
  nextLevel: number;
  perks: PerkId[];
  mutations?: Record<MutationId, number>;
  offers: PerkId[];
  tacticalView?: boolean;
  forcedViewUntil?: number;
  scanUntil: number;
  surgeUntil: number;
  /** Charges placed before this time keep their blast path hidden from everyone else. */
  veilUntil?: number;
  /** Invisible to opponents, bots and zombies until this time. */
  cloakUntil?: number;
  cooldowns: Record<SkillId, number>;
  /** Crates built this match; each one raises the price of the next. */
  cratesBuilt?: number;
  /** Crate under construction and its reserved coin cost. Interruptions refund that cost. */
  building?: Vec2 & { completeAt: number; cost: number };
  /** Bomb the player is currently pushing against, and since when. Drives the Slide Kick windup. */
  kickPush?: Vec2 & { bombId: number; since: number };
}
export interface Bomb extends Vec2 {
  /** Destructible obstacles the blast passes through (destroying them) before it stops. */
  pierce?: number;
  blastDuration?: number;
  slide?: Vec2 & { arrivedAt: number; kickerId?: string };
  power?: number;
  /** A landed grenade on its short fuse: full self-damage, and it does not count against capacity. */
  source?: "throwable";
  /** Only the owner is shown where this charge will burn; bots have to guess. */
  concealed?: boolean;
  id: number;
  ownerId: string;
  range: number;
  detonateAt: number;
  /** Players overlapping a newly planted bomb can leave, then cannot re-enter. */
  passThrough: string[];
}
export interface Blast extends Vec2 {
  /** Snapshots without this field use the planted-bomb rules. */
  source?: "bomb" | "throwable" | "missile";
  /** All flame cells from one bomb or grenade share this ID. */
  explosionId?: number;
  absorbedBy?: string[];
  contactedBy?: string[];
  duration?: number;
  originX?: number;
  originZ?: number;
  power?: number;
  range?: number;
  id: number;
  ownerId: string;
  expiresAt: number;
}
/** A called-in missile on its way down. Everyone sees the marker; `radius` is in cells. */
export interface Strike extends Vec2 {
  id: number;
  ownerId: string;
  launchedAt: number;
  landsAt: number;
  radius: number;
  power: number;
}
/** A crate a player built during the match. */
export interface BuiltCrate extends Vec2 {
  id: number;
  ownerId: string;
  builtAt: number;
  /** Accumulated melee damage; blasts destroy it outright. */
  damage?: number;
}
export interface Item extends Vec2 {
  source?: "field";
  id: number;
  kind: ItemId;
}
/** Fields every event carries. x and z locate the event, which is not always the player. */
interface EventBase<T extends string> extends Vec2 {
  id: number;
  /** Simulation time. */
  at: number;
  type: T;
  playerId: string;
  text: string;
  textEn: string;
}
/** A zombie struck by a player, and whether the strike finished it. */
export interface ZombieHit {
  id: number;
  level: Zombie["level"];
  outcome: "hurt" | "killed";
}
export type GameEvent =
  | EventBase<"bomb" | "blast" | "blast-contact" | "kill" | "level" | "build">
  /** A missile called on the event's cell, and its impact there. */
  | EventBase<"strike" | "strike-impact">
  | (EventBase<"equip"> & { item: Equipment })
  | (EventBase<"equipment" | "melee" | "pickup"> & { item: ItemId })
  | (EventBase<"cover-hit"> & { item: ItemId; coverSurface: CoverSurface })
  /** Cover destroyed, by the named melee item or else by a blast. */
  | (EventBase<"cover"> & { item?: ItemId })
  | (EventBase<"hit"> & { item?: ItemId; zombie?: ZombieHit })
  | (EventBase<"hurt"> & { blocked: boolean })
  | (EventBase<"shield-end"> & { item: ItemId; reason: "broken" | "expired" })
  | (EventBase<"mutation"> & { mutation: MutationId })
  | (EventBase<"perk" | "perk-use"> & { perk: PerkId })
  | (EventBase<"skill"> & { skill: SkillId });
/** `adaptive` follows how the human is doing; it changes decision quality only, never health or damage. */
export type Difficulty = "easy" | "normal" | "hard" | "adaptive";
export interface Zombie extends Vec2 {
  hurtAt?: number;
  hp?: number;
  spawnAt?: number;
  attack?: { at: number; targetId: string; yaw: number };
  /** Knocked back by a hit: it neither moves on its own nor attacks until this time. */
  staggerUntil?: number;
  /** Unit grid direction of the current knockback, away from the attacker. */
  knockback?: Vec2;
  level: 1 | 2 | 3;
  id: number;
  yaw: number;
  destination: Vec2;
}
export const inTacticalView = (p: Readonly<Player>, time: number) =>
  (p.forcedViewUntil ?? 0) > time || !!p.tacticalView;
export const isCloaked = (p: Readonly<Player>, time: number) => (p.cloakUntil ?? 0) > time;
/** Whether `viewer` is denied the blast path of this charge. */
export const trailHidden = (bomb: Pick<Bomb, "concealed" | "ownerId">, viewerId: string) =>
  !!bomb.concealed && bomb.ownerId !== viewerId;
export interface ThrownItem extends Vec2 {
  mode?: ThrowMode;
  id: number;
  ownerId: string;
  kind: Consumable;
  origin: Vec2 & { elevation?: number };
  landsAt: number;
  power: number;
}
export interface SmokeCloud extends Vec2 {
  radius?: number;
  duration?: number;
  id: number;
  expiresAt: number;
}
export interface GameSnapshot {
  mode?: MatchMode;
  canResetTerrain?: boolean;
  terrainReset?: {
    id: number;
    ownerId: string;
    at: number;
    completedAt?: number;
    /** Wall cells (z * size + x) about to change, published about a second before the swap. */
    wallPlan?: { rising: number[]; sinking: number[] };
  };
  arenaView?: { startsAt: number; endsAt: number };
  thrown: ThrownItem[];
  smoke: SmokeCloud[];
  /** Missiles in flight. Absent in snapshots from before the perk existed. */
  strikes?: Strike[];
  difficulty: Difficulty;
  seed: number;
  mapId: string;
  mapName: string;
  size: number;
  tiles: Tile[][];
  /** Current cell index -> original cell index, shared by simulation and renderers. */
  coverOrigins?: Record<number, number>;
  /** Permanent walls a terrain reset may move: current cell to stable wall id. Changes with `coverRevision`. */
  wallOrigins?: Record<number, number>;
  coverRevision?: number;
  /** Accumulated melee damage keyed by the cover's original cell. */
  coverDamage?: Record<number, number>;
  /** Crates built by players. Their cells are cover (tile 2) that yields no score and no loot. */
  builtCrates?: BuiltCrate[];
  /** Closing safe zone; absent in practice. `duration` is when it reaches minimum size. */
  zone?: ZoneState;
  time: number;
  duration: number;
  phase: Phase;
  countdown: number;
  players: Player[];
  zombies: Zombie[];
  bombs: Bomb[];
  blasts: Blast[];
  items: Item[];
  events: GameEvent[];
  winnerId: string | null;
}
export interface MatchOptions {
  mode?: MatchMode;
  zombieRate?: ZombieRate;
  appearance?: Appearance;
  opponents?: BotSlot[];
  difficulty?: Difficulty;
  mapId: string;
  seed: number;
  humanId?: string;
  /** Seconds until the safe zone reaches its minimum size. */
  zoneDuration?: number;
}
export interface AgentContext {
  self: Player;
  state: Readonly<GameSnapshot>;
  dt: number;
}
/** Keyboard, AI and future remote input sources share this contract. */
export interface PlayerAgent {
  readonly playerId: string;
  decide(context: AgentContext): PlayerInput;
  reset?(): void;
  dispose?(): void;
}
/** Replace LocalMatchSession with a WebSocket implementation for server authority.
 * submit carries intention only; snapshots remain the single source of truth. */
export interface MatchSession {
  submit(playerId: string, input: PlayerInput): void;
  advance(dt: number): void;
  getSnapshot(): Readonly<GameSnapshot>;
  getRenderSnapshot?(): Readonly<GameSnapshot>;
  restart(options: MatchOptions): void;
  dispose(): void;
}
