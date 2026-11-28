import * as THREE from "three";
import type { GameSnapshot, Vec2 } from "../../core/types";
import { world } from "../../render/arena";
import type { StagedShot, StageLight } from "../../render/game-renderer";
import type { StagedView } from "../../render/camera-rig";
import { yawTo, type Director } from "../match/director";
import type { Line } from "../script";
import type { Stage } from "../stage";

const LULU = "lulu";

/**
 * The walk, in cells of the small Flatland: up the south street, round the well, and out along
 * the west road towards the gate, where the sun is going down. She keeps half a step ahead on
 * the street and half a step to his left on the road.
 */
export const STROLL = {
  hero: [
    { x: 7, z: 12.6 },
    { x: 7, z: 8.9 },
    { x: 5.7, z: 7.05 },
    { x: 3.3, z: 7.05 },
  ],
  lulu: [
    { x: 7.45, z: 12.3 },
    { x: 7.45, z: 8.75 },
    { x: 5.9, z: 7.55 },
    { x: 3.45, z: 7.55 },
  ],
  /** Crates in the way of the two of them or of the camera. */
  cleared: [
    { x: 8, z: 12 },
    { x: 8, z: 10 },
    { x: 3, z: 7 },
  ],
} as const;
/** Cells a second: nobody is in a hurry. */
const PACE = 0.6;
/** How far beyond the west gate the sun hangs, and how big it is, in world units. */
const SUN = { away: 150, height: 9, side: 34 };
/** Seconds the camera takes to rise once they have stopped. */
const RISE = 8;
const FOV = 50;

