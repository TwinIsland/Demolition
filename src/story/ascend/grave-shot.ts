import * as THREE from "three";
import { TILE_SIZE } from "../../core/geometry";
import type { GameSnapshot, Vec2 } from "../../core/types";
import { world } from "../../render/arena";
import type { StagedShot } from "../../render/game-renderer";
import type { StagedView } from "../../render/camera-rig";

/** Seconds the shot lasts, from his eyes and back to them. */
const LENGTH = 12.5;
/** When the first of them shows, when they all go out, and when the camera starts for home. */
const FIRST = 1.4,
  OUT = 8.6,
  HOME = 9.6;
/** How far out they lie, in world units; the last of them are lost in the haze. */
const FIELD = 118;
/** Side of one of them on the ground: a 16 by 16 figure, a little smaller than a cell. */
const FIGURE = 1.9;
/** Share of the cells that hold one. */
const CROWD = 0.3;
const FOV = 67;

/**
 * The ones before him, as the flat world drew them: sixteen pixels square, one arm up, the way
 * you stand when you call for a status window. `h` hair, `s` skin, `e` eyes, `b` body, `l` legs.
 */
const FIGURES = [
  [
    "................",
    ".....hhhhh...s..",
    "....hhhhhhh..s..",
    "....hsssssh..s..",
    "....hsesesh..b..",
    "....sssssss.bb..",
    ".....sssss.bb...",
    "....bbbbbbbb....",
    "...bbbbbbbb.....",
    "..sbbbbbbb......",
    "..s.bbbbbb......",
    "..s.bbbbbb......",
    "....lll.lll.....",
    "....lll.lll.....",
    "....lll.lll.....",
    "...llll.llll....",
  ],
  [
    "................",
    "..s..hhhhh...s..",
    "..s.hhhhhhh..s..",
    "..s.hsssssh..s..",
    "..b.hsesesh..b..",
    "..bb.sssss..bb..",
    "...bb.sss..bb...",
    "....bbbbbbbb....",
    ".....bbbbbb.....",
    ".....bbbbbb.....",
    ".....bbbbbb.....",
    ".....bbbbbb.....",
    ".....ll.lll.....",
    ".....ll.lll.....",
    ".....ll.lll.....",
    "....lll.llll....",
  ],
] as const;
const SHADE: Record<string, number> = { h: 120, s: 255, e: 40, b: 190, l: 150 };
const SHEETS = FIGURES.length * 2;

