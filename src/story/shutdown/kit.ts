import * as THREE from "three";
import { PlayerObject } from "skinview3d";
import { loadSkinToCanvas } from "skinview-utils";

/** What a cutscene builds with. `keep` registers anything that must be disposed with the shot. */
export interface Shot {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  keep<T extends { dispose(): void }>(item: T): T;
  /** A box of one flat colour, added to the scene (or to `parent`). */
  box(
    size: readonly [number, number, number],
    at: readonly [number, number, number],
    color: THREE.ColorRepresentation,
    options?: { parent?: THREE.Object3D; glow?: number; unlit?: boolean },
  ): THREE.Mesh;
  /** One of the cast as the blocky figure of their skin. It appears once the skin is decoded. */
  figure(skin: string, scale?: number): Figure;
}

export interface Figure {
  /** Stands on its origin: move and turn this. */
  readonly root: THREE.Group;
  readonly rig: PlayerObject;
}

/** A cutscene in progress. */
export interface Film {
  /** Resolves when the draw function reports the end, or the film is disposed. */
  readonly done: Promise<void>;
  /** Stops the clock, for a dialog laid over the story. */
  paused: boolean;
  dispose(): void;
}

/** Pixel size of a film: fixed and small for the 8-bit acts, or as large as the stage. */
export type FilmSize = { width: number; height: number } | "stage";

export const ramp = (from: number, to: number, t: number) => THREE.MathUtils.smoothstep(t, from, to);
/** A repeatable 0..1 value for index `i`, so every play of a shot looks the same. */
export const scatter = (i: number, n: number) =>
  (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;

/**
 * Runs a three.js cutscene on `canvas`. `build` sets the scene up and returns the function that
 * poses it for a time in seconds; that function returns true once the cutscene is over. The film
 * owns its renderer and gives the context back when it is disposed.
 */
export function film(
  canvas: HTMLCanvasElement,
  size: FilmSize,
  build: (shot: Shot) => (t: number, dt: number) => boolean,
): Film {
  const staged = size === "stage";
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: staged,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 400);
  scene.add(camera);
  const owned: { dispose(): void }[] = [];
  const figures: PlayerObject[] = [];
  let width = 0,
    height = 0;
  const fit = () => {
    const wide = staged
      ? Math.min(1920, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)))
      : size.width;
    const tall = staged ? Math.round((wide * 9) / 16) : size.height;
    if (!wide || (wide === width && tall === height)) return;
    width = wide;
    height = tall;
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
  };
  const shot: Shot = {
    renderer,
    scene,
    camera,
    keep: (item) => (owned.push(item), item),
    box(dimensions, at, color, { parent = scene, glow = 0, unlit = false } = {}) {
      const material = unlit
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.9, emissive: color, emissiveIntensity: glow });
      const mesh = new THREE.Mesh(shot.keep(new THREE.BoxGeometry(...dimensions)), shot.keep(material));
      mesh.position.set(...at);
      parent.add(mesh);
      return mesh;
    },
    figure(skin, scale = 1) {
      const rig = new PlayerObject();
      // Skin pixels to world units: a figure is two units tall, and stands on the root's origin.
      rig.scale.setScalar(scale / 16);
      rig.position.y = scale;
      rig.cape.visible = rig.elytra.visible = rig.ears.visible = false;
      rig.visible = false;
      figures.push(rig);
      const root = new THREE.Group();
      root.add(rig);
      scene.add(root);
      const image = new Image();
      image.src = skin;
      // Decoded on the loading screen already, so this is a matter of a frame.
      void image
        .decode()
        .then(() => {
          const pixels = document.createElement("canvas");
          loadSkinToCanvas(pixels, image);
          const texture = shot.keep(new THREE.CanvasTexture(pixels));
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = texture.minFilter = THREE.NearestFilter;
          rig.skin.map = texture;
          rig.visible = true;
        })
        .catch(() => undefined);
      return { root, rig };
    },
  };
  fit();
  const draw = build(shot);

  let frame = 0,
    last = 0,
    time = 0,
    finished = false,
    disposed = false,
    finish = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  const running: Film = {
    done,
    paused: false,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      finish();
      for (const item of owned) item.dispose();
      for (const rig of figures)
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
  const tick = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = running.paused || !last ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    if (staged) fit();
    camera.aspect = width / height || 16 / 9;
    camera.updateProjectionMatrix();
    // A film that has ended keeps its last picture up until it is disposed.
    if (draw(time, dt) && !finished) {
      finished = true;
      finish();
    }
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);
  return running;
}
