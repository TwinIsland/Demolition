import type { Vec2 } from "./types";

/** Closing safe zone. The match has no timer: the boundary wall moves inward until one operator is left. */
export const ZONE = {
  /** Seconds for the zone to reach its minimum size; selectable in match settings. */
  durations: [120, 180, 240],
  defaultDuration: 180,
  /** No ring closes during the opening. */
  grace: 20,
  /** A ring flashes this long before the wall reaches it. */
  warning: 4,
  /** Clear the wall's route and the escape lane before it starts moving. */
  clearance: 0.5,
  /** Seconds the boundary takes to slide inward by one cell. */
  advance: 0.85,
  /** Half-width of the final safe square: 1 keeps the centre 3x3. */
  finalRadius: 1,
  /** The final square stays safe this long after the last ring closes. */
  finalHold: 15,
  /** Damage per second in the final firestorm. Shields do not absorb it. */
  damage: 12,
  /** Once the zone is at minimum size the whole arena burns, and this is added every `rampEvery` seconds. */
  ramp: 4,
  rampEvery: 5,
} as const;

export interface ZoneState {
  /** Rings 1..closed have turned into wall. Ring 0 is the original boundary wall. */
  closed: number;
  /** Ring that is flashing and will ignite at `nextRingAt`. */
  warningRing?: number;
  /** The ring being cleared for the next advance, including its inner escape lane. */
  clearingRing?: number;
  /** Simulation time of the next ignition; undefined once every ring has closed. */
  nextRingAt?: number;
  /** The zone is at minimum size and the centre burns too. */
  final: boolean;
  /** Current damage per second applied to operators standing in fire. */
  damage: number;
}

/** Distance of a cell from the boundary wall, in rings. */
export const ringOf = (size: number, cell: Vec2) => {
  const x = Math.round(cell.x),
    z = Math.round(cell.z);
  return Math.min(x, z, size - 1 - x, size - 1 - z);
};

/** Number of playable rings that close before the final square remains. */
export const closingRings = (size: number) => Math.max(0, (size - 1) / 2 - ZONE.finalRadius - 1);

/** Ignition time of ring `ring` (1-based). The last ring ignites exactly at `duration`. */
export function ringClosesAt(size: number, ring: number, duration: number) {
  const rings = closingRings(size),
    grace = Math.min(ZONE.grace, duration / 2);
  return rings ? grace + ((duration - grace) * ring) / rings : duration;
}

/** Pure function of map size, match time and the chosen duration, so every client and bot agrees. */
export function zoneAt(size: number, time: number, duration: number = ZONE.defaultDuration): ZoneState {
  const rings = closingRings(size);
  let closed = 0;
  while (closed < rings && time >= ringClosesAt(size, closed + 1, duration)) closed++;
  const finalAt = duration + ZONE.finalHold,
    final = time >= finalAt;
  const nextRingAt = closed < rings ? ringClosesAt(size, closed + 1, duration) : undefined;
  return {
    closed,
    nextRingAt,
    warningRing: nextRingAt !== undefined && time >= nextRingAt - ZONE.warning ? closed + 1 : undefined,
    clearingRing:
      nextRingAt !== undefined && time >= nextRingAt - ZONE.advance - ZONE.clearance ? closed + 1 : undefined,
    final,
    damage: ZONE.damage + (final ? ZONE.ramp * (1 + Math.floor((time - finalAt) / ZONE.rampEvery)) : 0),
  };
}

/** Progress of the horizontal advance; shared by collision and rendering. */
export const zoneAdvance = (time: number, zone: ZoneState) =>
  zone.nextRingAt === undefined ? 0 : Math.max(0, Math.min(1, 1 - (zone.nextRingAt - time) / ZONE.advance));

/** Inner face of the boundary wall, measured from the outermost cell centre. */
export const zoneWallInset = (time: number, zone: ZoneState) => zone.closed + 0.5 + zoneAdvance(time, zone);

/** Cells kept free of new obstacles while the boundary clears its route and advances. */
export const zoneClearing = (size: number, cell: Vec2, zone: ZoneState) =>
  zone.clearingRing !== undefined && ringOf(size, cell) <= zone.clearingRing + 1;

/** True where nothing can stand any more: closed rings are wall, and in the final phase the rest burns. */
export const zoneBurning = (size: number, cell: Vec2, zone: Pick<ZoneState, "closed" | "final">) =>
  zone.final || ringOf(size, cell) <= zone.closed;

/** Seconds until a cell ignites; 0 when it is already burning. */
export function zoneIgnitesIn(
  size: number,
  cell: Vec2,
  time: number,
  duration: number = ZONE.defaultDuration,
) {
  const ring = ringOf(size, cell);
  if (ring > closingRings(size)) return Math.max(0, duration + ZONE.finalHold - time);
  return Math.max(0, ringClosesAt(size, ring, duration) - time);
}