/** The hour: a low sun in the west, violet shade, and a warm haze over the fields. */
const DUSK: StageLight = {
  sun: { color: "#ff9a52", intensity: 2.7, from: [-60, 11, 5] },
  fill: { sky: "#8f79c9", ground: "#6b4038", intensity: 0.62 },
  fog: { color: "#e0926c", density: 0.009 },
  backgroundIntensity: 1,
  environmentIntensity: 0.3,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const span = (from: number, to: number, time: number) => clamp01((time - from) / (to - from));
const ease = (u: number) => u * u * (3 - 2 * u);
const glide = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const pick = (i: number, n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
const length = (path: readonly Vec2[]) =>
  path.slice(1).reduce((sum, to, i) => sum + Math.hypot(to.x - path[i].x, to.z - path[i].z), 0);

/**
 * The evening sky as a panorama, painted as coarsely as the story's rooms: flat bands from violet
 * overhead to orange on the horizon, and long clouds lit from underneath. It is the same all the
 * way round; the sun itself is a thing in the world (`sunset`), so the two cannot disagree.
 */
function duskSky() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ink = canvas.getContext("2d")!;
  // Top of the picture is straight up; row 128 is the horizon.
  const bands: [number, string][] = [
    [0, "#221a52"],
    [44, "#3a2468"],
    [72, "#5f2f7c"],
    [92, "#933c78"],
    [106, "#c94e68"],
    [116, "#ee7550"],
    [123, "#ffa54a"],
    [127, "#ffd27a"],
    [130, "#c9705a"],
    [136, "#5a3a5c"],
  ];
  bands.forEach(([from, color], i) => {
    ink.fillStyle = color;
    ink.fillRect(0, from, 512, (bands[i + 1]?.[0] ?? 256) - from);
  });
  for (let i = 0; i < 70; i++) {
    const row = 58 + Math.floor(pick(i, 1) * 66),
      wide = 14 + Math.floor(pick(i, 2) * 52),
      left = Math.floor(pick(i, 3) * 512),
      low = row > 100;
    // Lit from below near the horizon, in shade higher up.
    ink.fillStyle = low ? "#ffb86a" : row > 82 ? "#e86a78" : "#4a2a70";
    for (const shift of [0, -512]) {
      ink.fillRect(left + shift, row, wide, low ? 1 : 2);
      ink.fillRect(left + shift + 4, row - 1, Math.floor(wide * 0.55), 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** The sun beyond the west gate: a square-edged disc and two rings of glow, half sunk in the fields. */
function sunset(parent: THREE.Object3D, size: number, road: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 48;
  const ink = canvas.getContext("2d")!;
  for (const [radius, color] of [
    [23, "rgba(255,120,70,0.16)"],
    [18, "rgba(255,150,80,0.3)"],
    [13, "#ffb45a"],
    [11, "#ffe9a8"],
  ] as const)
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++)
        if (Math.hypot(x - 23.5, y - 23.5) <= radius) {
          ink.clearRect(x, y, 1, 1);
          ink.fillStyle = color;
          ink.fillRect(x, y, 1, 1);
        }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SUN.side, SUN.side),
    new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color(1.8, 1.8, 1.8),
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  mesh.position.set(world(0, size) - SUN.away, SUN.height, world(road, size));
  mesh.rotation.y = Math.PI / 2;
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  parent.add(mesh);
  return {
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
      texture.dispose();
    },
  };
}

/**
 * One camera for the whole walk, always on their east side and looking west, so the sun is behind
 * them in every frame. Up the street it is low and beside them, and they are two shapes against
 * the sky; as they turn onto the west road it drops in behind and follows; when they stop it
 * rises until the village, the road beyond the gate and the sun are all in the picture.
 */
class StrollShot implements StagedShot {
  readonly showSelf = true;
  /** 0..1 of the way walked; the owner sets it. */
  progress = 0;
  /** Seconds since they stopped; negative while they walk. */
  private stopped = -1;
  private pair = new THREE.Vector3();
  private aim = new THREE.Vector3();
  private settled = false;
  private reach = 5;

  get done() {
    return this.stopped >= RISE;
  }

  get lens() {
    return { grade: 0.3, focus: this.reach };
  }

  arrive() {
    if (this.stopped < 0) this.stopped = 0;
  }

  advance(real: number, state: Readonly<GameSnapshot>) {
    if (this.stopped >= 0) this.stopped += real;
    const you = state.players[0],
      her = state.players.find((p) => p.id === LULU) ?? you;
    this.aim.set(world((you.x + her.x) / 2, state.size), 0, world((you.z + her.z) / 2, state.size));
    // Follow the two of them a little late, so the corner at the well is a curve.
    if (this.settled) this.pair.lerp(this.aim, 1 - Math.exp(-real * 3.5));
    else this.pair.copy(this.aim);
    this.settled = true;
  }

  pose(camera: THREE.PerspectiveCamera, _view: StagedView) {
    const p = this.progress,
      behind = ease(span(0.4, 0.72, p)),
      up = ease(span(0, RISE * 0.6, this.stopped)),
      back = glide(span(1.5, RISE, this.stopped));
    // South of the well while passing it, then onto the road between the two lanterns.
    const south = mix(-1.3, mix(1.9, 0.4, ease(span(0.8, 1, p))), behind);
    camera.position.set(
      this.pair.x + mix(3.4, 5.2, behind) + 9 * back,
      mix(0.95, 2.3, behind) + 6.5 * up,
      this.pair.z + south,
    );
    this.aim.set(this.pair.x - 3 * behind - 7 * back, mix(1.3, 1.6, behind) + 1.4 * up, this.pair.z);
    camera.lookAt(this.aim);
    this.reach = camera.position.distanceTo(this.pair);
    camera.fov = FOV - 6 * back;
    camera.updateProjectionMatrix();
    return true;
  }
}

/**
 * The "stay" ending's evening: the two of them walk through the village at sunset and talk, in
 * the game's own world, lit for the hour. Resolves true when the camera has finished rising, or
 * undefined if the story was closed. The match's closing gives the sky and the light back.
 */
export async function playStroll(stage: Stage, d: Director, lines: readonly Line[]) {
  const { match } = d,
    { renderer } = match,
    hero = d.hero.id;
  for (const cell of STROLL.cleared) d.tile(cell, 0);
  d.put(hero, STROLL.hero[0], yawTo(STROLL.hero[0], STROLL.hero[1]));
  d.put(LULU, STROLL.lulu[0], yawTo(STROLL.lulu[0], STROLL.lulu[1]));

  const sky = duskSky();
  renderer.renderer.initTexture(sky);
  renderer.relight(DUSK);
  renderer.paintSky(sky);
  const sun = sunset(match.scene, d.state.size, STROLL.hero[3].z);
  const shot = new StrollShot();
  const whole = length(STROLL.hero);
  let walked = 0,
    last: Vec2 = { ...STROLL.hero[0] };
  const directed = match.onFrame;
  match.onFrame = (state, dt, real) => {
    directed?.(state, dt, real);
    const you = state.players[0];
    walked += Math.hypot(you.x - last.x, you.z - last.z);
    last = { x: you.x, z: you.z };
    shot.progress = Math.min(1, walked / whole);
    shot.advance(real, state);
  };
  renderer.stagedShot = shot;
  const strike = () => {
    sun.dispose();
    sky.dispose();
  };

  // Both take each stretch in the same time, whoever has the longer way round.
  const walk = async (id: string, path: readonly Vec2[]) => {
    for (let leg = 1; leg < path.length; leg++) {
      const own = Math.hypot(path[leg].x - path[leg - 1].x, path[leg].z - path[leg - 1].z),
        his = Math.hypot(
          STROLL.hero[leg].x - STROLL.hero[leg - 1].x,
          STROLL.hero[leg].z - STROLL.hero[leg - 1].z,
        );
      if (!(await d.walk(id, path[leg], (PACE * own) / his))) return false;
    }
    return true;
  };
  const walking = Promise.all([walk(hero, STROLL.hero), walk(LULU, STROLL.lulu)]);
  const open =
    (await d.seconds(2.2)) && (await d.talk(lines, { live: true })) && (await walking).every(Boolean);
  if (!open) return void strike();
  // They stop where the road leaves the village, and look at it.
  const west = { x: 0, z: STROLL.hero[3].z };
  d.face(hero, west);
  d.face(LULU, west);
  shot.arrive();
  const risen = await d.until(() => shot.done);
  // The props stay up under the fade that follows; whoever closes the match takes them down.
  if (!risen) return void strike();
  return { strike };
}
