import * as THREE from "three";
import { RULES } from "../core/content";
import type { Blast, GameSnapshot } from "../core/types";
import { TILE_SIZE, world } from "./arena";

/** One atlas and at most one instanced draw per visible animation frame. */
export class BlastEffect {
  readonly root = new THREE.Group();
  private texture: THREE.Texture;
  private material: THREE.MeshBasicMaterial;
  private batches = new Map<number, THREE.InstancedMesh>();
  private transform = new THREE.Object3D();
  private embers = new Map<number, Blast>();

  constructor(manager: THREE.LoadingManager) {
    this.texture = new THREE.TextureLoader(manager).load("./assets/effects/detonation.png");
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
  }

  private batch(frame: number, count: number) {
    let mesh = this.batches.get(frame);
    if (mesh && mesh.instanceMatrix.count >= count) return mesh;
    let geometry = mesh?.geometry;
    if (!geometry) {
      geometry = new THREE.PlaneGeometry();
      const uv = geometry.getAttribute("uv");
      const col = frame % 4,
        row = 3 - Math.floor(frame / 4);
      for (let i = 0; i < uv.count; i++) {
        // Half-texel inset prevents neighboring frames bleeding into the billboard.
        uv.setXY(i, (col * 64 + 0.5 + 63 * uv.getX(i)) / 256, (row * 64 + 0.5 + 63 * uv.getY(i)) / 256);
      }
    }
    if (mesh) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    mesh = new THREE.InstancedMesh(geometry, this.material, 2 ** Math.ceil(Math.log2(Math.max(8, count))));
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(mesh);
    this.batches.set(frame, mesh);
    return mesh;
  }

  /** Batches are built on the first blast; this compiles their program and uploads the atlas. */
  warmObjects(): THREE.Object3D[] {
    for (let frame = 0; frame < 16; frame++) this.batch(frame, 1).visible = false;
    return [new THREE.InstancedMesh(this.batch(0, 1).geometry, this.material, 1)];
  }

  update(state: Readonly<GameSnapshot>, camera: THREE.Camera) {
    for (const mesh of this.batches.values()) mesh.visible = false;
    for (const b of state.blasts) this.embers.set(b.id, b);
    if (!this.embers.size) return;
    const frames = new Map<number, typeof state.blasts>();
    for (const blast of this.embers.values()) {
      const duration = blast.duration ?? RULES.blastDuration;
      const remaining = blast.expiresAt - state.time;
      const tail = 0.12;
      if (remaining <= -tail) {
        this.embers.delete(blast.id);
        continue;
      }
      const frame =
        remaining > 0
          ? Math.floor(12 * THREE.MathUtils.clamp(1 - remaining / duration, 0, 1))
          : Math.min(15, 12 + Math.floor((-4 * remaining) / tail));
      const group = frames.get(frame);
      if (group) group.push(blast);
      else frames.set(frame, [blast]);
    }
    for (const [frame, cells] of frames) {
      const mesh = this.batch(frame, cells.length);
      mesh.visible = true;
      mesh.count = cells.length;
      cells.forEach((cell, i) => {
        const center = cell.x === cell.originX && cell.z === cell.originZ;
        const size = TILE_SIZE * (center ? 1.38 : 1.06);
        this.transform.position.set(world(cell.x, state.size), size * 0.4, world(cell.z, state.size));
        this.transform.quaternion.copy(camera.quaternion);
        this.transform.rotateZ(Math.sin(cell.id * 4.17) * 0.18);
        this.transform.scale.set(size, size, 1);
        this.transform.updateMatrix();
        mesh.setMatrixAt(i, this.transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  clear() {
    this.embers.clear();
  }

  dispose() {
    for (const mesh of this.batches.values()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
    this.texture.dispose();
  }
}
