/** Serializable contracts. This layer deliberately has no DOM or Three.js imports. */
import type { LevelGain } from "./level-rewards";
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
  /**
   * Overhead view, where the walk is four-way: the axis to try first when both are pressed. The
   * other one is the fallback while that way is blocked. Absent: the larger of the two.
   */
  preferAxis?: "x" | "z";
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
  /** Build one crate from the stock, independently of equipped gear. */
  build?: boolean;
  /** Where the crate goes, aimed like a planted charge. Absent: the cell ahead. */
  buildTarget?: Vec2;
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
/** Per-match tallies for the after-action screen. They never feed back into the simulation. */
export interface MatchStats {
  /** Health taken off other operators. */
  damageDealt: number;
  damageTaken: number;
  /** Map cover opened; crates built by players do not count. */
  coverDestroyed: number;
  zombieKills: number;
  bombsPlaced: number;
  /** Simulation time of elimination. Absent while alive. */
  diedAt?: number;
}
export const emptyMatchStats = (): MatchStats => ({
  damageDealt: 0,
  damageTaken: 0,
  coverDestroyed: 0,
  zombieKills: 0,
  bombsPlaced: 0,
});
/** The player's tallies, created on first use so snapshots from before they existed still work. */
export const matchStats = (p: Player): MatchStats => (p.stats ??= emptyMatchStats());
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
  knifeStyle?: Appearance["knifeStyle"];
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  staminaRegenAt: number;
  sprinting: boolean;
  credits: number;
  /** Crates left to build with; refilled to the level's full stock on every level-up. */
  crates: number;
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
  stats?: MatchStats;
  xp: number;
  level: number;
  nextLevel: number;
  perks: PerkId[];
  mutations?: Record<MutationId, number>;
  offers: PerkId[];
  tacticalView?: boolean;
  forcedViewUntil?: number;
  scanUntil: number;
  /** Charges placed before this time keep their blast path hidden from everyone else. */
  veilUntil?: number;
  /** Invisible to opponents, bots and zombies until this time. */
  cloakUntil?: number;
  cooldowns: Record<SkillId, number>;
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
  /** The thrown item lying there, so it is drawn as itself rather than as a planted charge. */
  kind?: ItemId;
  /** Only the owner is shown where this charge will burn; bots have to guess. */
  concealed?: boolean;
  /** Taken over from another operator: it does not count against the new owner's capacity. */
  seized?: boolean;
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
/** A called-in missile on its way down. The caller sees the marker at once, everyone else shortly before impact; `radius` is in cells. */
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
  | EventBase<"bomb" | "blast" | "blast-contact" | "kill" | "build">
  /** A level reached, with the fixed stat gains that took effect. */
  | (EventBase<"level"> & { gains: LevelGain[] })
  /** A missile called on the event's cell, and its impact there. */
  | EventBase<"strike" | "strike-impact">
  /** Ground fire lit on the event's cell, by the named thrown item when there was one. */
  | (EventBase<"ignite"> & { item?: ItemId })
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
/** One burning floor cell. It hurts anyone standing in it, tick after tick, until it expires. */
export interface FireCell extends Vec2 {
  id: number;
  ownerId: string;
  /** The item that lit it, credited in the combat feed. */
  kind?: ItemId;
  damage: number;
  duration: number;
  expiresAt: number;
}
export interface GameSnapshot {
  mode?: MatchMode;
  /** Staged by story mode: see `StorySetup`. */
  story?: boolean;
  canResetTerrain?: boolean;
  /** Simulation time at which a map with `terrainShift` announces its next rearrangement. */
  terrainShiftAt?: number;
  terrainReset?: {
    id: number;
    /** Empty when the map itself called the reset. */
    ownerId: string;
    /** The map's own periodic rearrangement: no fire, and the lights stutter instead. */
    shift?: boolean;
    at: number;
    completedAt?: number;
    /** Health the fire sweep takes from everyone but the owner when the reset lands. */
    scorch?: number;
    /** Wall cells (z * size + x) about to change, published about a second before the swap. */
    wallPlan?: { rising: number[]; sinking: number[] };
  };
  /** Dimensional Collapse: everyone except `ownerId` is held in the overhead view. */
  arenaView?: { startsAt: number; endsAt: number; ownerId?: string };
  thrown: ThrownItem[];
  fires: FireCell[];
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
  /** Crates built by players. Their cells are cover (tile 2) that yields no score. */
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
/** Someone the story puts on the map beside the hero. */
export interface StoryActor extends Vec2 {
  id: string;
  name: string;
  color: string;
  skin: string;
  yaw?: number;
  difficulty?: Difficulty;
  /** A bystander: nothing hurts them. */
  passive?: boolean;
}
/**
 * A match staged by story mode instead of the lobby: a fixed cast on fixed cells, no countdown,
 * no closing zone, no field supplies, and no ending of its own. The story decides what happens.
 */
export interface StorySetup {
  spawn: Vec2;
  yaw?: number;
  cast: StoryActor[];
  /** Everyone starts in the overhead view. */
  overhead?: boolean;
}
export interface MatchOptions {
  story?: StorySetup;
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
  /**
   * Story mode's hand on the world: edits the authoritative state between ticks. A local session
   * only; a networked match has no such thing.
   */
  mutate?(change: (state: GameSnapshot) => void): void;
  /** Gives a player to an agent, or takes it back. */
  setAgent?(playerId: string, agent?: PlayerAgent): void;
  dispose(): void;
}
