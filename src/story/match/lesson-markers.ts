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

/**
 * Flat lesson targets: a bright frame with a dark rim around a pulsing fill, so that a cell stays
 * readable on pale road and grass alike, over scenery, and from straight above.
 */
export class LessonMarkers {
  private readonly root = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(SIDE - BORDER * 2, SIDE - BORDER * 2);
  private readonly frameGeometry = band(SIDE, BORDER);
  private readonly rimGeometry = band(SIDE + OUTLINE * 2, OUTLINE);
  private readonly fill: THREE.MeshBasicMaterial;
  private readonly frame: THREE.MeshBasicMaterial;
  private readonly rim: THREE.MeshBasicMaterial;
  private disposed = false;

  constructor(parent: THREE.Object3D, color = "#ffc400") {
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
      tile.add(fill, rim, frame);
      tile.rotation.x = -Math.PI / 2;
      this.root.add(tile);
    }
    this.fill.opacity = 0.42 + 0.18 * Math.sin(time * 4);
    this.root.children.forEach((tile, index) => {
      const cell = cells[index];
      tile.visible = !!cell;
      if (cell) tile.position.set(world(cell.x, size), 0.12, world(cell.z, size));
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    this.frameGeometry.dispose();
    this.rimGeometry.dispose();
    this.fill.dispose();
    this.frame.dispose();
    this.rim.dispose();
  }
}
