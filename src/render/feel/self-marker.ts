import * as THREE from "three";
import { TILE_SIZE } from "../../core/geometry";
import type { Player } from "../../core/types";

const overlay = (color: THREE.ColorRepresentation) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    // Drawn over cover and actors so the marker is never hidden in the board view.
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

/** Flat triangle in the ground plane with its apex towards +Z, which is down the screen in the board view. */
function triangle(halfWidth: number, length: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(0, -length);
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

/**
 * Marks the locally controlled actor in the top-down tactical view with a small triangle that
 * hovers just above the character on screen and points down at it, in the player's colour.
 */
export class SelfMarker {
  readonly root = new THREE.Group();
  private pointer = new THREE.Group();
  private fill = overlay("#ffffff");
  private rim = overlay("#ffffff");
  private shade = overlay("#0d1114");
  private materials = [this.fill, this.rim, this.shade];
  private color = "";

  constructor() {
    const r = TILE_SIZE * 0.5;
    // Dark keyline, white rim, colour core: readable on pale and dark floors alike.
    const layers: [THREE.Material, number, number, number][] = [
      [this.shade, 0.56, 0.74, -0.1],
      [this.rim, 0.46, 0.6, -0.04],
      [this.fill, 0.32, 0.4, 0.02],
    ];
    layers.forEach(([material, halfWidth, length, inset], index) => {
      const mesh = new THREE.Mesh(triangle(r * halfWidth, r * length), material);
      mesh.position.z = r * inset;
      mesh.renderOrder = 30 + index;
      this.pointer.add(mesh);
    });
    this.root.add(this.pointer);
    this.root.visible = false;
  }

  /** `blend` is the first-person to board transition, 0 to 1. Positions are world units. */
  update(you: Readonly<Player>, x: number, z: number, blend: number, wallTime: number, motion: number) {
    const shown = you.alive && blend > 0.35;
    this.root.visible = shown;
    if (!shown) return;
    if (this.color !== you.color) {
      this.color = you.color;
      this.fill.color.set(you.color);
    }
    const fade = THREE.MathUtils.smoothstep(blend, 0.35, 0.9);
    this.fill.opacity = this.rim.opacity = fade;
    this.shade.opacity = 0.75 * fade;
    this.root.position.set(x, 2.3 + you.elevation, z);
    // A slight bounce towards the character; -Z is up the screen in the board view.
    const bounce = motion > 0 ? Math.abs(Math.sin(wallTime * 3.2)) * 0.22 : 0;
    this.pointer.position.z = -TILE_SIZE * 0.5 - bounce;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const material of this.materials) material.dispose();
  }
}
