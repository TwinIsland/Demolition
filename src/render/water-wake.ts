import * as THREE from "three";
import { groundAt, type MapDefinition } from "../core/pack-api";
import type { GameSnapshot } from "../core/types";
import { TILE_SIZE } from "../core/geometry";
import type { MaterialLibrary } from "./materials";
import { WATER_LEVEL } from "./pool-hall";

/**
 * What wading through a pool looks like: every step sends a ring of ripples across the water
 * and throws up a few drops, and whoever stands in a pool stands on its floor, ankle deep.
 *
 * The ripples are not geometry. The water material reads a short list of recent steps and bends
 * its own surface around them, so they catch the lights and the reflection like the swell does.
 */

/** How far below the deck a wader's feet rest: just above the pool lining. */
const WADE_DEPTH = 0.15;
/** Cells walked between two steps; each foot lands once per stride. */
const STEP = 0.43;
const DROPS = 220;
const DROP_LIFE = 0.55;

interface Wader {
  x: number;
  z: number;
  travel: number;
  sink: number;
  /** Time of the next ring from someone standing still. */
  idleAt: number;
  airborne: boolean;
  side: number;
}

const DROP_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uHeight;
attribute vec3 aVelocity;
attribute float aBirth;
varying float vFade;
void main() {
  float age = uTime - aBirth;
  vec3 p = position + aVelocity * age + vec3(0.0, -4.9 * age * age, 0.0);
  float alive = step(0.0, age) * step(age, ${DROP_LIFE.toFixed(2)}) * step(${WATER_LEVEL.toFixed(2)}, p.y);
  vFade = alive * (1.0 - age / ${DROP_LIFE.toFixed(2)});
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  // Works for the perspective eye and the orthographic board alike.
  gl_PointSize = alive * 0.07 * (0.6 + 0.4 * vFade) * uHeight * 0.5 * projectionMatrix[1][1] / gl_Position.w;
}`;
const DROP_FRAGMENT = /* glsl */ `
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.55, 1.0, d)) * vFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.78, 0.93, 0.96), a * 0.8);
}`;

export class WaterWake {
  readonly root: THREE.Points;
  private wakes: THREE.Vector4[];
  private nextWake = 0;
  private nextDrop = 0;
  private waders = new Map<string, Wader>();
  private last = 0;
  private origin: THREE.BufferAttribute;
  private velocity: THREE.BufferAttribute;
  private birth: THREE.BufferAttribute;
  private uniforms = { uTime: { value: 0 }, uHeight: { value: 720 } };

  constructor(materials: MaterialLibrary) {
    this.wakes = materials.wakes;
    const geometry = new THREE.BufferGeometry();
    this.origin = new THREE.BufferAttribute(new Float32Array(DROPS * 3), 3);
    this.velocity = new THREE.BufferAttribute(new Float32Array(DROPS * 3), 3);
    this.birth = new THREE.BufferAttribute(new Float32Array(DROPS).fill(-1e6), 1);
    for (const attribute of [this.origin, this.velocity, this.birth])
      attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", this.origin);
    geometry.setAttribute("aVelocity", this.velocity);
    geometry.setAttribute("aBirth", this.birth);
    this.root = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: DROP_VERTEX,
        fragmentShader: DROP_FRAGMENT,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.root.frustumCulled = false;
    this.root.visible = false;
  }

  /** Forget everyone, for a new arena. Rings already on the water are cleared as well. */
  reset() {
    this.waders.clear();
    for (const wake of this.wakes) wake.w = 0;
    this.birth.array.fill(-1e6);
    this.birth.needsUpdate = true;
  }

  /** How far the player `id` has sunk into a pool, in world units. Eases in and out at the edge. */
  sink(id: string) {
    return this.waders.get(id)?.sink ?? 0;
  }

  private ring(x: number, z: number, time: number, strength: number) {
    this.wakes[this.nextWake].set(x, z, time, strength);
    this.nextWake = (this.nextWake + 1) % this.wakes.length;
  }

  private splash(x: number, z: number, time: number, count: number, force: number) {
    for (let i = 0; i < count; i++) {
      const slot = this.nextDrop,
        turn = Math.random() * Math.PI * 2,
        out = (0.4 + Math.random() * 0.9) * force;
      this.origin.setXYZ(slot, x + Math.cos(turn) * 0.08, WATER_LEVEL + 0.01, z + Math.sin(turn) * 0.08);
      this.velocity.setXYZ(
        slot,
        Math.cos(turn) * out,
        (1.5 + Math.random() * 1.5) * force,
        Math.sin(turn) * out,
      );
      this.birth.setX(slot, time);
      this.nextDrop = (slot + 1) % DROPS;
    }
    this.origin.needsUpdate = this.velocity.needsUpdate = this.birth.needsUpdate = true;
  }

  /**
   * Follow the players for one frame. `time` is the clock the water shader runs on, and
   * `viewHeight` the height of the drawing buffer in pixels.
   */
  update(state: Readonly<GameSnapshot>, map: MapDefinition | undefined, time: number, viewHeight: number) {
    const pool = map?.theme === "poolrooms";
    this.root.visible = pool;
    if (!map || !pool) {
      if (this.waders.size) this.reset();
      return;
    }
    const dt = Math.min(0.1, Math.max(0, time - this.last));
    this.last = time;
    this.uniforms.uTime.value = time;
    this.uniforms.uHeight.value = viewHeight;
    const at = (cell: number) => (cell - (state.size - 1) / 2) * TILE_SIZE;
    for (const p of state.players) {
      let wader = this.waders.get(p.id);
      if (!wader) {
        wader = { x: p.x, z: p.z, travel: 0, sink: 0, idleAt: time + 1, airborne: false, side: 1 };
        this.waders.set(p.id, wader);
      }
      const moved = Math.hypot(p.x - wader.x, p.z - wader.z);
      wader.x = p.x;
      wader.z = p.z;
      const wet = p.alive && groundAt(map, p.x, p.z) === "water";
      wader.sink += ((wet ? WADE_DEPTH : 0) - wader.sink) * Math.min(1, dt * 9);
      const grounded = p.elevation < 0.05;
      const landed = wader.airborne && grounded;
      wader.airborne = !grounded;
      if (!wet || !grounded) {
        wader.travel = 0;
        continue;
      }
      const x = at(p.x),
        z = at(p.z);
      if (landed) {
        this.ring(x, z, time, 1.5);
        this.splash(x, z, time, 14, 1.25);
        continue;
      }
      // A teleport is not a stride.
      wader.travel += moved < 1 ? moved : 0;
      if (wader.travel >= STEP) {
        wader.travel %= STEP;
        wader.side = -wader.side;
        // Left and right feet land either side of the line of travel.
        const fx = x + Math.cos(p.yaw) * 0.13 * wader.side,
          fz = z - Math.sin(p.yaw) * 0.13 * wader.side;
        this.ring(fx, fz, time, 1);
        this.splash(fx, fz, time, 9, 1);
        wader.idleAt = time + 1.2;
      } else if (time >= wader.idleAt) {
        // Someone standing in a pool still disturbs it a little.
        this.ring(x, z, time, 0.35);
        wader.idleAt = time + 1.6 + Math.random() * 0.8;
      }
    }
  }

  dispose() {
    this.root.geometry.dispose();
    (this.root.material as THREE.Material).dispose();
  }
}
