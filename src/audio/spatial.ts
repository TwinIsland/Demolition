import type { Vec2 } from "../core/types";

export interface Listener extends Vec2 {
  yaw: number;
}

const MAX_PAN = 0.8;
/** Sources closer than this fold towards the centre so nearby sounds do not flip sides. */
const PAN_NEAR = 2;

export const distanceTo = (listener: Vec2, source: Vec2) =>
  Math.hypot(source.x - listener.x, source.z - listener.z);

/** Linear distance attenuation, never below `floor`. */
export const falloff = (distance: number, range: number, floor = 0) => Math.max(floor, 1 - distance / range);

/** Stereo position in [-1, 1]; yaw 0 faces -Z, so the listener's right is (cos yaw, -sin yaw). */
export function panTo(listener: Listener, source: Vec2) {
  const dx = source.x - listener.x;
  const dz = source.z - listener.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-3) return 0;
  const lateral = (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / distance;
  return MAX_PAN * lateral * Math.min(1, distance / PAN_NEAR);
}
