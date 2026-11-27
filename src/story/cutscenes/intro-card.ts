import * as THREE from "three";
import { pick, playFilm, ramp, type Cutscene } from "./kit";

const LENGTH = 2.8;
const STREAKS = 60;

export interface IntroCard {
  /** Skin texture of whoever makes the entrance. */
  skin: string;
  title: string;
  note: string;
  /** Colour of the bands that sweep in behind them. */
  tint: string;
}

/**
 * A character's entrance, in the manner of a fighting game: slanted bands of their colour cut
 * across the screen, speed lines run through, they spin in and strike a pose beside their name.
 */
export function playIntroCard(canvas: HTMLCanvasElement, card: IntroCard): Cutscene {
  return playFilm(canvas, LENGTH, (kit) => {
    const { scene, camera } = kit;
    scene.background = new THREE.Color("#0b0a14");
    scene.add(new THREE.AmbientLight("#ffffff", 1.5));
    const key = new THREE.DirectionalLight("#ffffff", 1.6);
    key.position.set(-2, 3, 4);
    scene.add(key);
    camera.position.set(0, 0.2, 6);
    camera.lookAt(0, 0, 0);

    const tint = new THREE.Color(card.tint);
    const bands = [0, 1, 2].map((i) => {
      const band = kit.box([16, 1.5 - i * 0.35, 0.02], [0, 0, -2 - i * 0.1], "#ffffff", true);
      (band.material as THREE.MeshBasicMaterial).color.copy(tint).multiplyScalar(1 - i * 0.28);
      band.rotation.z = -0.22;
      return band;
    });
    const hero = kit.figure(card.skin);
    hero.group.scale.setScalar(1.25);
    const title = kit.label(card.title, 0.95, "#ffffff");
    const note = kit.label(card.note, 0.34, "#ffe9a8");
    const streaks = kit.swarm(STREAKS, "#ffffff", 1);
    const at = new THREE.Vector3();
    const wipe = kit.box([16, 10, 0.02], [0, 0, 3], "#0b0a14", true);

    return (t) => {
      const enter = ramp(0.15, 0.7, t),
        leave = ramp(LENGTH - 0.35, LENGTH, t);
      bands.forEach((band, i) => {
        const sweep = ramp(i * 0.06, 0.3 + i * 0.06, t);
        band.position.set((1 - sweep) * (i % 2 ? 18 : -18), -0.2 + (i - 1) * 1.15, band.position.z);
      });
      // In from the right on a spin, then a pose: one arm up, a small bounce that never quite stops.
      hero.group.position.set(1.9 + (1 - enter) * 7, -0.25 + Math.abs(Math.sin(t * 6)) * 0.06 * enter, 0);
      hero.group.rotation.y = -0.45 + (1 - enter) * Math.PI * 4;
      const { rightArm, leftArm, head } = hero.rig.skin;
      rightArm.rotation.set(0, 0, 0);
      rightArm.rotation.x = -2.6 * ramp(0.6, 0.85, t);
      leftArm.rotation.z = 0.35 * enter;
      head.rotation.z = 0.12 * Math.sin(t * 3) * enter;

      const slide = ramp(0.45, 0.8, t);
      title.position.set(-1.9 - (1 - slide) * 8, 0.15, 1);
      note.position.set(-1.9 - (1 - ramp(0.6, 0.95, t)) * 8, -0.6, 1);

      for (let i = 0; i < STREAKS; i++) {
        const u = (pick(i, 1) + t * (1.5 + pick(i, 2) * 2)) % 1;
        at.set(9 - u * 18, (pick(i, 3) - 0.5) * 7, -1 - pick(i, 4));
        streaks.place(i, at, 0.02 + 0.03 * pick(i, 5));
      }
      wipe.position.x = 16 - 16 * leave;
    };
  });
}
