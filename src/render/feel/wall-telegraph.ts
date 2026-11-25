import * as THREE from "three";
import { TILE_SIZE } from "../../core/geometry";
import type { GameSnapshot } from "../../core/types";

const CAPACITY = 128;
const LEAD = 1;

/** Cells where permanent walls are about to rise, when the simulation publishes them ahead of the swap. */
function plannedCells(state: Readonly<GameSnapshot>): readonly number[] | undefined {
  const reset = state.terrainReset;
  return reset && reset.completedAt === undefined ? reset.wallPlan?.rising : undefined;
}

/** Striped warning tile with upward chevrons, drawn once at start-up. Tint it through the material colour. */
export function hazardTexture() {
  const size = 128,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgba(255,176,46,0.22)";
  g.fillRect(6, 6, size - 12, size - 12);
  // Diagonal hazard stripes, clipped to the tile.
  g.save();
  g.beginPath();
  g.rect(6, 6, size - 12, size - 12);
  g.clip();
  g.strokeStyle = "rgba(255,176,46,0.5)";
  g.lineWidth = 9;
  for (let x = -size; x < size * 2; x += 30) {
    g.beginPath();
    g.moveTo(x, size);
    g.lineTo(x + size, 0);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "#ffd27a";
  g.lineWidth = 8;
  g.strokeRect(8, 8, size - 16, size - 16);
  // Upward chevrons: something is coming out of the floor here.
  g.strokeStyle = "#fff4d6";
  g.lineWidth = 9;
  g.lineJoin = "round";
  g.lineCap = "round";
  for (const y of [58, 84]) {
    g.beginPath();
    g.moveTo(40, y + 10);
    g.lineTo(64, y - 14);
    g.lineTo(88, y + 10);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Ground warning on cells where a permanent wall is about to rise or is rising. */
export class WallTelegraph {
  readonly mesh: THREE.InstancedMesh;
  private texture = hazardTexture();
  private material = new THREE.MeshBasicMaterial({
    map: this.texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  private matrix = new THREE.Matrix4();
  private shown = "";

  constructor() {
    const geometry = new THREE.PlaneGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94).rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, CAPACITY);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /**
   * `landing` holds cells whose wall is mid-animation after the swap; planned cells come from the
   * snapshot before it. Returns true on the frame the first warning appears.
   */
  update(state: Readonly<GameSnapshot>, landing: ReadonlySet<number>, motion: number) {
    const planned = plannedCells(state);
    const reset = state.terrainReset;
    const lead = planned && reset ? reset.at - state.time : 0;
    const cells = planned && lead <= LEAD ? planned : landing.size ? [...landing] : undefined;
    if (!cells?.length) {
      this.mesh.visible = false;
      this.shown = "";
      return false;
    }
    const key = cells.join(",");
    const appeared = !this.shown;
    if (key !== this.shown) {
      this.shown = key;
      const size = state.size,
        count = Math.min(cells.length, CAPACITY);
      for (let i = 0; i < count; i++) {
        const cell = cells[i];
        this.matrix.makeTranslation(
          ((cell % size) - (size - 1) / 2) * TILE_SIZE,
          0.035,
          (Math.floor(cell / size) - (size - 1) / 2) * TILE_SIZE,
        );
        this.mesh.setMatrixAt(i, this.matrix);
      }
      this.mesh.count = count;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    this.mesh.visible = true;
    // The pulse quickens as the swap approaches; with motion off the warning holds steady.
    const urgency = planned ? 1 - THREE.MathUtils.clamp(lead / LEAD, 0, 1) : 1;
    const pulse = motion > 0 ? 0.5 + 0.5 * Math.sin(state.time * (9 + 14 * urgency)) : 1;
    this.material.opacity = 0.55 + 0.45 * pulse;
    return appeared;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
