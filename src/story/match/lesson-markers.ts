import * as THREE from "three";
import type { Vec2 } from "../../core/types";
import { TILE_SIZE, world } from "../../render/arena";

/** Flat lesson targets stay readable over scenery in the overhead view. */
export class LessonMarkers {
  private readonly root = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(TILE_SIZE * 0.84, TILE_SIZE * 0.84);
  private readonly edgeGeometry = new THREE.EdgesGeometry(this.geometry);
  private readonly fill = new THREE.MeshBasicMaterial({
    color: "#ffe387",
    transparent: true,
    opacity: 0.2,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  private readonly edge = new THREE.LineBasicMaterial({
    color: "#ffe387",
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  private disposed = false;

  constructor(parent: THREE.Object3D) {
    parent.add(this.root);
  }

  show(cells: readonly Vec2[], size: number, time: number) {
    if (this.disposed) return;
    while (this.root.children.length < cells.length) {
      const tile = new THREE.Group();
      const fill = new THREE.Mesh(this.geometry, this.fill);
      const edge = new THREE.LineSegments(this.edgeGeometry, this.edge);
      fill.renderOrder = 20;
      edge.renderOrder = 21;
      tile.add(fill, edge);
      tile.rotation.x = -Math.PI / 2;
      this.root.add(tile);
    }
    this.fill.opacity = 0.18 + 0.07 * Math.sin(time * 4);
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
    this.edgeGeometry.dispose();
    this.fill.dispose();
    this.edge.dispose();
  }
}
