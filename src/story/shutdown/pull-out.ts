import * as THREE from "three";
import { STORY_SKINS } from "../assets";
import { VIEW } from "../script";
import { film, ramp, scatter, type Film } from "./kit";

const LENGTH = 8.2;
const SPARKS = 150;
/** Centre of the monitor's screen, and where he comes to rest on the floor in front of it. */
const SCREEN = new THREE.Vector3(0, 2.1, -2.34);
const AIR = new THREE.Vector3(0.1, 2.5, -0.4);
const FLOOR = new THREE.Vector3(0.2, 0.42, 0.1);
const GLOW = new THREE.Color("#63e6ff");
const DAWN = new THREE.Color("#ffcf8a");

/**
 * The "go back" ending's way out: act 2's fall into the screen, run the other way. The same dark
 * room, drawn as small as the 8-bit acts; the screen lights, throws him out onto the floor and
 * dies; and then, for the first time in the story, daylight comes in through the curtains.
 */
export function playPullOut(canvas: HTMLCanvasElement): Film {
  return film(canvas, VIEW, (shot) => {
    const { scene, camera, keep } = shot;
    scene.background = new THREE.Color("#05040b");
    camera.fov = 48;

    // The room of pull-in.ts: floor, back wall, desk, the monitor with its tower.
    shot.box([14, 0.2, 14], [0, -0.1, -1], "#2b2440");
    shot.box([14, 8, 0.2], [0, 4, -4.2], "#3a3158");
    shot.box([0.2, 8, 14], [-5.2, 4, -1], "#342c50");
    shot.box([3.6, 0.16, 1.7], [0, 1.3, -3.1], "#5b4636");
    shot.box([0.16, 1.3, 1.5], [-1.6, 0.65, -3.1], "#4a392c");
    shot.box([0.16, 1.3, 1.5], [1.6, 0.65, -3.1], "#4a392c");
    shot.box([1.7, 1.4, 1.5], [0, 2.1, -3.1], "#b9b29c");
    shot.box([0.5, 1.2, 1.3], [1.35, 1.98, -3.2], "#a8a18c");
    shot.box([1.5, 0.06, 0.5], [0, 1.41, -2.0], "#d9d3bf");
    const glass = keep(new THREE.MeshBasicMaterial({ color: GLOW }));
    const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.34, 1.02)), glass);
    screen.position.copy(SCREEN);
    scene.add(screen);
    // The window on the side wall: two curtains, and what is between them once they part.
    const curtains = [-1, 1].map((side) =>
      shot.box([0.12, 3.4, 1.5], [-5.05, 3.3, -1 + side * 0.75], "#241d3c"),
    );
    const daylight = keep(new THREE.MeshBasicMaterial({ color: DAWN, transparent: true, opacity: 0 }));
    const pane = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.8, 3.2)), daylight);
    pane.position.set(-5.08, 3.3, -1);
    pane.rotation.y = Math.PI / 2;
    scene.add(pane);
    const patchMaterial = keep(
      new THREE.MeshBasicMaterial({
        color: DAWN,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      }),
    );
    const patch = new THREE.Mesh(keep(new THREE.PlaneGeometry(5.5, 2.4)), patchMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(-1.6, 0.02, -0.4);
    scene.add(patch);

    const ambient = new THREE.AmbientLight("#5a4a9a", 0.9);
    const fill = new THREE.DirectionalLight("#8a6cff", 1.1);
    fill.position.set(3, 4, 4);
    const sun = new THREE.DirectionalLight(DAWN, 0);
    sun.position.set(-6, 4, -1);
    const glow = new THREE.PointLight(GLOW, 0, 14, 1.4);
    glow.position.copy(SCREEN).add(new THREE.Vector3(0, 0, 0.5));
    scene.add(ambient, fill, sun, glow);

    // He spins around the middle of his body, so the rig sits on the root's origin here.
    const zero = shot.figure(STORY_SKINS["story-zero"]);
    zero.rig.position.y = 0;

    const sparkMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.07, 0.07, 0.07)),
      keep(new THREE.MeshBasicMaterial({ color: "#9af3ff" })),
      SPARKS,
    );
    sparkMesh.frustumCulled = false;
    scene.add(sparkMesh);
    const sparks = Array.from({ length: SPARKS }, (_, i) => ({
      angle: scatter(i, 1) * Math.PI * 2,
      radius: 0.5 + scatter(i, 2) * 2.4,
      phase: scatter(i, 3),
      speed: 0.35 + scatter(i, 4) * 0.5,
    }));

    const flashMaterial = keep(
      new THREE.MeshBasicMaterial({ color: "#fff6e0", transparent: true, opacity: 1, depthTest: false }),
    );
    const flash = new THREE.Mesh(keep(new THREE.PlaneGeometry(4, 4)), flashMaterial);
    flash.position.z = -0.5;
    flash.renderOrder = 10;
    camera.add(flash);

    const matrix = new THREE.Matrix4(),
      place = new THREE.Vector3(),
      turn = new THREE.Quaternion(),
      size = new THREE.Vector3(),
      look = new THREE.Vector3(),
      tint = new THREE.Color();
    return (t) => {
      const lit = ramp(0.2, 0.9, t),
        out = ramp(1.2, 2.5, t),
        drop = ramp(2.5, 3.1, t) ** 2,
        off = ramp(3.3, 3.6, t),
        rise = ramp(4.3, 5.4, t),
        dawn = ramp(5.2, 7.4, t);

      // Out of the screen along a widening spiral, up into the room, then down flat on his back.
      const swirl = Math.sin(Math.PI * out) * 0.5;
      zero.root.position.copy(SCREEN).lerp(AIR, out).lerp(FLOOR, drop);
      zero.root.position.x += Math.cos(t * 9) * swirl;
      zero.root.position.y +=
        Math.sin(t * 9) * swirl + Math.sin(Math.PI * ramp(3.1, 3.5, t)) * 0.18 + rise * 0.02;
      zero.root.rotation.set(-1.45 * (1 - rise) * Math.max(drop, 0.3), 0, (1 - out) * 14);
      zero.root.scale.setScalar(0.05 + 0.95 * out);
      zero.root.visible = t > 1.2;
      const { head, leftArm, rightArm, leftLeg, rightLeg } = zero.rig.skin;
      const flail = (1 - drop) * out;
      leftArm.rotation.x = rightArm.rotation.x = -2.4 * flail + Math.sin(t * 17) * 0.3 * flail - 0.5 * rise;
      leftArm.rotation.z = 0.5 * (1 - rise);
      rightArm.rotation.z = -0.5 * (1 - rise);
      // Sitting up: legs out in front, head turning to the light.
      leftLeg.rotation.x = Math.sin(t * 13) * 0.6 * flail - 1.5 * rise;
      rightLeg.rotation.x = -Math.sin(t * 13) * 0.6 * flail - 1.5 * rise;
      head.rotation.y = 1.1 * ramp(5.6, 6.6, t);
      head.rotation.x = -0.15 * dawn;

      const surge = lit * (1 + 1.8 * Math.sin(Math.PI * ramp(0.6, 3.0, t)) + Math.sin(t * 23) * 0.1);
      glow.intensity = 9 * surge * (1 - off);
      glass.color.copy(GLOW).multiplyScalar(Math.min(1.4, 0.2 + surge) * (1 - off));
      screen.scale.set(1, Math.max(0.02, 1 - off), 1);

      const live = lit * (1 - ramp(2.6, 3.4, t));
      for (let i = 0; i < SPARKS; i++) {
        const spark = sparks[i];
        // Outwards this time: born on the glass, thrown into the room.
        const u = (spark.phase + t * spark.speed) % 1;
        const reach = u ** 1.4;
        const angle = spark.angle + u * 5;
        place
          .set(Math.cos(angle) * spark.radius * reach, Math.sin(angle) * spark.radius * reach, reach * 4.6)
          .add(SCREEN);
        matrix.compose(place, turn, size.setScalar(i < SPARKS * live ? 1.4 - u : 0));
        sparkMesh.setMatrixAt(i, matrix);
      }
      sparkMesh.instanceMatrix.needsUpdate = true;

      // Morning: the curtains part, and the room stops being purple.
      curtains[0].position.z = -1.75 - 0.7 * dawn;
      curtains[1].position.z = -0.25 + 0.7 * dawn;
      daylight.opacity = dawn;
      patchMaterial.opacity = 0.5 * dawn;
      sun.intensity = 2.2 * dawn;
      ambient.color.set("#5a4a9a").lerp(tint.set("#ffe2b8"), dawn);
      ambient.intensity = 0.9 + 0.3 * dawn;
      fill.intensity = 1.1 - 0.8 * dawn;

      flashMaterial.opacity = 1 - ramp(0, 0.8, t);
      const dolly = ramp(0.3, 5.5, t);
      const shake = 0.03 * lit * (1 - off);
      camera.position.set(
        1.4 + 1.5 * dolly + Math.sin(t * 31) * shake,
        2.3 + 0.2 * dolly + Math.cos(t * 37) * shake,
        1.1 + 1.9 * dolly,
      );
      camera.lookAt(look.set(-0.6 * dawn, 2.05 - 0.9 * ramp(2.4, 4.5, t), -2.2 + 1.6 * ramp(2.4, 4.5, t)));
      return t >= LENGTH;
    };
  });
}
