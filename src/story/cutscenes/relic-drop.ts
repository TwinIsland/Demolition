import * as THREE from "three";
import { STORY_ART } from "../assets";
import type { StoryCue } from "../stage";
import { pick, playFilm, ramp, type Cutscene } from "./kit";

const LENGTH = 5.6;
/** When the model gives way to the item as the inventory will show it. */
const REVEAL = 3.9;
const MOTES = 90;
/** When it first touches the ground. */
const TOUCH = 1.3;
/** The film's sound, by the moment each thing in the picture happens. The bounce is a seventh of a turn of `sin` long. */
const SOUNDS: readonly (readonly [number, StoryCue])[] = [
  [0, "relicFall"],
  [TOUCH, "relicLand"],
  [TOUCH + Math.PI / 7, "relicBounce"],
  [TOUCH + 0.9, "relicRise"],
  [REVEAL, "relicReveal"],
];

/**
 * The reward of act 3: the Ascension Striker falls onto the flat world. Everything about it is
 * as flat as the place it lands in, except the arrow on its button, which points up and means it.
 * `cue` is called once for each sound as the film reaches it, so a paused film stays in step.
 */
export function playRelicDrop(canvas: HTMLCanvasElement, cue: (name: StoryCue) => void): Cutscene {
  return playFilm(canvas, LENGTH, (kit) => {
    const { scene, camera } = kit;
    scene.background = new THREE.Color("#07060f");
    scene.add(new THREE.AmbientLight("#8a7ad0", 0.7));
    const glow = new THREE.PointLight("#63e6ff", 0, 12, 1.4);
    glow.position.set(0, 1.4, 0.6);
    scene.add(glow);
    kit.box([14, 0.1, 14], [0, -0.05, 0], "#2b2440");
    // Flat grass tiles, to say where this is.
    for (let i = 0; i < 36; i++)
      kit.box(
        [0.96, 0.02, 0.96],
        [(i % 6) - 2.5, 0.01, Math.floor(i / 6) - 2.5],
        (i + Math.floor(i / 6)) % 2 ? "#3f6a45" : "#467550",
      );

    const relic = new THREE.Group();
    scene.add(relic);
    const part = (
      size: [number, number, number],
      at: [number, number, number],
      color: string,
      lit = false,
    ) => {
      const mesh = kit.box(size, at, color, lit);
      relic.add(mesh);
      return mesh;
    };
    part([0.7, 0.16, 1.2], [0, 0, 0], "#4b2a86");
    part([0.6, 0.04, 1.1], [0, 0.1, 0], "#6a3fb8");
    part([0.36, 0.08, 0.36], [0, 0.15, 0.15], "#63e6ff", true);
    part([0.12, 0.03, 0.2], [-0.16, 0.13, -0.35], "#2b174f");
    part([0.12, 0.03, 0.2], [0.16, 0.13, -0.35], "#2b174f");
    // The arrow: a shaft and a head that stand up out of the button.
    const arrow = [
      part([0.08, 0.34, 0.08], [0, 0.36, 0.15], "#eaffff", true),
      part([0.26, 0.08, 0.08], [0, 0.5, 0.15], "#eaffff", true),
      part([0.14, 0.08, 0.08], [0, 0.58, 0.15], "#eaffff", true),
    ];
    const shaft = kit.box([0.9, 9, 0.9], [0, 4.5, 0], "#63e6ff", true);
    const beam = shaft.material as THREE.MeshBasicMaterial;
    beam.transparent = true;
    beam.blending = THREE.AdditiveBlending;
    beam.depthWrite = false;
    const motes = kit.swarm(MOTES, "#9af3ff", 0.06);
    const picture = kit.keep(new THREE.TextureLoader().load(STORY_ART.relic));
    picture.colorSpace = THREE.SRGBColorSpace;
    picture.magFilter = picture.minFilter = THREE.NearestFilter;
    const icon = new THREE.Mesh(
      kit.keep(new THREE.PlaneGeometry(1, 1)),
      kit.keep(new THREE.MeshBasicMaterial({ map: picture, transparent: true, depthTest: false })),
    );
    icon.renderOrder = 6;
    icon.position.set(0, 0, -3);
    camera.add(icon);
    const name = kit.label("升维打击器", 0.3, "#eaffff");
    camera.add(name);
    name.position.set(0, -0.95, -3);
    const at = new THREE.Vector3();
    let heard = 0;

    return (t) => {
      while (heard < SOUNDS.length && t >= SOUNDS[heard][0]) cue(SOUNDS[heard++][1]);
      // Down fast, two bounces, then it lifts a little and turns in its own light.
      const drop = Math.min(1, t / TOUCH) ** 2;
      const bounce = t < TOUCH ? 0 : Math.abs(Math.sin((t - TOUCH) * 7)) * 0.7 * Math.exp(-(t - TOUCH) * 3.2);
      const lift = ramp(TOUCH + 0.9, TOUCH + 2, t);
      relic.position.y = 9 * (1 - drop) + 0.1 + bounce + lift * (0.9 + Math.sin(t * 2.4) * 0.06);
      relic.rotation.set((1 - drop) * 6 + lift * 0.5, t * (1.2 + (1 - drop) * 6), (1 - drop) * 3);
      const rise = ramp(TOUCH + 1.2, TOUCH + 2.1, t);
      arrow.forEach((piece) => piece.scale.set(1, Math.max(0.05, rise), 1));
      beam.opacity = 0.22 * lift + 0.05 * Math.sin(t * 20) * lift;
      shaft.scale.set(0.6 + 0.4 * lift, 1, 0.6 + 0.4 * lift);
      glow.intensity = 14 * lift + (t > TOUCH ? 6 * Math.exp(-(t - TOUCH) * 4) : 0);

      for (let i = 0; i < MOTES; i++) {
        const u = (pick(i, 1) + t * (0.2 + pick(i, 2) * 0.5)) % 1;
        const angle = pick(i, 3) * Math.PI * 2 + t * 0.8;
        const radius = 0.3 + pick(i, 4) * 1.4;
        at.set(Math.cos(angle) * radius, u * 4.5, Math.sin(angle) * radius);
        motes.place(i, at, i / MOTES < lift ? 1 - u : 0);
      }
      // The item card: the picture pops in front of the model, with its name under it.
      const reveal = ramp(REVEAL, REVEAL + 0.25, t);
      icon.scale.setScalar(reveal ? 1.5 * (1 + 0.25 * Math.sin(Math.PI * reveal)) : 0.001);
      name.visible = t > REVEAL + 0.3;
      relic.visible = reveal < 1;
      const shake = t > TOUCH ? 0.12 * Math.exp(-(t - TOUCH) * 6) : 0;
      const orbit = 0.5 + t * 0.18;
      camera.position.set(
        Math.sin(orbit) * 3.6,
        1.7 + lift * 0.4 + Math.sin(t * 50) * shake,
        Math.cos(orbit) * 3.6,
      );
      camera.lookAt(0, 0.4 + lift * 0.7, 0);
    };
  });
}
