import * as THREE from "three";
import { STORY_SKINS } from "../assets";
import type { Stage } from "../stage";
import { SHUTDOWN_ART } from "./art";
import { film, ramp, scatter, type Film } from "./kit";
import { CURTAIN, curtainMaterial } from "./sky";
import type { Ending } from "./unlocks";
import { t } from "../../i18n";

export interface Choice {
  /** The way picked; undefined if the story was closed first. */
  readonly picked: Promise<Ending | undefined>;
  /** Left and right on the movement keys lean towards a way. */
  move(x: number): void;
  /** The action key takes the way leaned towards. */
  act(): void;
  paused: boolean;
  dispose(): void;
}

/** Tiles along one side of what is left of the world. */
const FLOOR = 21;
const GATE_X = 3.4,
  GATE_Z = -4.2;
const WARM = new THREE.Color("#ffd68a"),
  COLD = new THREE.Color("#63e6ff");
/** Seconds from taking a way to the picture going white. */
const LEAVE = 1.5;

/** The view through the gate that stays: a sky, as flat and bright as the day she first saw one. */
function skyPicture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const pen = canvas.getContext("2d")!;
  const sky = pen.createLinearGradient(0, 0, 0, 48);
  sky.addColorStop(0, "#2f7fe0");
  sky.addColorStop(1, "#c8f0ff");
  pen.fillStyle = sky;
  pen.fillRect(0, 0, 64, 48);
  pen.fillStyle = "#ffffff";
  for (const [x, y, w] of [
    [6, 12, 18],
    [10, 9, 10],
    [38, 20, 20],
    [44, 16, 9],
    [22, 30, 12],
  ])
    pen.fillRect(x, y, w, 4);
  pen.fillStyle = "#7fbf6a";
  pen.fillRect(0, 42, 64, 6);
  pen.fillStyle = "#f3a6c0";
  pen.fillRect(4, 34, 10, 8);
  pen.fillRect(50, 32, 11, 10);
  return canvas;
}

/**
 * The one choice of the story that is real, staged at 97%: what is left of the plaza floats in
 * the dark, the progress bar closes in around it, and two ways stand open. To the left the old
 * monitor, with a morning in it; to the right a gate, with the sky she saw for the first time.
 * Nothing is chosen until the player leans one way.
 */
