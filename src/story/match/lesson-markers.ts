import * as THREE from "three";
import type { Vec2 } from "../../core/types";
import { TILE_SIZE, world } from "../../render/arena";

const SIDE = TILE_SIZE * 0.9;
const BORDER = TILE_SIZE * 0.1;
const OUTLINE = TILE_SIZE * 0.035;

/** A square band of `width`, its outer edge `side` long. */
function band(side: number, width: number) {
  const half = side / 2,
    shape = new THREE.Shape(),
    hole = new THREE.Path();
  shape.moveTo(-half, -half).lineTo(half, -half).lineTo(half, half).lineTo(-half, half).closePath();
  const inner = half - width;
  hole.moveTo(-inner, -inner).lineTo(-inner, inner).lineTo(inner, inner).lineTo(inner, -inner).closePath();
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape);
}

/** Four corner brackets standing `gap` outside a square of `side`. */
function brackets(side: number, gap: number, arm: number, width: number) {
  const outer = side / 2 + gap,
    shapes: THREE.Shape[] = [];
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const x = sx * outer,
      z = sz * outer,
      shape = new THREE.Shape();
    shape
      .moveTo(x, z)
      .lineTo(x - sx * arm, z)
      .lineTo(x - sx * arm, z - sz * width)
      .lineTo(x - sx * width, z - sz * width)
      .lineTo(x - sx * width, z - sz * arm)
      .lineTo(x, z - sz * arm)
      .closePath();
    shapes.push(shape);
  }
  return new THREE.ShapeGeometry(shapes);
}

/** How long a mark takes to snap onto its cell, and the wait between one mark and the next, in ms. */
const SNAP_MS = 320;
const STAGGER_MS = 35;

/**
 * Flat lesson targets: a bright frame with a dark rim around a pulsing fill, so that a cell stays
 * readable on pale road and grass alike, over scenery, and from straight above. A new mark drops
 * in from oversize and settles with a small bounce, then its corner brackets keep breathing.
 */
export class LessonMarkers {
  private readonly root = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(SIDE - BORDER * 2, SIDE - BORDER * 2);
  private readonly frameGeometry = band(SIDE, BORDER);
  private readonly rimGeometry = band(SIDE + OUTLINE * 2, OUTLINE);
  private readonly bracketGeometry = brackets(SIDE, TILE_SIZE * 0.07, TILE_SIZE * 0.26, BORDER * 0.8);
  /** When each marked cell appeared, by `x,z`, on the page's clock: it runs under a conversation too. */
  private born = new Map<string, number>();
  private readonly fill: THREE.MeshBasicMaterial;
  private readonly frame: THREE.MeshBasicMaterial;
  private readonly rim: THREE.MeshBasicMaterial;
  private disposed = false;

  /** `onAppear` is called once for every batch of cells that were not marked the frame before. */
  constructor(
    parent: THREE.Object3D,
    color = "#ffc400",
    private readonly onAppear?: () => void,
  ) {
    const flat = {
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    } as const;
    this.fill = new THREE.MeshBasicMaterial({ ...flat, color, opacity: 0.4 });
    this.frame = new THREE.MeshBasicMaterial({ ...flat, color, opacity: 1 });
    this.rim = new THREE.MeshBasicMaterial({ ...flat, color: "#1b1405", opacity: 0.8 });
    parent.add(this.root);
  }

  show(cells: readonly Vec2[], size: number, time: number) {
    if (this.disposed) return;
    while (this.root.children.length < cells.length) {
      const tile = new THREE.Group();
      const fill = new THREE.Mesh(this.geometry, this.fill);
      const rim = new THREE.Mesh(this.rimGeometry, this.rim);
      const frame = new THREE.Mesh(this.frameGeometry, this.frame);
      fill.renderOrder = 20;
      rim.renderOrder = 21;
      frame.renderOrder = 22;
      const corners = new THREE.Mesh(this.bracketGeometry, this.frame);
      corners.renderOrder = 22;
      tile.add(fill, rim, frame, corners);
      tile.rotation.x = -Math.PI / 2;
      this.root.add(tile);
    }
    this.fill.opacity = 0.42 + 0.18 * Math.sin(time * 4);
    const now = performance.now(),
      born = new Map<string, number>();
    let fresh = 0;
    for (const cell of cells) {
      const key = `${cell.x},${cell.z}`;
      born.set(key, this.born.get(key) ?? now + fresh++ * STAGGER_MS);
    }
    this.born = born;
    if (fresh) this.onAppear?.();
    this.root.children.forEach((tile, index) => {
      const cell = cells[index];
      const age = cell ? (now - born.get(`${cell.x},${cell.z}`)!) / SNAP_MS : -1;
      tile.visible = age >= 0;
      if (!cell || age < 0) return;
      tile.position.set(world(cell.x, size), 0.12, world(cell.z, size));
      // Drops in from nearly twice its size, overshoots a little, and settles.
      const t = Math.min(1, age),
        settle = 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
      tile.scale.setScalar(1.9 - 0.9 * settle);
      tile.children[3].scale.setScalar(1 + 0.05 * Math.sin(now * 0.006));
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    this.frameGeometry.dispose();
    this.rimGeometry.dispose();
    this.bracketGeometry.dispose();
    this.fill.dispose();
    this.frame.dispose();
    this.rim.dispose();
  }
}
