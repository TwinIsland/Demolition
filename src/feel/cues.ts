/**
 * Presentation cues derived from snapshots.
 *
 * This is the only feel module that reads GameEvent and snapshot fields, so a change to the event
 * contract is absorbed here. Nothing in this file writes to the snapshot: cues are a read-only view
 * and the simulation stays deterministic regardless of what the presentation does with them.
 */
import { ITEMS } from "../core/content";
import type { GameEvent, GameSnapshot, Player, Vec2 } from "../core/types";
import { ZOMBIE_STRIKE } from "../core/zombies";

type DamageCause = "zombie" | "blast" | "melee" | "other";
export type Cue =
  /** The local player lost health. `source` is in cell coordinates when the attacker can be located. */
  | { type: "damage"; amount: number; cause: DamageCause; source?: Vec2 }
  | { type: "blocked"; source?: Vec2 }
  /** The local player used a non-throwable consumable such as a bandage. */
  | { type: "consume"; item: string; heals: boolean; healed: number }
  /** Any charge or grenade went off; `distance` is measured in cells from the local player. */
  | { type: "blast"; x: number; z: number; distance: number }
  | { type: "plant" }
  | { type: "throw"; item: string }
  | { type: "swing" }
  | { type: "equip"; item: string }
  | { type: "pickup"; item: string }
  /** The local player's attack connected. */
  | { type: "strike"; killed: boolean }
  | { type: "elimination" }
  | { type: "land"; speed: number }
  /** World-space cues for other actors, stamped with simulation time. */
  | { type: "actor-consume"; playerId: string; item: string; heals: boolean; at: number }
  /** Any operator, the local one included, lost health. `source` is in cell coordinates when known. */
  | { type: "actor-hurt"; playerId: string; at: number; source?: Vec2 };

const isConsumable = (item?: string) => {
  const definition = item ? ITEMS[item] : undefined;
  return !!definition && !definition.throwable && !definition.melee;
};
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Best-effort attacker lookup. The hurt event itself does not carry a source. */
function locateAttacker(
  state: Readonly<GameSnapshot>,
  you: Readonly<Player>,
  hurt: GameEvent,
): { cause: DamageCause; source?: Vec2 } {
  const strikeWindow = ZOMBIE_STRIKE.windup + ZOMBIE_STRIKE.recovery + 0.1;
  let zombie: Vec2 | undefined;
  for (const enemy of state.zombies) {
    const attack = enemy.attack;
    if (!attack || attack.targetId !== you.id || state.time - attack.at > strikeWindow) continue;
    if (!zombie || distance(enemy, you) < distance(zombie, you)) zombie = enemy;
  }
  if (zombie) return { cause: "zombie", source: { x: zombie.x, z: zombie.z } };

  for (const event of state.events)
    if (event.type === "melee" && event.playerId !== you.id && Math.abs(event.at - hurt.at) < 0.05) {
      const attacker = state.players.find((p) => p.id === event.playerId);
      if (attacker && distance(attacker, you) < 3)
        return { cause: "melee", source: { x: attacker.x, z: attacker.z } };
    }

  let blast: Vec2 | undefined;
  let nearest = 1.6;
  for (const cell of state.blasts) {
    const d = distance(cell, you);
    if (d >= nearest) continue;
    nearest = d;
    blast = { x: cell.originX ?? cell.x, z: cell.originZ ?? cell.z };
  }
  if (blast) return { cause: "blast", source: distance(blast, you) > 0.35 ? blast : undefined };
  return { cause: "other" };
}

/** Each consumer (renderer, HUD) owns a tracker so they can run at different rates. */
export class CueTracker {
  private cursor = 0;
  private seed = Number.NaN;
  private hp = 0;
  private verticalSpeed = 0;
  private equipped = "";
  private burning = new Set<number>();
  private spare = new Set<number>();
  private readonly cues: Cue[] = [];

