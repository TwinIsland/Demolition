import { combatMessage, type CombatMessage } from "../combat-message";
import type { GameEvent, GameSnapshot, Player, Vec2 } from "../types";
import type { SimContext } from "./context";

type StampedField = "id" | "at" | "playerId" | "text" | "textEn" | "x" | "z";
/** An event's type and its own payload; emit() stamps the shared fields. */
export type EventInit = GameEvent extends infer E
  ? E extends GameEvent
    ? Omit<E, StampedField>
    : never
  : never;

/** The log keeps recent events only; mutation events outlive the count limit until they age out. */
const EVENT_LOG = { seconds: 12, count: 30 } as const;

/**
 * Appends to the snapshot's event log, located at the player unless `at` says otherwise.
 * Every event consumes one id from the shared sequence.
 */
export function emit(
  ctx: SimContext,
  p: Player,
  text: string | CombatMessage,
  event: EventInit,
  at: Vec2 = p,
) {
  const stamped = {
    ...event,
    id: ctx.nextId(),
    at: ctx.state.time,
    playerId: p.id,
    text: typeof text === "string" ? text : text.zh,
    textEn: typeof text === "string" ? combatMessage(text).en : text.en,
    x: at.x,
    z: at.z,
  };
  // Sound: spreading a union member plus the shared fields yields that same member.
  ctx.state.events.push(stamped as GameEvent);
}

export function pruneEvents(s: GameSnapshot) {
  s.events = s.events.filter(
    (e, i, events) =>
      e.at > s.time - EVENT_LOG.seconds && (i >= events.length - EVENT_LOG.count || e.type === "mutation"),
  );
}
