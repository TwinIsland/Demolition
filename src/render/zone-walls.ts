import * as THREE from "three";
import { MAPS } from "../core/maps";
import type { GameSnapshot } from "../core/types";
import { ringOf } from "../core/zone";
import { world } from "./arena";
import { hazardTexture } from "./feel/wall-telegraph";
import type { Models } from "./models";

/** The wall of the next ring starts rising this long before the ring closes, so it is solid on time. */
const RISE = 0.85;
const DEPTH = 2.75;
const DUST_TIME = 1.1;
const WARNING_TINT = "#ff7a3c";

function dustTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const fade = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,0.9)");
  fade.addColorStop(0.5, "rgba(255,255,255,0.35)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

interface Part {
  mesh: THREE.InstancedMesh;
  local: THREE.Matrix4;
}

/**
 * The closing zone as physical walls: the ring about to close is marked on the ground, its wall
 * rises out of the floor just before the deadline, and closed rings stay walled off.
 * Everything is derived from `state.zone`, so it needs no events from the simulation.
 */
export class ZoneWalls {
  private parts: Part[] = [];
  private cells: { x: number; z: number; ring: number }[] = [];
  /** Instances from this index on belong to the ring that is currently rising. */
  private risingFrom = 0;
  private signature = "";
  private builtFor = "";
  /** Cells the arena still draws as map-defined walls; the zone does not double them. */
  private standing: ReadonlySet<number> = new Set<number>();
  private closed = 0;
  private risingRing?: number;
  private dustAt = -Infinity;

  private warningTexture = hazardTexture();
  private warningGeometry = new THREE.PlaneGeometry(2.3, 2.3).rotateX(-Math.PI / 2);
  private warningMaterial = new THREE.MeshBasicMaterial({
    map: this.warningTexture,
    color: WARNING_TINT,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  private warning?: THREE.InstancedMesh;
  /** Final phase: the ground inside the last wall burns. */
  private fireMaterial = new THREE.MeshBasicMaterial({
    color: "#ff5a1f",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    toneMapped: false,
  });
  private fire?: THREE.InstancedMesh;
  private dustTexture = dustTexture();
  private dustMaterial = new THREE.PointsMaterial({
    map: this.dustTexture,
    color: "#b9b2a2",
    size: 3.4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  private dust = new THREE.Points(new THREE.BufferGeometry(), this.dustMaterial);
  private matrix = new THREE.Matrix4();
  private offset = new THREE.Matrix4();

  constructor(
    private parent: THREE.Object3D,
    private models: Models,
  ) {
    this.dust.frustumCulled = false;
    this.dust.visible = false;
    this.dust.renderOrder = 6;
    parent.add(this.dust);
  }

  /** Instanced copies of the arena's boundary wall, one slot per playable cell. */
  private prepare(state: Readonly<GameSnapshot>) {
    const key = `${state.seed}:${state.mapId}:${state.size}`;
    if (key === this.builtFor) return;
    this.clear();
    this.builtFor = key;
    const map = MAPS.find((m) => m.id === state.mapId);
    const template = this.models.wall(map?.theme === "midnight");
    template.updateMatrixWorld(true);
    const capacity = (state.size - 2) ** 2;
    template.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(object.geometry, object.material, capacity);
      mesh.count = 0;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.parent.add(mesh);
      this.parts.push({ mesh, local: object.matrixWorld.clone() });
    });
  }

  private place(index: number, cell: { x: number; z: number }, size: number, lift: number) {
    this.offset.makeTranslation(world(cell.x, size), lift, world(cell.z, size));
    for (const part of this.parts)
      part.mesh.setMatrixAt(index, this.matrix.multiplyMatrices(this.offset, part.local));
  }

  private rebuildWalls(state: Readonly<GameSnapshot>, closed: number, rising?: number) {
    const size = state.size;
    this.cells = [];
    for (let z = 1; z < size - 1; z++)
      for (let x = 1; x < size - 1; x++) {
        const ring = ringOf(size, { x, z });
        if ((ring <= closed || ring === rising) && !this.standing.has(z * size + x))
          this.cells.push({ x, z, ring });
      }
    // Settled rings first, so the rising ring is one contiguous range to animate.
    this.cells.sort((a, b) => Number(a.ring === rising) - Number(b.ring === rising));
    this.risingFrom = this.cells.findIndex((cell) => cell.ring === rising);
    if (this.risingFrom < 0) this.risingFrom = this.cells.length;
    this.cells.forEach((cell, index) => this.place(index, cell, size, index < this.risingFrom ? 0 : -DEPTH));
    for (const { mesh } of this.parts) {
      mesh.count = this.cells.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private rebuildWarning(state: Readonly<GameSnapshot>, ring?: number) {
    this.warning?.removeFromParent();
    this.warning?.dispose();
    this.warning = undefined;
    if (ring === undefined) return;
    const size = state.size,
      cells: { x: number; z: number }[] = [];
    for (let z = 1; z < size - 1; z++)
      for (let x = 1; x < size - 1; x++) if (ringOf(size, { x, z }) === ring) cells.push({ x, z });
    if (!cells.length) return;
    const mesh = new THREE.InstancedMesh(this.warningGeometry, this.warningMaterial, cells.length);
    cells.forEach((cell, index) => {
      // On the floor, or on top of cover that still stands in the ring.
      const y = state.tiles[cell.z][cell.x] === 0 ? 0.04 : 1.92;
      mesh.setMatrixAt(index, this.matrix.makeTranslation(world(cell.x, size), y, world(cell.z, size)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.parent.add(mesh);
    this.warning = mesh;
  }

  private rebuildFire(state: Readonly<GameSnapshot>, closed: number) {
    const size = state.size,
      cells: { x: number; z: number }[] = [];
    for (let z = 1; z < size - 1; z++)
      for (let x = 1; x < size - 1; x++)
        if (ringOf(size, { x, z }) > closed && state.tiles[z][x] !== 1) cells.push({ x, z });
    const mesh = new THREE.InstancedMesh(this.warningGeometry, this.fireMaterial, Math.max(1, cells.length));
    mesh.count = cells.length;
    cells.forEach((cell, index) => {
      const y = state.tiles[cell.z][cell.x] === 0 ? 0.04 : 1.92;
      mesh.setMatrixAt(index, this.matrix.makeTranslation(world(cell.x, size), y, world(cell.z, size)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.parent.add(mesh);
    this.fire = mesh;
  }

  private raiseDust(state: Readonly<GameSnapshot>, ring: number) {
    const size = state.size,
      points: number[] = [];
    for (let z = 1; z < size - 1; z++)
      for (let x = 1; x < size - 1; x++)
        if (ringOf(size, { x, z }) === ring)
          for (const [dx, dz] of [
            [-0.3, 0.2],
            [0.3, -0.2],
          ])
            points.push(world(x + dx, size), 0.25, world(z + dz, size));
    this.dust.geometry.dispose();
    this.dust.geometry = new THREE.BufferGeometry();
    this.dust.geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    this.dustAt = state.time;
  }

  /** Returns the shake to apply this frame: non-zero when a wall starts rising or slams into place. */
  sync(state: Readonly<GameSnapshot>, mapChanged: boolean, arenaWalls: ReadonlySet<number>) {
    this.standing = arenaWalls;
    const zone = state.phase === "playing" ? state.zone : undefined;
    if (!zone) {
      if (this.builtFor) this.clear();
      return 0;
    }
    this.prepare(state);
    const left = zone.nextRingAt === undefined ? Infinity : zone.nextRingAt - state.time;
    const rising = zone.warningRing !== undefined && left <= RISE ? zone.warningRing : undefined;
    const signature = `${zone.final}:${zone.closed}:${zone.warningRing ?? 0}:${rising ?? 0}:${state.coverRevision ?? 0}:${arenaWalls.size}`;
    let shake = 0;
    if (signature !== this.signature || mapChanged) {
      const startedRising = rising !== undefined && rising !== this.risingRing;
      this.risingRing = rising;
      this.signature = signature;
      this.rebuildWalls(state, zone.closed, rising);
      this.rebuildWarning(state, zone.warningRing);
      this.fire?.removeFromParent();
      this.fire?.dispose();
      this.fire = undefined;
      if (zone.final) this.rebuildFire(state, zone.closed);
      if (startedRising) {
        this.raiseDust(state, rising);
        shake = 0.22;
      }
      if (zone.closed > this.closed) shake = 0.5;
      this.closed = zone.closed;
    }
    if (rising !== undefined && this.risingFrom < this.cells.length) {
      const u = THREE.MathUtils.clamp(1 - left / RISE, 0, 1);
      // Fast out of the ground, then a firm stop.
      const lift = -DEPTH * (1 - u) ** 2;
      for (let i = this.risingFrom; i < this.cells.length; i++)
        this.place(i, this.cells[i], state.size, lift);
      for (const { mesh } of this.parts) mesh.instanceMatrix.needsUpdate = true;
    }
    // The warning flashes faster as the wall approaches.
    this.warningMaterial.opacity =
      0.5 + 0.5 * (0.5 + 0.5 * Math.sin(state.time * (7 + 12 / (0.4 + Math.max(0, left)))));
    if (zone.final) this.fireMaterial.opacity = 0.34 + 0.1 * Math.sin(state.time * 5.2);
    const dustAge = state.time - this.dustAt;
    this.dust.visible = dustAge >= 0 && dustAge < DUST_TIME;
    if (this.dust.visible) {
      const t = dustAge / DUST_TIME;
      this.dustMaterial.opacity = 0.55 * Math.sin(Math.PI * Math.sqrt(t));
      this.dustMaterial.size = 2.6 + 3.2 * t;
      this.dust.position.y = 0.9 * t;
    }
    return shake;
  }

  clear() {
    for (const { mesh } of this.parts) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.parts = [];
    this.cells = [];
    this.warning?.removeFromParent();
    this.warning?.dispose();
    this.warning = undefined;
    this.fire?.removeFromParent();
    this.fire?.dispose();
    this.fire = undefined;
    this.dust.visible = false;
    this.dustAt = -Infinity;
    this.signature = this.builtFor = "";
    this.closed = 0;
    this.risingRing = undefined;
  }

  dispose() {
    this.clear();
    this.dust.removeFromParent();
    this.dust.geometry.dispose();
    this.dustMaterial.dispose();
    this.dustTexture.dispose();
    this.warningGeometry.dispose();
    this.warningMaterial.dispose();
    this.fireMaterial.dispose();
    this.warningTexture.dispose();
  }
}
