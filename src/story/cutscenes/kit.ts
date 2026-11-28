import * as THREE from "three";
import { PlayerObject } from "skinview3d";
import { loadSkinToCanvas } from "skinview-utils";
import { t } from "../../i18n";

/** A short film played once on a canvas of its own, over the stage. */
export interface Cutscene {
  /** Resolves when it has played to its end, or was disposed. */
  readonly done: Promise<void>;
  paused: boolean;
  dispose(): void;
}

/** Rendered small and scaled up without smoothing, so the 3D sits with the pixel art around it. */
const FILM = { width: 320, height: 180 };

export const ramp = (from: number, to: number, t: number) => THREE.MathUtils.smoothstep(t, from, to);
/** A repeatable 0..1 value for item `i`, stream `n`: the same film every time. */
export const pick = (i: number, n: number) =>
  (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;

/** What a film is built from; everything made through the kit is released with the film. */
export interface FilmKit {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  keep<T extends { dispose(): void }>(item: T): T;
  /** A lit box. `glow` makes it shine by itself, unlit. */
  box(
    size: [number, number, number],
    at: [number, number, number],
    color: string,
    glow?: boolean,
  ): THREE.Mesh;
  /** A blocky figure wearing a skin, two units tall, with its origin at the middle of the body. */
  figure(skin: string): { group: THREE.Group; rig: PlayerObject };
  /** Loose cubes drawn in one call; set them with `place(i, position, size)` each frame. */
  swarm(
    count: number,
    color: string,
    edge: number,
  ): { place(i: number, at: THREE.Vector3, size: number): void };
  /** Text drawn in the story's pixel font on a plane `height` units tall. */
  label(text: string, height: number, color: string): THREE.Mesh;
}

/**
 * Plays a film of `length` seconds on `canvas`. `direct` builds the set and returns the function
 * that poses it for a time; the first frame waits for the skins it asked for.
 */
export function playFilm(
  canvas: HTMLCanvasElement,
  length: number,
  direct: (kit: FilmKit) => (t: number) => void,
): Cutscene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.setSize(FILM.width, FILM.height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, FILM.width / FILM.height, 0.1, 80);
  scene.add(camera);
  const owned: { dispose(): void }[] = [];
  const pending: Promise<unknown>[] = [];
  const rigs: PlayerObject[] = [];
  const matrix = new THREE.Matrix4(),
    still = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  const kit: FilmKit = {
    scene,
    camera,
    keep: (item) => (owned.push(item), item),
    box(size, at, color, glow = false) {
      const mesh = new THREE.Mesh(
        kit.keep(new THREE.BoxGeometry(...size)),
        kit.keep(
          glow
            ? new THREE.MeshBasicMaterial({ color })
            : new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
        ),
      );
      mesh.position.set(...at);
      scene.add(mesh);
      return mesh;
    },
    figure(skin) {
      const rig = new PlayerObject();
      rig.scale.setScalar(1 / 16);
      rig.cape.visible = rig.elytra.visible = rig.ears.visible = false;
      rig.visible = false;
      rigs.push(rig);
      const group = new THREE.Group();
      group.add(rig);
      scene.add(group);
      const image = new Image();
      image.src = skin;
      pending.push(
        image
          .decode()
          .then(() => {
            const pixels = document.createElement("canvas");
            loadSkinToCanvas(pixels, image);
            const texture = kit.keep(new THREE.CanvasTexture(pixels));
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.magFilter = texture.minFilter = THREE.NearestFilter;
            rig.skin.map = texture;
            rig.visible = true;
          })
          .catch(() => undefined),
      );
      return { group, rig };
    },
    swarm(count, color, edge) {
      const mesh = new THREE.InstancedMesh(
        kit.keep(new THREE.BoxGeometry(edge, edge, edge)),
        kit.keep(new THREE.MeshBasicMaterial({ color })),
        count,
      );
      mesh.frustumCulled = false;
      scene.add(mesh);
      return {
        place(i, at, size) {
          mesh.setMatrixAt(i, matrix.compose(at, still, scale.setScalar(size)));
          mesh.instanceMatrix.needsUpdate = true;
        },
      };
    },
    label(source, height, color) {
      const text = t(source);
      const pixels = document.createElement("canvas");
      const context = pixels.getContext("2d")!;
      const font = '24px "Fusion Pixel 12px", sans-serif';
      context.font = font;
      pixels.width = Math.ceil(context.measureText(text).width) + 4;
      pixels.height = 28;
      context.font = font;
      context.fillStyle = color;
      context.textBaseline = "middle";
      context.fillText(text, 2, 15);
      const texture = kit.keep(new THREE.CanvasTexture(pixels));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      const mesh = new THREE.Mesh(
        kit.keep(new THREE.PlaneGeometry((height * pixels.width) / pixels.height, height)),
        kit.keep(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false })),
      );
      mesh.renderOrder = 5;
      scene.add(mesh);
      return mesh;
    },
  };
  const pose = direct(kit);

  let frame = 0,
    last = 0,
    elapsed = 0,
    paused = false,
    disposed = false,
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
    if (!paused && last) elapsed += Math.min(0.1, (now - last) / 1000);
    last = now;
    pose(Math.min(elapsed, length));
    renderer.render(scene, camera);
    if (elapsed >= length) stop();
    else frame = requestAnimationFrame(tick);
  };
  void Promise.all(pending).then(() => {
    if (!finished) frame = requestAnimationFrame(tick);
  });

  return {
    done,
    get paused() {
      return paused;
    },
    set paused(value) {
      paused = value;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      for (const item of owned) item.dispose();
      for (const rig of rigs)
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
