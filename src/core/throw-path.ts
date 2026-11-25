import type { ThrowMode, Vec2 } from "./types";

// x/z use arena cells, y uses the same world height as the player's feet.
export function throwPoint(
  out: Vec2 & { y: number },
  origin: Vec2 & { elevation?: number },
  target: Vec2,
  progress: number,
  mode: ThrowMode,
) {
  const t = Math.max(0, Math.min(1, progress));
  let along = t,
    lift = 0.45;
  if (mode === "lob") {
    // Rise clear of adjacent cover before crossing its footprint, then descend into the landing cell.
    const u = Math.max(0, Math.min(1, (t - 0.16) / 0.66));
    along = u * u * (3 - 2 * u);
    lift = 3.8 + 0.36 * Math.hypot(target.x - origin.x, target.z - origin.z);
  }
  out.x = origin.x + (target.x - origin.x) * along;
  out.z = origin.z + (target.z - origin.z) * along;
  out.y = (1.12 + (origin.elevation ?? 0)) * (1 - t) + 0.1 * t + 4 * lift * t * (1 - t);
  return out;
}
