import * as THREE from "three";
import type { Vec2 } from "../../core/types";
import { TILE_SIZE, world } from "../../render/arena";

const BEAM_HEIGHT = 7;

/**
 * The one cell a lesson wants the hero to stand on: a pulsing ring on the ground and a column of
 * light over it, drawn through scenery so it can be found from across the village.
 */
export class SpotBeacon {
  private readonly root = new THREE.Group();
  private readonly ring = new THREE.Mesh(
    new THREE.RingGeometry(TILE_SIZE * 0.28, TILE_SIZE * 0.42, 40),
    new THREE.MeshBasicMaterial({
      color: "#ffc400",
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  private readonly pad = new THREE.Mesh(
    new THREE.CircleGeometry(TILE_SIZE * 0.28, 40),
    new THREE.MeshBasicMaterial({
      color: "#ffc400",
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  /** A dark rim around the ring keeps it legible on pale ground. */
  private readonly rim = new THREE.Mesh(
    new THREE.RingGeometry(TILE_SIZE * 0.42, TILE_SIZE * 0.46, 40),
    new THREE.MeshBasicMaterial({
      color: "#1b1405",
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  private readonly fade: THREE.CanvasTexture;
  private readonly beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private disposed = false;

  constructor(parent: THREE.Object3D) {
    // The column is brightest at the ground and gone at its top.
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 64;
    const ink = canvas.getContext("2d")!;
    const gradient = ink.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(1, "rgba(255,255,255,1)");
    ink.fillStyle = gradient;
    ink.fillRect(0, 0, 2, 64);
    this.fade = new THREE.CanvasTexture(canvas);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(TILE_SIZE * 0.3, TILE_SIZE * 0.3, BEAM_HEIGHT, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ffc400",
        map: this.fade,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    this.ring.rotation.x = this.pad.rotation.x = this.rim.rotation.x = -Math.PI / 2;
    this.ring.position.y = this.pad.position.y = this.rim.position.y = 0.12;
    this.beam.position.y = BEAM_HEIGHT / 2 + 0.12;
    this.pad.renderOrder = 20;
    this.ring.renderOrder = 21;
    this.beam.renderOrder = 22;
    this.rim.renderOrder = 21;
    this.root.add(this.pad, this.rim, this.ring, this.beam);
    this.root.visible = false;
    parent.add(this.root);
  }

  /** Stands the beacon on `cell`, or hides it when there is none. Call once a frame. */
  show(cell: Vec2 | undefined, size: number, time: number) {
    if (this.disposed) return;
    this.root.visible = !!cell;
    if (!cell) return;
    this.root.position.set(world(cell.x, size), 0, world(cell.z, size));
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    this.ring.scale.setScalar(1 + 0.1 * pulse);
    this.rim.scale.copy(this.ring.scale);
    this.pad.material.opacity = 0.35 + 0.25 * pulse;
    this.beam.material.opacity = 0.55 + 0.3 * pulse;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const mesh of [this.ring, this.pad, this.rim, this.beam]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.fade.dispose();
  }
}
