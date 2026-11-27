import * as THREE from "three";
import { TILE_SIZE } from "../../core/geometry";
import type { Vec2 } from "../../core/types";
import { scatter } from "./kit";

const PIXELS = 240;
const RADIUS = 1.5;
const TALL = 120;
const COLD = "#63e6ff";

/**
 * The light a new player comes down in, hung in the match's own world around the cell they land
 * on: a pale shaft from the sky, a ring where it meets the ground, and loose pixels falling with
 * them. It follows the newcomer's height, and goes out once they have landed.
 */
export class ArrivalShaft {
  private readonly root = new THREE.Group();
  private readonly shaft: THREE.MeshBasicMaterial;
  private readonly ring: THREE.MeshBasicMaterial;
  private readonly pixels: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private readonly owned: { dispose(): void }[] = [];
  private fadeFrom?: number;
  private readonly matrix = new THREE.Matrix4();
  private readonly place = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly size = new THREE.Vector3();

  constructor(parent: THREE.Object3D, cell: Vec2, mapSize: number) {
    const keep = <T extends { dispose(): void }>(item: T) => (this.owned.push(item), item);
    const glow = (opacity: number, side: THREE.Side) =>
      keep(
        new THREE.MeshBasicMaterial({
          color: COLD,
          transparent: true,
          opacity,
          side,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
        }),
      );
    this.shaft = glow(0.16, THREE.DoubleSide);
    const column = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(RADIUS, RADIUS, TALL, 28, 1, true)),
      this.shaft,
    );
    column.position.y = TALL / 2;
    this.ring = glow(0.7, THREE.DoubleSide);
    const mark = new THREE.Mesh(keep(new THREE.RingGeometry(RADIUS * 0.82, RADIUS, 40)), this.ring);
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.06;
    this.pixels = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.09, 0.09, 0.09)),
      keep(new THREE.MeshBasicMaterial({ color: "#bff8ff", fog: false, toneMapped: false })),
      PIXELS,
    );
    this.root.add(column, mark, this.pixels);
    for (const object of this.root.children) object.frustumCulled = false;
    const world = (value: number) => (value - (mapSize - 1) / 2) * TILE_SIZE;
    this.root.position.set(world(cell.x), 0, world(cell.z));
    parent.add(this.root);
  }

  /** Call once a frame: `now` is wall time in milliseconds, `height` how high the newcomer still is. */
  update(now: number, height: number) {
    const t = now / 1000;
    const out = this.fadeFrom === undefined ? 1 : Math.max(0, 1 - (now - this.fadeFrom) / 1400);
    this.shaft.opacity = 0.16 * out;
    this.ring.opacity = 0.7 * out * (0.8 + 0.2 * Math.sin(t * 9));
    for (let i = 0; i < PIXELS; i++) {
      const angle = scatter(i, 1) * Math.PI * 2 + t * 0.4,
        radius = RADIUS * (0.35 + 0.6 * scatter(i, 2));
      // Around the newcomer wherever they are on the way down, falling a little faster than they do.
      const y = height + 12 - ((t * (5 + 9 * scatter(i, 3)) + scatter(i, 4) * 26) % 26);
      this.place.set(Math.cos(angle) * radius, Math.max(0.05, y), Math.sin(angle) * radius);
      this.matrix.compose(this.place, this.turn, this.size.setScalar(out * (0.5 + scatter(i, 5))));
      this.pixels.setMatrixAt(i, this.matrix);
    }
    this.pixels.instanceMatrix.needsUpdate = true;
  }

  /** Lets the light go out over the next moment. */
  fade() {
    this.fadeFrom ??= performance.now();
  }

  dispose() {
    this.root.removeFromParent();
    for (const item of this.owned) item.dispose();
  }
}