const VERTEX = /* glsl */ `
  attribute vec3 aGhost;
  varying vec2 vUv;
  varying vec3 vGhost;
  void main() {
    vUv = uv;
    vGhost = aGhost;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
/**
 * Each lights as the front passes it, stutters like a tube warming up, and then just lies there.
 * At the end they go out a row of pixels at a time.
 */
const FRAGMENT = /* glsl */ `
  uniform sampler2D uSheet;
  uniform float uTime;
  uniform float uFront;
  uniform float uOut;
  varying vec2 vUv;
  varying vec3 vGhost;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    float sheet = floor(vGhost.x + 0.5), away = vGhost.y, seed = vGhost.z;
    vec2 cell = (floor(vUv * 16.0) + 0.5) / 16.0;
    vec4 ink = texture2D(uSheet, vec2((sheet + cell.x) / ${SHEETS.toFixed(1)}, cell.y));
    float reached = uFront - away;
    if (ink.a < 0.5 || reached < 0.0) discard;
    float warming = 1.0 - smoothstep(3.0, 9.0, reached);
    float stutter = mix(1.0, step(0.42, hash(vec2(floor(uTime * 22.0), seed * 91.0))), warming);
    float breath = 0.82 + 0.18 * sin(uTime * 1.4 + seed * 6.283);
    float row = hash(vec2(floor(vUv.y * 16.0), seed * 37.0));
    float kept = step(uOut * 1.15, row + 0.15 * (1.0 - away / ${FIELD.toFixed(1)}));
    float haze = 1.0 - smoothstep(${(FIELD * 0.45).toFixed(1)}, ${FIELD.toFixed(1)}, away);
    float alpha = (0.25 + 0.75 * stutter) * breath * kept * haze;
    if (alpha < 0.02) discard;
    vec3 color = mix(vec3(0.55, 0.8, 1.0), vec3(0.95, 1.0, 1.0), ink.r) * (0.5 + 0.9 * ink.r);
    gl_FragColor = vec4(color * (1.0 + 0.8 * warming), alpha * 0.9);
  }`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const span = (from: number, to: number, time: number) => clamp01((time - from) / (to - from));
const ease = (u: number) => u * u * (3 - 2 * u);
const glide = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const pick = (x: number, z: number, n: number) =>
  (((Math.sin(x * 12.9898 + z * 78.233 + n * 37.719) * 43758.5453) % 1) + 1) % 1;

function sheet() {
  const canvas = document.createElement("canvas");
  canvas.width = 16 * SHEETS;
  canvas.height = 16;
  const ink = canvas.getContext("2d")!;
  FIGURES.forEach((figure, index) =>
    figure.forEach((row, y) =>
      [...row].forEach((symbol, x) => {
        const shade = SHADE[symbol];
        if (shade === undefined) return;
        ink.fillStyle = `rgb(${shade},${shade},${shade})`;
        // Each figure, and the same one the other way round.
        ink.fillRect(index * 32 + x, y, 1, 1);
        ink.fillRect(index * 32 + 31 - x, y, 1, 1);
      }),
    ),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * "Every one of them called for it." Nobody speaks; the camera leaves his eyes and climbs over
 * the graveyard, and from the three stones outwards the ground lights with the people who came
 * before him, flat, as the world they arrived in drew them: over the village, over the wall, out
 * across the fields until the haze takes them. Then they go out, and the camera comes home.
 *
 * The world stands still for it. The owner advances `time` in real seconds and calls `dispose`.
 */
export class GraveShot implements StagedShot {
  time = 0;
  private readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly centre = new THREE.Vector3();
  private readonly swing: number;
  private focus = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, "YXZ");

  /**
   * @param parent The match's own scene.
   * @param graves Cell in the middle of the stones: where it starts.
   * @param look Where his own eyes look; the shot starts and ends there.
   */
  constructor(
    parent: THREE.Object3D,
    state: Readonly<GameSnapshot>,
    graves: Vec2,
    private look: { yaw: number; pitch: number },
  ) {
    const size = state.size;
    this.centre.set(world(graves.x, size), 0.4, world(graves.z, size));
    // The camera ends up looking south-east, out over the corner the graveyard lies in.
    const turn = (-Math.PI * 3) / 4 - look.yaw;
    this.swing = Math.atan2(Math.sin(turn), Math.cos(turn));

    const places: number[] = [],
      ghosts: number[] = [];
    const reach = Math.ceil(FIELD / TILE_SIZE);
    for (let z = graves.z - reach; z <= graves.z + reach; z++)
      for (let x = graves.x - reach; x <= graves.x + reach; x++) {
        const away = Math.hypot(x - graves.x, z - graves.z) * TILE_SIZE;
        if (away > FIELD) continue;
        const inside = x >= 0 && z >= 0 && x < size && z < size;
        // On open ground inside the wall, anywhere on the lawn beyond it. Thicker near the stones.
        if (inside && state.tiles[z][x] !== 0) continue;
        if (pick(x, z, 1) > (away < 14 ? 0.75 : CROWD)) continue;
        places.push(
          world(x + (pick(x, z, 2) - 0.5) * 0.4, size),
          world(z + (pick(x, z, 3) - 0.5) * 0.4, size),
        );
        ghosts.push(Math.floor(pick(x, z, 4) * SHEETS), away, pick(x, z, 5));
      }
    const count = places.length / 2;
    const geometry = new THREE.PlaneGeometry(FIGURE, FIGURE);
    // Flat on the ground, head to the north: the way the page was held.
    geometry.rotateX(-Math.PI / 2);
    geometry.setAttribute("aGhost", new THREE.InstancedBufferAttribute(new Float32Array(ghosts), 3));
    this.mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          uSheet: { value: sheet() },
          uTime: { value: 0 },
          uFront: { value: 0 },
          uOut: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      count,
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++)
      this.mesh.setMatrixAt(i, matrix.makeTranslation(places[i * 2], 0.07, places[i * 2 + 1]));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    parent.add(this.mesh);
  }

  get done() {
    return this.time >= LENGTH;
  }

  /** 0..1: out of his eyes and up over the stones. */
  private get away() {
    return glide(span(0.2, 5.5, this.time)) * (1 - glide(span(HOME, LENGTH, this.time)));
  }

  get showSelf() {
    return this.away > 0.04;
  }

  get lens() {
    const grade = ease(span(0, 2, this.time)) * (1 - ease(span(HOME, LENGTH - 0.5, this.time)));
    return { grade: 0.45 * grade, focus: 34 };
  }

  /** Whether the picture is held in dusk this frame, for whoever dims it. */
  get hush() {
    return this.time > 0.1 && this.time < HOME + 0.6;
  }

  pose(camera: THREE.PerspectiveCamera, { eye }: StagedView) {
    const t = this.time,
      away = this.away,
      u = this.mesh.material.uniforms;
    u.uTime.value = t;
    // Slow among the stones, then faster and faster: by the end it is past the horizon.
    u.uFront.value = t < FIRST ? -1 : 4.5 * (Math.exp(0.52 * (t - FIRST)) - 1);
    u.uOut.value = span(OUT, HOME, t);

    this.focus.copy(eye).lerp(this.centre, ease(span(0.2, 4, t)) * (1 - glide(span(HOME, LENGTH, t))));
    // Down onto the stones first, then the head comes up and the fields come into the picture.
    const down = mix(-0.7, -0.34, ease(span(3.2, 8, t)));
    const heading = this.look.yaw + (this.swing - 0.3 * span(2, HOME, t)) * away;
    this.euler.set(mix(this.look.pitch, down, away), heading, 0);
    camera.quaternion.setFromEuler(this.euler);
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    camera.position.copy(this.focus).addScaledVector(this.forward, -30 * away);
    camera.position.y = Math.max(camera.position.y, 0.5);
    camera.fov = FOV - 9 * away;
    camera.updateProjectionMatrix();
    return true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.uniforms.uSheet.value.dispose();
    this.mesh.material.dispose();
  }
}
