import * as THREE from "three";
import { STORY_ART } from "../assets";
import { pick, playFilm, ramp, type Cutscene } from "./kit";

/** Where the two of them keep their eyes. */
const EYE_LEVEL = 1.74;
const ZERO_X = -1.6,
  PLUSH_X = 1.6;
const PILLAR = 1.1;
/** The cuts, in seconds. */
const CUT = { zero: 1.7, plush: 2.8, zeroEyes: 3.9, plushEyes: 4.6, frenzy: 5.3, apart: 6.3, end: 9 };
const FLAKES = 48;

/**
 * Zero and the plush on his bed look at each other, shot as a duel: a wide, the two faces, the
 * two pairs of eyes, faster and tighter, and then a slow turn around both while nothing happens,
 * until the plush falls on its face. It is played the first time the plush is examined.
 */
export function playStare(canvas: HTMLCanvasElement): Cutscene {
  return playFilm(canvas, CUT.end, (kit) => {
    const { scene, camera } = kit;
    scene.background = new THREE.Color("#07060d");
    scene.add(new THREE.AmbientLight("#8d7fc4", 0.55));
    const spot = new THREE.PointLight("#fff1d6", 46, 12);
    spot.position.set(0, 5, 1.5);
    scene.add(spot);
    const rim = new THREE.PointLight("#6ab7ee", 14, 6);
    rim.position.set(PLUSH_X + 1.2, 2.4, -1.2);
    scene.add(rim);
    kit.box([9, 0.1, 5], [0, -0.05, 0], "#2a2338");

    const zero = kit.figure(STORY_ART.zeroSkin);
    zero.group.position.set(ZERO_X, 1, 0);
    zero.group.rotation.y = Math.PI / 2;
    const tear = kit.box([0.035, 0.07, 0.035], [0, 0, 0], "#bfe6ff", true);

    // A plinth, so that a thing thirty centimetres tall can look him in the eye.
    kit.box([0.5, PILLAR, 0.5], [PLUSH_X, PILLAR / 2, 0], "#3a3350");
    const stand = new THREE.Group(),
      plush = new THREE.Group();
    stand.position.set(PLUSH_X, PILLAR, 0);
    stand.rotation.y = -Math.PI / 2;
    stand.add(plush);
    scene.add(stand);
    const part = (
      size: [number, number, number],
      at: [number, number, number],
      color: string,
      glow = false,
    ) => plush.add(kit.box(size, at, color, glow));
    part([0.4, 0.4, 0.3], [0, 0.2, 0], "#3b6fd6");
    part([0.16, 0.16, 0.14], [-0.16, 0.06, 0.16], "#f6d6c0");
    part([0.16, 0.16, 0.14], [0.16, 0.06, 0.16], "#f6d6c0");
    part([0.5, 0.44, 0.44], [0, 0.62, 0], "#f6d6c0");
    part([0.56, 0.26, 0.5], [0, 0.8, -0.01], "#6ab7ee");
    part([0.56, 0.4, 0.14], [0, 0.6, -0.2], "#6ab7ee");
    part([0.2, 0.18, 0.08], [-0.17, 0.98, -0.06], "#2a57c8");
    part([0.2, 0.18, 0.08], [0.17, 0.98, -0.06], "#2a57c8");
    for (const side of [-1, 1]) {
      part([0.07, 0.11, 0.02], [side * 0.11, 0.62, 0.225], "#17131f", true);
      for (let blade = 0; blade < 3; blade++)
        part([0.07, 0.3, 0.04], [side * (0.3 + blade * 0.1), 0.42 + blade * 0.12, -0.2], "#c9f1ff", true);
    }

    const snow = kit.swarm(FLAKES, "#dff1ff", 0.035);
    const at = new THREE.Vector3();
    const shot = (from: [number, number, number], to: [number, number, number], fov: number) => {
      camera.position.set(...from);
      camera.lookAt(...to);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    };
    /** His face and the plush's, from just off the line between them. */
    const onZero = (fov: number, drift: number) =>
      shot([-0.2 - drift, EYE_LEVEL + 0.02, 0.55], [ZERO_X + 0.25, EYE_LEVEL, 0], fov);
    const onPlush = (fov: number) => shot([0.2, EYE_LEVEL, 0.5], [PLUSH_X - 0.22, EYE_LEVEL, 0], fov);

    return (t) => {
      for (let i = 0; i < FLAKES; i++)
        snow.place(
          i,
          at.set(
            (pick(i, 2) - 0.5) * 7 + Math.sin(t * 0.8 + i) * 0.1,
            4 - ((t * 0.45 + pick(i, 1) * 4) % 4),
            (pick(i, 3) - 0.5) * 3,
          ),
          1,
        );
      // He breathes. It does not.
      zero.rig.skin.head.rotation.x = Math.sin(t * 1.3) * 0.02;

      if (t < CUT.zero) shot([0, 1.6, 7.2 - 1.6 * ramp(0, CUT.zero, t)], [0, 1.3, 0], 48);
      else if (t < CUT.plush) onZero(30, 0.15 * ramp(CUT.zero, CUT.plush, t));
      else if (t < CUT.zeroEyes) onPlush(30);
      else if (t < CUT.plushEyes) onZero(13, 0);
      else if (t < CUT.frenzy) onPlush(13);
      else if (t < CUT.apart) {
        // Faster and tighter, and still nobody has blinked.
        const beat = Math.floor((t - CUT.frenzy) / 0.125);
        const fov = 12 - 7 * ramp(CUT.frenzy, CUT.apart, t);
        if (beat % 2) onPlush(fov);
        else onZero(fov, 0);
      } else {
        const turn = -0.55 + 1.1 * ramp(CUT.apart, CUT.end, t);
        shot([Math.sin(turn) * 5.2, 1.7, Math.cos(turn) * 5.2], [0, 1.25, 0], 40);
      }

      // One tear, on the cheek the camera can see.
      const fall = ramp(CUT.apart + 0.3, CUT.apart + 1.5, t);
      tear.visible = t > CUT.apart + 0.3 && fall < 1;
      tear.position.set(ZERO_X + 0.26, EYE_LEVEL - 0.06 - 0.3 * fall, 0.12);
      // Then the plush loses, face first.
      const tip = ramp(CUT.apart + 1.2, CUT.apart + 1.75, t);
      plush.rotation.x = (tip * tip * Math.PI) / 2;
    };
  });
}
