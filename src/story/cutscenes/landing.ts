import * as THREE from "three";
import { STORY_SKINS } from "../assets";
import { pick, playFilm, ramp, type Cutscene } from "./kit";

const LENGTH = 5.4;
const SPARKS = 160;
/** When the fall ends on the map. */
const IMPACT = 3.5;

/** A sheet of ground as the overhead game shows it: grass, a street, walls and crates, all flat. */
function paperMap() {
  const cells = 15,
    px = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = cells * px;
  const context = canvas.getContext("2d")!;
  for (let z = 0; z < cells; z++)
    for (let x = 0; x < cells; x++) {
      const edge = !x || !z || x === cells - 1 || z === cells - 1;
      const roll = pick(x * 31 + z, 5);
      const street = x === 7 || z === 9;
      context.fillStyle = edge ? "#6f7480" : street ? "#b9ad8f" : (x + z) % 2 ? "#5fae54" : "#69b85d";
      context.fillRect(x * px, z * px, px, px);
      // Keep the middle clear: that is where he lands.
      if (edge || street || (Math.abs(x - 7) < 3 && Math.abs(z - 7) < 3)) continue;
      if (roll < 0.16) {
        context.fillStyle = "#8a5a2b";
        context.fillRect(x * px + 2, z * px + 2, px - 4, px - 4);
        context.strokeStyle = "#5b3a1a";
        context.strokeRect(x * px + 2.5, z * px + 2.5, px - 5, px - 5);
      } else if (roll < 0.26) {
        context.fillStyle = "#8d919c";
        context.fillRect(x * px + 1, z * px + 1, px - 2, px - 2);
      }
    }
  return canvas;
}

/**
 * The start of act 3: Zero falls out of the screen's light, the ground of Flatland comes up at
 * him, and on landing he is pressed as flat as everything else there.
 */
export function playLanding(canvas: HTMLCanvasElement): Cutscene {
  return playFilm(canvas, LENGTH, (kit) => {
    const { scene, camera } = kit;
    scene.background = new THREE.Color("#05040b");
    scene.add(new THREE.AmbientLight("#ffffff", 1.4));
    const sun = new THREE.DirectionalLight("#ffffff", 1.2);
    sun.position.set(2, 6, 3);
    scene.add(sun);

    const texture = kit.keep(new THREE.CanvasTexture(paperMap()));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    const ground = new THREE.Mesh(
      kit.keep(new THREE.PlaneGeometry(30, 30)),
      kit.keep(new THREE.MeshBasicMaterial({ map: texture })),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const zero = kit.figure(STORY_SKINS["story-zero"]);
    const sparks = kit.swarm(SPARKS, "#9af3ff", 0.12);
    const seeds = Array.from({ length: SPARKS }, (_, i) => ({
      angle: pick(i, 1) * Math.PI * 2,
      radius: 1.2 + pick(i, 2) * 3.2,
      phase: pick(i, 3),
      speed: 0.5 + pick(i, 4) * 0.9,
    }));
    const flash = new THREE.Mesh(
      kit.keep(new THREE.PlaneGeometry(4, 4)),
      kit.keep(
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthTest: false }),
      ),
    );
    flash.position.z = -0.5;
    flash.renderOrder = 10;
    camera.add(flash);
    const at = new THREE.Vector3();

    return (t) => {
      const fall = Math.min(1, t / IMPACT),
        landed = t >= IMPACT,
        // Height above the map: a long drop that ends abruptly.
        height = landed ? 0 : 60 * (1 - fall) ** 1.6 + 0.02,
        squash = ramp(IMPACT, IMPACT + 0.12, t),
        settle = ramp(IMPACT + 0.3, LENGTH - 0.4, t);

      // He tumbles on the way down and ends on his back, then loses his third dimension.
      const { leftArm, rightArm, leftLeg, rightLeg } = zero.rig.skin;
      const flail = landed ? 0 : 1;
      leftArm.rotation.set(Math.sin(t * 15) * 0.9 * flail, 0, 1.2);
      rightArm.rotation.set(-Math.sin(t * 15) * 0.9 * flail, 0, -1.2);
      leftLeg.rotation.x = Math.sin(t * 12) * 0.7 * flail;
      rightLeg.rotation.x = -Math.sin(t * 12) * 0.7 * flail;
      zero.rig.rotation.set(-Math.PI / 2, 0, landed ? 0 : t * 2.4);
      zero.group.position.set(0, height + 0.26 * (1 - squash), 0);
      zero.group.scale.set(1 + 0.25 * squash, 1 - 0.97 * squash, 1 + 0.25 * squash);

      // The light he fell through thins out as the ground comes up.
      const thin = 1 - ramp(IMPACT - 1.2, IMPACT, t);
      for (let i = 0; i < SPARKS; i++) {
        const seed = seeds[i];
        const u = (seed.phase + t * seed.speed) % 1;
        const angle = seed.angle + u * 2;
        at.set(Math.cos(angle) * seed.radius, height - 8 + u * 22, Math.sin(angle) * seed.radius);
        sparks.place(i, at, i / SPARKS < thin ? 0.6 + u : 0);
      }
      (scene.background as THREE.Color)
        .set("#05040b")
        .lerp(new THREE.Color("#7fd0ff"), ramp(1.2, IMPACT, t) * 0.9);
      (flash.material as THREE.MeshBasicMaterial).opacity =
        ramp(IMPACT - 0.03, IMPACT + 0.05, t) - ramp(IMPACT + 0.1, IMPACT + 0.6, t);

      // Beside him during the fall; straight overhead once he is part of the floor.
      const shake = landed ? 0.25 * (1 - ramp(IMPACT, IMPACT + 0.5, t)) : 0.03;
      const side = 1 - settle;
      camera.position.set(
        4.5 * side + Math.sin(t * 40) * shake,
        height + 3.5 + 7 * settle + Math.cos(t * 43) * shake,
        5.5 * side + 0.01,
      );
      camera.up.set(0, side > 0.02 ? 1 : 0, side > 0.02 ? 0 : -1);
      camera.lookAt(0, height, 0);
    };
  });
}
