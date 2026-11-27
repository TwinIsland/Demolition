import * as THREE from "three";
import { RULES } from "../core/content";
import { BOMB_STYLES } from "../core/room";
import type { Blast, GameSnapshot } from "../core/types";
import { TILE_SIZE, world } from "./arena";

/** A 4 x 4 flipbook. A finish's own sheet is drawn larger and lingers longer than the standard one. */
interface Sheet {
  material: THREE.MeshBasicMaterial;
  scale: number;
  tail: number;
}

/** One atlas per kind of explosion and at most one instanced draw per atlas and visible frame. */
export class BlastEffect {
  readonly root = new THREE.Group();
  private standard: Sheet;
  /** By bomb finish ID. */
  private sheets = new Map<string, Sheet>();
  private geometries: THREE.PlaneGeometry[] = [];
  private batches = new Map<Sheet, Map<number, THREE.InstancedMesh>>();
  private transform = new THREE.Object3D();
  private embers = new Map<number, Blast>();
  private finishes = new Map<string, string | undefined>();

  constructor(manager: THREE.LoadingManager) {
    const loader = new THREE.TextureLoader(manager);
    const sheet = (url: string, scale: number, tail: number): Sheet => {
      const texture = loader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      return { material, scale, tail };
    };
    this.standard = sheet("./assets/effects/detonation.png", 1, 0.12);
    // Every finish's sheet loads with the match, so that none arrives mid-fight.
    for (const finish of Object.values(BOMB_STYLES))
      if (finish.explosion) this.sheets.set(finish.id, sheet(finish.explosion, 1.5, 0.3));
    for (let frame = 0; frame < 16; frame++) {
      const geometry = new THREE.PlaneGeometry();
      const uv = geometry.getAttribute("uv");
      const col = frame % 4,
        row = 3 - Math.floor(frame / 4);
      // A small inset prevents neighboring frames bleeding into the billboard.
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, (col + 0.008 + 0.984 * uv.getX(i)) / 4, (row + 0.008 + 0.984 * uv.getY(i)) / 4);
      this.geometries.push(geometry);
    }
  }

  private batch(sheet: Sheet, frame: number, count: number) {
    let frames = this.batches.get(sheet);
    if (!frames) this.batches.set(sheet, (frames = new Map()));
    let mesh = frames.get(frame);
    if (mesh && mesh.instanceMatrix.count >= count) return mesh;
    if (mesh) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    mesh = new THREE.InstancedMesh(
      this.geometries[frame],
      sheet.material,
      2 ** Math.ceil(Math.log2(Math.max(8, count))),
    );
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(mesh);
    frames.set(frame, mesh);
    return mesh;
  }

  /** Batches are built on the first blast; this compiles their program and uploads the atlases. */
  warmObjects(): THREE.Object3D[] {
    for (let frame = 0; frame < 16; frame++) this.batch(this.standard, frame, 1).visible = false;
    return [this.standard, ...this.sheets.values()].map(
      (sheet) => new THREE.InstancedMesh(this.geometries[0], sheet.material, 1),
    );
  }

  update(state: Readonly<GameSnapshot>, camera: THREE.Camera) {
    for (const frames of this.batches.values()) for (const mesh of frames.values()) mesh.visible = false;
    for (const b of state.blasts) this.embers.set(b.id, b);
    if (!this.embers.size) return;
    this.finishes.clear();
    for (const p of state.players) this.finishes.set(p.id, p.bombStyle);
    const groups = new Map<Sheet, Map<number, Blast[]>>();
    for (const blast of this.embers.values()) {
      // Only a planted charge carries its owner's finish; grenades and missiles keep the standard blast.
      const sheet =
        ((blast.source ?? "bomb") === "bomb" && this.sheets.get(this.finishes.get(blast.ownerId) ?? "")) ||
        this.standard;
      const duration = blast.duration ?? RULES.blastDuration;
      const remaining = blast.expiresAt - state.time;
      if (remaining <= -sheet.tail) {
        this.embers.delete(blast.id);
        continue;
      }
      const frame =
        remaining > 0
          ? Math.floor(12 * THREE.MathUtils.clamp(1 - remaining / duration, 0, 1))
          : Math.min(15, 12 + Math.floor((-4 * remaining) / sheet.tail));
      let frames = groups.get(sheet);
      if (!frames) groups.set(sheet, (frames = new Map()));
      const group = frames.get(frame);
      if (group) group.push(blast);
      else frames.set(frame, [blast]);
    }
    for (const [sheet, frames] of groups)
      for (const [frame, cells] of frames) {
        const mesh = this.batch(sheet, frame, cells.length);
        mesh.visible = true;
        mesh.count = cells.length;
        cells.forEach((cell, i) => {
          const center = cell.x === cell.originX && cell.z === cell.originZ;
          const size = TILE_SIZE * (center ? 1.38 : 1.06) * sheet.scale;
          this.transform.position.set(
            world(cell.x, state.size),
            TILE_SIZE * (center ? 1.38 : 1.06) * 0.4,
            world(cell.z, state.size),
          );
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
    for (const frames of this.batches.values()) for (const mesh of frames.values()) mesh.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const sheet of [this.standard, ...this.sheets.values()]) {
      sheet.material.map?.dispose();
      sheet.material.dispose();
    }
  }
}
