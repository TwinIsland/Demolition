import * as THREE from "three";

/**
 * Where the third dimension has got to. Everything within `front` world units of the origin
 * stands at its full height; beyond it the world lies flat, the way the story's overhead acts
 * show it. A front of 0 is the flat world, and a growing one stands it up from the origin out.
 */
export interface DimensionState {
  /** World position the third dimension spreads from. */
  x: number;
  z: number;
  /** Radius of the standing world, in world units. */
  front: number;
}

/** Height of the flat world as a fraction of the real one: enough to keep its layers in order. */
export const FLAT_HEIGHT = 0.03;
/** World units behind the front over which a thing grows to its full height. */
const RISE = 7;
/** Things that end below this height, in world units, are flat already and are left alone. */
const LOW = 0.08;

/** Overshoots by a tenth and settles: a thing pops up, it does not slide. */
function spring(u: number) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const c = 1.9,
    v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
}

export const heightAt = (state: DimensionState, x: number, z: number) =>
  FLAT_HEIGHT + (1 - FLAT_HEIGHT) * spring((state.front - Math.hypot(x - state.x, z - state.z)) / RISE);

/**
 * Presses the arena flat and lets it stand up again, by scaling real geometry: every instance of
 * the arena's static batches, and every object of the moving kind, about the floor. Because the
 * geometry itself grows, so do its shadows.
 */
export class DimensionField {
  private state?: DimensionState;
  /** Height factor last written to each instance of a batch. */
  private factors = new WeakMap<THREE.InstancedMesh, Float32Array>();
  /** True while anything is drawn at other than full height. */
  private pressed = false;

  set(state?: DimensionState) {
    this.state = state && { ...state };
  }

  get active() {
    return !!this.state || this.pressed;
  }

  /** Call once per frame, after the scene is synced. Returns true if any height changed. */
  update(arena: THREE.Object3D, moving: THREE.Object3D): boolean {
    const state = this.state;
    if (!state && !this.pressed) return false;
    const height = (x: number, z: number) => (state ? heightAt(state, x, z) : 1);
    let changed = false,
      pressed = false;
    for (const child of arena.children) {
      if (child instanceof THREE.InstancedMesh) {
        const result = this.pressBatch(child, height);
        changed ||= result.changed;
        pressed ||= result.pressed;
      } else {
        const factor = height(child.position.x, child.position.z);
        if (this.pressObject(child, factor)) changed = true;
        pressed ||= factor !== 1;
      }
    }
    for (const child of moving.children) {
      const factor = height(child.position.x, child.position.z);
      if (this.pressObject(child, factor)) changed = true;
      pressed ||= factor !== 1;
    }
    this.pressed = pressed;
    return changed;
  }

  private pressBatch(batch: THREE.InstancedMesh, height: (x: number, z: number) => number) {
    let factors = this.factors.get(batch);
    if (!factors) {
      factors = new Float32Array(batch.count).fill(1);
      this.factors.set(batch, factors);
    }
    const box = (batch.geometry.boundingBox ??= new THREE.Box3().setFromBufferAttribute(
      batch.geometry.getAttribute("position") as THREE.BufferAttribute,
    ));
    const m = batch.instanceMatrix.array;
    let changed = false,
      pressed = false;
    for (let i = 0; i < batch.count; i++) {
      const o = i * 16,
        was = factors[i];
      // The Y row carries the factor already applied; divide it out to judge the real height.
      const top = (m[o + 13] + Math.max(box.max.y * m[o + 5], box.min.y * m[o + 5])) / was;
      const factor = top < LOW ? 1 : height(m[o + 12], m[o + 14]);
      if (factor !== 1) pressed = true;
      if (Math.abs(factor - was) < 1e-4) continue;
      const ratio = factor / was;
      m[o + 1] *= ratio;
      m[o + 5] *= ratio;
      m[o + 9] *= ratio;
      m[o + 13] *= ratio;
      factors[i] = factor;
      changed = true;
    }
    if (changed) batch.instanceMatrix.needsUpdate = true;
    return { changed, pressed };
  }

  /** Objects outside the batches keep their own scale in `userData`, and are scaled from it. */
  private pressObject(object: THREE.Object3D, factor: number) {
    const base = (object.userData.dimensionBase ??=
      object.scale.y / (object.userData.dimension ?? 1)) as number;
    if (object.userData.dimension === factor || (factor === 1 && object.userData.dimension === undefined))
      return false;
    object.scale.y = base * factor;
    object.userData.dimension = factor;
    return true;
  }
}
