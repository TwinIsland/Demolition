import * as THREE from "three";
import { PlayerObject } from "skinview3d";
import { loadSkinToCanvas } from "skinview-utils";
import { STORY_ART } from "./assets";

export interface PullIn {
  /** Resolves when the cutscene has played to its end, or was disposed. */
  readonly done: Promise<void>;
  dispose(): void;
}

/** Rendered small and scaled up without smoothing, so the 3D sits with the pixel art around it. */
const SIZE = { width: 320, height: 180 };
const LENGTH = 5.6;
const SPARKS = 150;
/** Centre of the monitor's screen. */
const SCREEN = new THREE.Vector3(0, 2.1, -2.34);
const START = new THREE.Vector3(0, 1, -0.5);
const GLOW = new THREE.Color("#63e6ff");

const ramp = (from: number, to: number, t: number) => THREE.MathUtils.smoothstep(t, from, to);

/**
 * The end of act 2 in 3D: the dark bedroom, the one screen still lit, and Zero, as the blocky
 * figure of his skin, lifted off the floor and spun into it. Plays once on `canvas`.
 */
export function playPullIn(canvas: HTMLCanvasElement): PullIn {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE.width, SIZE.height, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#05040b");
  const camera = new THREE.PerspectiveCamera(48, SIZE.width / SIZE.height, 0.1, 40);
  scene.add(camera);
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T) => (owned.push(item), item);
  const box = (size: [number, number, number], at: [number, number, number], color: string) => {
    const mesh = new THREE.Mesh(
      keep(new THREE.BoxGeometry(...size)),
      keep(new THREE.MeshStandardMaterial({ color, roughness: 0.9 })),
    );
    mesh.position.set(...at);
    scene.add(mesh);
    return mesh;
  };

  // The room: floor, back wall, desk, and the monitor with a tower beside it.
  box([14, 0.2, 14], [0, -0.1, -1], "#2b2440");
  box([14, 8, 0.2], [0, 4, -4.2], "#3a3158");
  box([3.6, 0.16, 1.7], [0, 1.3, -3.1], "#5b4636");
  box([0.16, 1.3, 1.5], [-1.6, 0.65, -3.1], "#4a392c");
  box([0.16, 1.3, 1.5], [1.6, 0.65, -3.1], "#4a392c");
  box([1.7, 1.4, 1.5], [0, 2.1, -3.1], "#b9b29c");
  box([0.5, 1.2, 1.3], [1.35, 1.98, -3.2], "#a8a18c");
  box([1.5, 0.06, 0.5], [0, 1.41, -2.0], "#d9d3bf");
  const glass = keep(new THREE.MeshBasicMaterial({ color: GLOW }));
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.34, 1.02)), glass);
  screen.position.copy(SCREEN);
  scene.add(screen);

  scene.add(new THREE.AmbientLight("#5a4a9a", 0.5));
  const fill = new THREE.DirectionalLight("#8a6cff", 0.5);
  fill.position.set(3, 4, 4);
  scene.add(fill);
  const glow = new THREE.PointLight(GLOW, 10, 14, 1.4);
  glow.position.copy(SCREEN).add(new THREE.Vector3(0, 0, 0.5));
  scene.add(glow);

  // Zero. The rig's origin is the middle of the body, which is also what he spins around.
  const rig = new PlayerObject();
  rig.scale.setScalar(1 / 16);
  rig.rotation.y = Math.PI;
  rig.cape.visible = rig.elytra.visible = rig.ears.visible = false;
  rig.visible = false;
  const zero = new THREE.Group();
  zero.add(rig);
  scene.add(zero);
  const skin = new Image();
  skin.src = STORY_ART.zeroSkin;

  const sparkMesh = new THREE.InstancedMesh(
    keep(new THREE.BoxGeometry(0.07, 0.07, 0.07)),
    keep(new THREE.MeshBasicMaterial({ color: "#9af3ff" })),
    SPARKS,
  );
  sparkMesh.frustumCulled = false;
  scene.add(sparkMesh);
  // A fixed pseudo-random spread, so every play looks the same.
  const sparks = Array.from({ length: SPARKS }, (_, i) => {
    const pick = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
    return {
      angle: pick(1) * Math.PI * 2,
      radius: 0.5 + pick(2) * 2.4,
      phase: pick(3),
      speed: 0.35 + pick(4) * 0.5,
    };
  });

  const flashMaterial = keep(
    new THREE.MeshBasicMaterial({ color: "#eaffff", transparent: true, opacity: 0, depthTest: false }),
  );
  const flash = new THREE.Mesh(keep(new THREE.PlaneGeometry(4, 4)), flashMaterial);
  flash.position.z = -0.5;
  flash.renderOrder = 10;
  camera.add(flash);

  const matrix = new THREE.Matrix4(),
    place = new THREE.Vector3(),
    turn = new THREE.Quaternion(),
    size = new THREE.Vector3(),
    eye = new THREE.Vector3(),
    look = new THREE.Vector3();
  const draw = (t: number) => {
    const raise = ramp(0.3, 1.3, t),
      lift = ramp(1.0, 2.2, t),
      pull = ramp(2.0, 4.3, t) ** 2.2,
      white = ramp(4.0, 4.4, t) - ramp(4.7, 5.2, t),
      off = ramp(4.7, 4.95, t);

    const { head, leftArm, rightArm, leftLeg, rightLeg } = rig.skin;
    head.rotation.x = -0.35 * raise;
    leftArm.rotation.x = rightArm.rotation.x = -2.7 * raise + Math.sin(t * 17) * 0.12 * lift;
    leftArm.rotation.z = 0.25 * raise;
    rightArm.rotation.z = -0.25 * raise;
    leftLeg.rotation.x = Math.sin(t * 13) * 0.6 * lift;
    rightLeg.rotation.x = -Math.sin(t * 13) * 0.6 * lift;

    // Up off the floor, tipping head-first towards the screen, then down a tightening spiral into it.
    const swirl = Math.sin(Math.PI * pull) * 0.55;
    zero.position
      .copy(START)
      .setY(START.y + lift * 1.0 + Math.sin(t * 5) * 0.05 * lift)
      .lerp(SCREEN, pull);
    zero.position.x += Math.cos(t * 9) * swirl;
    zero.position.y += Math.sin(t * 9) * swirl;
    zero.rotation.set(-1.25 * lift, 0, pull * 16);
    zero.scale.setScalar(Math.max(0.001, 1 - 0.95 * pull));
    zero.visible = pull < 0.995;

    const surge = 1 + ramp(0.2, 4.2, t) * 2.2 + Math.sin(t * 23) * 0.12;
    glow.intensity = 10 * surge * (1 - off);
    glass.color.copy(GLOW).multiplyScalar((0.75 + 0.25 * surge) * (1 - off));
    screen.scale.set(1, Math.max(0.02, 1 - off), 1);
    flashMaterial.opacity = white;

    const count = Math.floor(SPARKS * ramp(0.2, 2.4, t) * (1 - off));
    for (let i = 0; i < SPARKS; i++) {
      const spark = sparks[i];
      const u = (spark.phase + t * spark.speed * (0.6 + surge * 0.3)) % 1;
      const reach = (1 - u) ** 1.4;
      const angle = spark.angle + u * 5;
      place
        .set(Math.cos(angle) * spark.radius * reach, Math.sin(angle) * spark.radius * reach, reach * 4.6)
        .add(SCREEN);
      matrix.compose(place, turn, size.setScalar(i < count ? 0.5 + u : 0));
      sparkMesh.setMatrixAt(i, matrix);
    }
    sparkMesh.instanceMatrix.needsUpdate = true;

    const dolly = ramp(0, 4.6, t);
    const shake = 0.03 * ramp(1.5, 4.2, t);
    eye.set(2.9 - 1.5 * dolly, 2.5 - 0.2 * dolly, 3.0 - 1.9 * dolly);
    camera.position.set(eye.x + Math.sin(t * 31) * shake, eye.y + Math.cos(t * 37) * shake, eye.z);
    camera.lookAt(look.set(0, 1.7 + 0.35 * dolly, -2.2));
    renderer.render(scene, camera);
  };

  let frame = 0,
    started = 0,
    finished = false,
    finish = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  const stop = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    finish();
  };
  const tick = (now: number) => {
    started ||= now;
    const t = (now - started) / 1000;
    draw(Math.min(t, LENGTH));
    if (t >= LENGTH) stop();
    else frame = requestAnimationFrame(tick);
  };
  // The skin was decoded on the loading screen, so this resolves at once.
  void skin
    .decode()
    .then(() => {
      const pixels = document.createElement("canvas");
      loadSkinToCanvas(pixels, skin);
      const texture = keep(new THREE.CanvasTexture(pixels));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      rig.skin.map = texture;
      rig.visible = true;
    })
    .catch(() => undefined)
    .finally(() => {
      if (!finished) frame = requestAnimationFrame(tick);
    });

  return {
    done,
    dispose() {
      stop();
      for (const item of owned) item.dispose();
      rig.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        part.geometry.dispose();
        for (const material of Array.isArray(part.material) ? part.material : [part.material])
          material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