export function playChoice(stage: Stage): Choice {
  const labels = document.createElement("div");
  labels.className = "shutdown-choice";
  labels.innerHTML = `
    <button type="button" data-ending="home"><span>${t("回去。")}</span></button>
    <button type="button" data-ending="stay"><span>${t("留下。")}</span></button>
    <small><kbd>A</kbd> <kbd>D</kbd> ${t("选择")} &nbsp; <kbd>E</kbd> ${t("决定")}</small>`;
  const canvas = stage.overlay();
  canvas.after(labels);

  /** -1 the monitor, 1 the gate, 0 neither yet. */
  let leaning = 0,
    lean = 0,
    leftAt = -1,
    settle: (ending: Ending | undefined) => void = () => {};
  const picked = new Promise<Ending | undefined>((resolve) => (settle = resolve));
  const paint = () => {
    for (const button of labels.querySelectorAll<HTMLElement>("button"))
      button.classList.toggle("leaning", (button.dataset.ending === "home" ? -1 : 1) === leaning);
    labels.classList.toggle("leaving", leftAt >= 0);
  };
  const turn = (to: number) => {
    if (leftAt >= 0 || !to || to === leaning) return;
    leaning = to;
    stage.host.menu("click");
    paint();
  };
  let clock = 0;
  const take = () => {
    if (leftAt >= 0 || !leaning) return;
    leftAt = clock;
    stage.host.menu("accept");
    stage.host.cue("pull");
    paint();
  };
  labels.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!button) return;
    const side = button.dataset.ending === "home" ? -1 : 1;
    if (side === leaning) take();
    else turn(side);
  });

  const running: Film = film(canvas, "stage", (shot) => {
    const { scene, camera, keep } = shot;
    scene.background = new THREE.Color("#04030c");
    scene.fog = new THREE.Fog("#04030c", 14, 46);
    scene.add(new THREE.AmbientLight("#8f8ad0", 0.55));
    const key = new THREE.DirectionalLight("#cfd8ff", 0.5);
    key.position.set(2, 6, 5);
    scene.add(key);

    // What is left of the plaza. The outer tiles let go one ring at a time and drift up as pixels.
    const tiles = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.96, 0.3, 0.96)),
      keep(new THREE.MeshStandardMaterial({ roughness: 0.95 })),
      FLOOR * FLOOR,
    );
    const shade = new THREE.Color();
    for (let i = 0; i < FLOOR * FLOOR; i++) {
      const paved = Math.max(Math.abs((i % FLOOR) - 10), Math.abs(Math.floor(i / FLOOR) - 10)) <= 3;
      shade.set(paved ? "#8d8a96" : "#5d8f58").multiplyScalar(0.8 + 0.3 * scatter(i, 1));
      tiles.setColorAt(i, shade);
    }
    tiles.frustumCulled = false;
    scene.add(tiles);

    // The bar, closer than it has ever been.
    const curtain = keep(curtainMaterial());
    const side = keep(new THREE.PlaneGeometry(1, 1));
    const walls = [0, 1, 2, 3].map((index) => {
      const wall = new THREE.Mesh(side, curtain);
      wall.rotation.y = (index * Math.PI) / 2;
      wall.frustumCulled = false;
      scene.add(wall);
      return wall;
    });

    // Left: the monitor, and the room he left on the other side of its glass.
    const monitor = new THREE.Group();
    monitor.position.set(-GATE_X, 0, GATE_Z);
    monitor.rotation.y = 0.32;
    scene.add(monitor);
    shot.box([3.3, 2.6, 0.7], [0, 1.9, -0.4], "#b9b29c", { parent: monitor });
    shot.box([1.3, 0.5, 0.9], [0, 0.35, -0.4], "#a8a18c", { parent: monitor });
    const room = keep(new THREE.TextureLoader().load(SHUTDOWN_ART.bedroomMorning));
    room.colorSpace = THREE.SRGBColorSpace;
    room.magFilter = THREE.NearestFilter;
    const glass = keep(new THREE.MeshBasicMaterial({ map: room }));
    const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.8, 2.05)), glass);
    screen.position.set(0, 1.95, -0.04);
    monitor.add(screen);
    const warmth = new THREE.PointLight(WARM, 0, 16, 1.5);
    warmth.position.set(-GATE_X + 0.4, 2, GATE_Z + 1.6);
    scene.add(warmth);

    // Right: a gate of the village, and the sky behind it.
    const gate = new THREE.Group();
    gate.position.set(GATE_X, 0, GATE_Z);
    gate.rotation.y = -0.32;
    scene.add(gate);
    for (const x of [-1.5, 1.5]) shot.box([0.34, 3.4, 0.34], [x, 1.7, 0], "#c8382e", { parent: gate });
    shot.box([4.3, 0.32, 0.5], [0, 3.5, 0], "#2a2530", { parent: gate });
    shot.box([3.6, 0.24, 0.36], [0, 2.85, 0], "#c8382e", { parent: gate });
    const sky = keep(new THREE.CanvasTexture(skyPicture()));
    sky.colorSpace = THREE.SRGBColorSpace;
    sky.magFilter = THREE.NearestFilter;
    const view = keep(new THREE.MeshBasicMaterial({ map: sky }));
    const beyond = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.66, 2.7)), view);
    beyond.position.set(0, 1.45, -0.02);
    gate.add(beyond);
    const coolth = new THREE.PointLight(COLD, 0, 16, 1.5);
    coolth.position.set(GATE_X - 0.4, 2, GATE_Z + 1.6);
    scene.add(coolth);

    // The two of them, seen from behind: he looks at whichever way he leans to, she looks at him.
    const zero = shot.figure(STORY_SKINS["story-zero"]);
    zero.root.position.set(-0.55, 0.15, 0.4);
    zero.root.rotation.y = Math.PI;
    const lulu = shot.figure(STORY_SKINS["story-lulu"], 0.62);
    lulu.root.position.set(0.75, 0.15, 0.2);
    lulu.root.rotation.y = Math.PI;

    const flashMaterial = keep(
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0,
        depthTest: false,
        fog: false,
      }),
    );
    const flash = new THREE.Mesh(keep(new THREE.PlaneGeometry(6, 4)), flashMaterial);
    flash.position.z = -0.6;
    flash.renderOrder = 10;
    camera.add(flash);

    const matrix = new THREE.Matrix4(),
      place = new THREE.Vector3(),
      spin = new THREE.Quaternion(),
      axis = new THREE.Euler(),
      size = new THREE.Vector3(),
      look = new THREE.Vector3(),
      tint = new THREE.Color();
    return (t, dt) => {
      clock = t;
      lean += (leaning - lean) * Math.min(1, dt * 5);
      const leave = leftAt < 0 ? 0 : ramp(0, LEAVE, t - leftAt);
      // The floor keeps shrinking while he makes up his mind, down to the plaza itself.
      const keepRings = 9.5 - 5 * ramp(0, 40, t);
      for (let i = 0; i < FLOOR * FLOOR; i++) {
        const x = (i % FLOOR) - 10,
          z = Math.floor(i / FLOOR) - 10;
        const gone = THREE.MathUtils.clamp((Math.max(Math.abs(x), Math.abs(z)) - keepRings) * 0.8, 0, 1);
        const drift =
          gone * (2 + 9 * scatter(i, 2)) + (gone > 0 ? ((t * (0.4 + scatter(i, 3))) % 6) * gone : 0);
        place.set(x, -0.15 + drift, z - 1);
        axis.set(drift * scatter(i, 4), drift * scatter(i, 5), 0);
        matrix.compose(place, spin.setFromEuler(axis), size.setScalar(Math.max(0.001, 1 - 0.85 * gone)));
        tiles.setMatrixAt(i, matrix);
      }
      tiles.instanceMatrix.needsUpdate = true;

      const half = keepRings + 4.5;
      walls.forEach((wall, index) => {
        const places = [
          [0, -half - 1],
          [-half, -1],
          [0, half - 1],
          [half, -1],
        ];
        wall.position.set(places[index][0], CURTAIN.height / 2 - 1.5, places[index][1]);
        wall.scale.set(half * 2, CURTAIN.height, 1);
      });
      curtain.uniforms.uTime.value = t;
      curtain.uniforms.uProgress.value = 0.97;
      curtain.uniforms.uSpan.value = half * 2;
      curtain.uniforms.uShow.value = 0.8;

      // Whichever way he leans to brightens; the other waits.
      const left = Math.max(0, -lean),
        right = Math.max(0, lean),
        breath = 0.06 * Math.sin(t * 2.2);
      glass.color.copy(tint.setScalar(0.5 + 0.6 * left + breath));
      view.color.copy(tint.setScalar(0.5 + 0.6 * right - breath));
      warmth.intensity = 6 + 26 * left;
      coolth.intensity = 6 + 26 * right;

      const sway = Math.sin(t * 1.4) * 0.03;
      zero.rig.skin.head.rotation.y = -lean * 0.75;
      zero.rig.skin.head.rotation.x = sway;
      zero.rig.skin.leftArm.rotation.z = 0.06 + sway;
      zero.rig.skin.rightArm.rotation.z = -0.06 - sway;
      lulu.rig.skin.head.rotation.y = 0.7;
      lulu.rig.skin.head.rotation.x = -0.35;
      // Taking a way: he walks to it, and the picture goes white with its light.
      const target = leaning < 0 ? monitor.position : gate.position;
      if (leave > 0) {
        zero.root.position.lerp(place.set(target.x * 0.8, 0.15, target.z * 0.75), dt * 1.6);
        zero.rig.skin.leftLeg.rotation.x = Math.sin(t * 9) * 0.7;
        zero.rig.skin.rightLeg.rotation.x = -Math.sin(t * 9) * 0.7;
        zero.root.rotation.y = Math.PI - leaning * 0.5;
      }
      flashMaterial.color.copy(leaning < 0 ? WARM : COLD).lerp(tint.set("#ffffff"), leave);
      flashMaterial.opacity = ramp(0.35, 1, leave);

      camera.position.set(lean * 1.1 + leave * leaning * 1.4, 2.5 - 0.5 * leave, 6.4 - 4.6 * leave ** 2);
      camera.lookAt(look.set(lean * 2.3, 1.7, GATE_Z));
      if (leave >= 1) settle(leaning < 0 ? "home" : "stay");
      return leave >= 1;
    };
  });

  return {
    picked,
    move: turn,
    act: take,
    get paused() {
      return running.paused;
    },
    set paused(value) {
      running.paused = value;
    },
    dispose() {
      settle(undefined);
      labels.remove();
      running.dispose();
    },
  };
}
