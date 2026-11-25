/** Serializable contracts. This layer deliberately has no DOM or Three.js imports. */
import type { Appearance, BotSlot } from "./room";
import type { MatchMode } from "./match-modes";
export type Tile = 0 | 1 | 2;
export type Phase = "countdown" | "playing" | "finished";
export type Consumable = string;
export type Equipment = "bomb" | Consumable;
export type ThrowMode = "direct" | "lob";
export type ItemId = string;
export type SkillId = string;
export interface Vec2 {
  x: number;
  z: number;
}
export interface PlayerInput {
  moveX: number;
  moveZ: number;
  sprint?: boolean;
  jump?: boolean;
  resetTerrain?: boolean;
  usePerk?: string;
  yaw: number;
  buy?: SkillId;
  refund?: SkillId;
  equip?: Equipment;
  bomb?: boolean;
  /** Place a charge on the current tile during Tactical View, independently of held equipment. */
  plantAtFeet?: boolean;
  meleeYaw?: number;
  bombTarget?: Vec2;
  throwMode?: ThrowMode;
  skill?: SkillId;
  perk?: string;
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
  inventory: Record<Consumable,number>;
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
  perks: string[];
  mutations?:Record<string,number>;
  offers: string[];
  tacticalView?: boolean;
  forcedViewUntil?: number;
  /** Expiry supplied by older snapshots and timed view modules. */
  dimensionUntil?: number;
  scanUntil: number;
  surgeUntil: number;
  jammedUntil: number;
  cooldowns: Record<SkillId, number>;
}
export interface Bomb extends Vec2 {
  blastDuration?: number;
  slide?: Vec2 & { arrivedAt: number; kickerId?:string };
  power?: number;
  id: number;
  ownerId: string;
  range: number;
  detonateAt: number;
  /** Actors overlapping a newly planted bubble can leave, then cannot re-enter. */
  passThrough: string[];
}
export interface Blast extends Vec2 {
  /** Snapshots without this field use the planted-charge rules. */
  source?: "charge" | "throwable";
  /** All flame cells from one charge or grenade share this ID. */
  explosionId?:number;
  absorbedBy?:string[];
  contactedBy?:string[];
  duration?: number;
  originX?: number;
  originZ?: number;
  power?: number;
  range?: number;
  id: number;
  ownerId: string;
  expiresAt: number;
}
export interface Item extends Vec2 {
  source?: "field";
  id: number;
  kind: ItemId;
}
export interface GameEvent {
  mutation?:string;
  shieldEnd?:"broken"|"expired";
  textEn?:string;
  coverSurface?: import("./pack-api").CoverSurface;
  zombieId?: number;
  zombieOutcome?: "hurt" | "killed";
  zombieLevel?: Zombie["level"];
  skill?: SkillId;
  blocked?: boolean;
  item?: ItemId;
  perk?: string;
  id: number;
  at: number;
  type:
    | "bomb"
    | "blast"
    | "blast-contact"
    | "equipment"
    | "equip"
    | "melee"
    | "cover-hit"
    | "shield-end"
    | "mutation"
    | "cover"
    | "pickup"
    | "hit"
    | "hurt"
    | "kill"
    | "perk"
    | "perk-use"
    | "level"
    | "skill";
  playerId: string;
  text: string;
  x: number;
  z: number;
}
export type Difficulty = "easy" | "normal" | "hard";
export interface Zombie extends Vec2 {
  hurtAt?: number;
  hp?: number;
  spawnAt?: number;
  attack?: { at: number; targetId: string; yaw: number };
  level: 1 | 2 | 3;
  id: number;
  yaw: number;
  destination: Vec2;
}
export const inTacticalView = (p:Readonly<Player>,time:number) =>
  (p.forcedViewUntil ?? 0) > time || (p.tacticalView ?? ((p.dimensionUntil ?? 0) > time));
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
  terrainReset?: { id:number; ownerId:string; at:number; completedAt?:number };
  arenaView?: { startsAt:number; endsAt:number };
  thrown: ThrownItem[];
  smoke: SmokeCloud[];
  difficulty: Difficulty;
  seed: number;
  mapId: string;
  mapName: string;
  size: number;
  tiles: Tile[][];
  /** Current cell index -> original cell index, shared by simulation and renderers. */
  coverOrigins?: Record<number,number>;
  coverRevision?: number;
  /** Accumulated melee damage keyed by the cover's original cell. */
  coverDamage?: Record<number,number>;
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
  zombieRate?: import("./room").ZombieRate;
  appearance?: Appearance;
  opponents?: BotSlot[];
  difficulty?: Difficulty;
  mapId: string;
  seed: number;
  humanId?: string;
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