  /** Returns the cues that appeared since the previous call. The array is reused between calls. */
  collect(state: Readonly<GameSnapshot>, localId: string): readonly Cue[] {
    const cues = this.cues;
    cues.length = 0;
    const you = state.players.find((p) => p.id === localId);
    const latest = state.events.at(-1)?.id ?? 0;
    if (!you) return cues;
    if (state.seed !== this.seed || latest < this.cursor) {
      // New match: adopt its state silently instead of replaying old events.
      this.seed = state.seed;
      this.cursor = latest;
      this.hp = you.hp;
      this.verticalSpeed = you.verticalSpeed;
      this.equipped = you.equipped;
      this.burning.clear();
      for (const cell of state.blasts) this.burning.add(cell.explosionId ?? cell.id);
      return cues;
    }

    const lost = this.hp - you.hp;
    for (const event of state.events) {
      if (event.id <= this.cursor) continue;
      const own = event.playerId === localId;
      switch (event.type) {
        case "hurt":
          if (own && event.blocked)
            cues.push({ type: "blocked", source: locateAttacker(state, you, event).source });
          else if (!event.blocked) {
            const victim = own ? you : state.players.find((p) => p.id === event.playerId);
            const attack = victim ? locateAttacker(state, victim, event) : { cause: "other" as const };
            cues.push({ type: "actor-hurt", playerId: event.playerId, at: event.at, source: attack.source });
            if (own) cues.push({ type: "damage", amount: Math.max(0, lost), ...attack });
          }
          break;
        case "equipment":
          if (!event.item) break;
          if (isConsumable(event.item)) {
            const heals = !!ITEMS[event.item].stats?.heal;
            cues.push({
              type: "actor-consume",
              playerId: event.playerId,
              item: event.item,
              heals,
              at: event.at,
            });
            if (own) cues.push({ type: "consume", item: event.item, heals, healed: Math.max(0, -lost) });
          } else if (own) cues.push({ type: "throw", item: event.item });
          break;
        case "bomb":
          if (own) cues.push({ type: "plant" });
          break;
        case "melee":
          if (own) cues.push({ type: "swing" });
          break;
        case "pickup":
          if (own && event.item) cues.push({ type: "pickup", item: event.item });
          break;
        case "hit":
          if (own) cues.push({ type: "strike", killed: event.zombie?.outcome === "killed" });
          break;
        case "kill":
          // Deaths caused by zombies or by the victim's own charge are filed under the victim.
          if (own && you.alive) cues.push({ type: "elimination" });
          break;
      }
    }
    // Explosions are read from the flame cells so that grenades count as well as planted charges.
    const burning = this.burning;
    this.burning = this.spare;
    this.spare = burning;
    this.burning.clear();
    for (const cell of state.blasts) {
      const id = cell.explosionId ?? cell.id;
      if (this.burning.has(id)) continue;
      this.burning.add(id);
      if (burning.has(id)) continue;
      const origin = { x: cell.originX ?? cell.x, z: cell.originZ ?? cell.z };
      cues.push({ type: "blast", ...origin, distance: distance(origin, you) });
    }
    if (you.equipped !== this.equipped) cues.push({ type: "equip", item: you.equipped });
    if (this.verticalSpeed < -1 && you.verticalSpeed === 0 && you.elevation === 0)
      cues.push({ type: "land", speed: -this.verticalSpeed });

    this.cursor = Math.max(this.cursor, latest);
    this.hp = you.hp;
    this.verticalSpeed = you.verticalSpeed;
    this.equipped = you.equipped;
    return cues;
  }
}

/**
 * Bearing of a cell-space point relative to the view direction, in radians.
 * 0 is straight ahead, positive is to the right. Matches the first-person camera (forward = -Z at yaw 0).
 */
export function relativeBearing(from: Vec2, to: Vec2, yaw: number) {
  const dx = to.x - from.x,
    dz = to.z - from.z;
  const forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return Math.atan2(right, forward);
}
