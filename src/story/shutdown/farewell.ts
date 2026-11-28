import * as THREE from "three";
import type { Vec2 } from "../../core/types";
import { world } from "../../render/arena";
import type { StagedShot } from "../../render/camera-rig";
import type { Director } from "../match/director";
import { scatter } from "./kit";

/** The four pictures of the goodbye, in the order they are shown. */
export type FarewellCut = "faces" | "sky" | "village" | "ribbon";

const MOTES = 360;
const FOV = 50;
/** Seconds each picture takes to finish its one slow move; it holds its last frame after that. */
const MOVE = { faces: 24, sky: 20, village: 26, ribbon: 14 };
/** The flight over the village, in cells: the arrival corner, the dojo, the shop, the graves. */
const FLIGHT: readonly Vec2[] = [
  { x: 2, z: 1.5 },
  { x: 10.5, z: 4.5 },
  { x: 4, z: 9.5 },
  { x: 10, z: 12 },
];
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The goodbye before the choice, shot in the village itself: the two of them stand at the edge
 * of the plaza under the last sky, and the camera is the story's, not his. It has four pictures
 * (`cut`), each a single slow move: their faces; their backs and the sky over the gate; the
 * village from above while it comes apart into pixels; and the bandage he lets go of, going up.
 * `update` is to be called once a frame; the match's closing takes the props down.
 */
export function playFarewell(d: Director, hero: Vec2, lulu: Vec2) {
  const { match } = d,
    size = d.state.size;
  const at = (cell: Vec2, y: number) => new THREE.Vector3(world(cell.x, size), y, world(cell.z, size));
  const pair = at({ x: (hero.x + lulu.x) / 2, z: (hero.z + lulu.z) / 2 }, 0);
  const flight = new THREE.CatmullRomCurve3(FLIGHT.map((cell) => at(cell, 9)));
  const root = new THREE.Group();
  match.scene.add(root);

  // What the world comes apart into: small squares of light, let go of by the ground.
  const moteShape = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const moteLook = new THREE.MeshBasicMaterial({
    color: "#c9f7ff",
    transparent: true,
    opacity: 0,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  });
  const motes = new THREE.InstancedMesh(moteShape, moteLook, MOTES);
  motes.frustumCulled = false;
  root.add(motes);
  const half = world(size - 1, size);
  const pose = new THREE.Object3D();

  // The bandage: two short strips, one trailing the other.
  const stripShape = new THREE.BoxGeometry(0.5, 0.09, 0.012);
  const stripLook = new THREE.MeshBasicMaterial({ color: "#f6f1e4", fog: false, side: THREE.DoubleSide });
  const ribbon = new THREE.Group();
  const tail = new THREE.Mesh(stripShape, stripLook);
  tail.position.x = 0.48;
  ribbon.add(new THREE.Mesh(stripShape, stripLook), tail);
  ribbon.visible = false;
  root.add(ribbon);
  const hand = at(hero, 1).add(new THREE.Vector3(0.4, 0, 0));

  let cut: FarewellCut = "faces",
    since = performance.now(),
    dissolving = 0,
    released = 0;
  const aim = new THREE.Vector3();
  const shot: StagedShot = {
    showSelf: true,
    pose(camera) {
      const t = (performance.now() - since) / 1000,
        k = ease(Math.min(1, t / MOVE[cut]));
      if (cut === "faces") {
        // From the well's side, a little to their left, closing in.
        camera.position.set(pair.x + 0.55, 1.5, pair.z - 2.2 + 0.3 * k);
        aim.set(pair.x, 1.42, pair.z);
      } else if (cut === "sky") {
        // Low behind them: two backs, the gate, and most of the frame is sky.
        camera.position.set(pair.x + 0.8, 0.85, pair.z + 3.6 - 0.7 * k);
        aim.set(pair.x, 4.4 + 1.6 * k, pair.z - 14);
      } else if (cut === "village") {
        flight.getPoint(k * 0.86, camera.position);
        flight.getPoint(k * 0.86 + 0.14, aim);
        aim.y = 0.6;
      } else {
        // Beside him, turning up after the strip of cloth as the wind takes it.
        camera.position.set(pair.x + 1.9, 1.15, pair.z + 2.4);
        aim.copy(ribbon.position);
      }
      camera.lookAt(aim);
      camera.fov = FOV;
      camera.updateProjectionMatrix();
      return true;
    },
  };
  match.renderer.stagedShot = shot;

  return {
    /** Changes the picture; do it under a fade. */
    cut(next: FarewellCut) {
      cut = next;
      since = performance.now();
      if (next === "village" && !dissolving) dissolving = since;
      if (next === "ribbon" && !released) released = since;
    },
    update(now: number) {
      if (dissolving) {
        const t = (now - dissolving) / 1000;
        moteLook.opacity = Math.min(0.9, t * 0.3);
        for (let i = 0; i < MOTES; i++) {
          const life = (t * (0.05 + scatter(i, 1) * 0.08) + scatter(i, 2)) % 1;
          pose.position.set((scatter(i, 3) * 2 - 1) * half, life * 10, (scatter(i, 4) * 2 - 1) * half);
          pose.scale.setScalar(0.4 + (1 - life) * 1.2);
          pose.rotation.set(0, 0, 0);
          pose.updateMatrix();
          motes.setMatrixAt(i, pose.matrix);
        }
        motes.instanceMatrix.needsUpdate = true;
      }
      if (released) {
        const t = (now - released) / 1000;
        ribbon.visible = true;
        ribbon.position.set(
          hand.x + Math.sin(t * 1.3) * 0.45,
          hand.y + 0.25 * t ** 1.5,
          hand.z - 0.55 * t + Math.sin(t * 0.9) * 0.3,
        );
        ribbon.rotation.set(Math.sin(t * 2.3) * 0.8, t * 1.1, Math.sin(t * 1.7) * 0.6);
        tail.rotation.z = Math.sin(t * 4.1) * 0.7;
      }
    },
    dispose() {
      root.removeFromParent();
      moteShape.dispose();
      moteLook.dispose();
      stripShape.dispose();
      stripLook.dispose();
    },
  };
}
