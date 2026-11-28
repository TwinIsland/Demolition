import * as THREE from "three";
import { TILE_SIZE } from "../../core/geometry";
import type { GameSnapshot } from "../../core/types";
import { zoneWallInset } from "../../core/zone";
import { t } from "../../i18n";

/** The machine is at 3% when the act opens and at 97% when the last fight is won. */
const FIRST = 3,
  LAST = 97;
/** The writing: a band high around the whole sky, so it can be read from anywhere. */
const BAND = { radius: 96, height: 30, lift: 50, repeats: 3 };
const SHEET = { width: 2048, height: 512 };
const CURTAIN_HEIGHT = 9;
/** What the system has written round the sky, and what it writes once the last of the three is up again. */
const NOTICE = "正在关机。请勿关闭电源。",
  UPDATING = "更新中。请勿关闭电源。";
const FONT = '"Fusion Pixel 12px", "Noto Sans SC", sans-serif';

const CURTAIN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
/**
 * One side of the wall: flames licking up from the ground, and above them the bar. The bar is cut
 * into blocks, the way an old installer draws one, and fills from the left.
 */
const CURTAIN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uSpan;
  uniform float uShow;
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float sum = 0.0, gain = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += noise(p) * gain;
      p *= 2.03;
      gain *= 0.5;
    }
    return sum;
  }
  void main() {
    // Chunky on purpose: the fire is made of the same pixels as everything else here.
    vec2 grid = vec2(uSpan * 6.0, ${(CURTAIN_HEIGHT * 6).toFixed(1)});
    vec2 uv = (floor(vUv * grid) + 0.5) / grid;
    float heat = fbm(vec2(uv.x * uSpan * 0.9, uv.y * 3.2 - uTime * 1.5));
    float flame = smoothstep(0.08, 0.7, heat * 1.6 - uv.y * 2.3 + 0.3);
    // Deep red at the tips, orange in the body, and only the foot of the wall burns yellow.
    vec3 color = mix(vec3(0.75, 0.08, 0.02), vec3(1.0, 0.42, 0.06), flame);
    color = mix(color, vec3(1.0, 0.8, 0.35), flame * smoothstep(0.22, 0.0, uv.y));
    float alpha = flame * 0.88;

    // The bar: a frame, and blocks inside it up to the progress so far.
    vec2 bar = vec2((vUv.x - 0.05) / 0.9, (vUv.y - 0.6) / 0.24);
    if (bar.x > 0.0 && bar.x < 1.0 && bar.y > 0.0 && bar.y < 1.0) {
      float edgeX = 0.012 * 30.0 / uSpan, edgeY = 0.14;
      float frame = 1.0 - step(edgeX, bar.x) * step(bar.x, 1.0 - edgeX) * step(edgeY, bar.y) * step(bar.y, 1.0 - edgeY);
      float blocks = floor(uSpan / 1.2);
      float cell = fract(bar.x * blocks), index = floor(bar.x * blocks);
      float filled = step((index + 0.5) / blocks, uProgress);
      float block = step(0.14, cell) * step(cell, 0.86) * step(0.28, bar.y) * step(bar.y, 0.72);
      float pulse = 0.85 + 0.15 * sin(uTime * 6.0 - index * 0.6);
      vec3 cyan = vec3(0.35, 0.95, 1.0);
      float lit = max(frame, block * filled * pulse);
      color = mix(vec3(0.01, 0.02, 0.05), cyan * 2.2, lit);
      alpha = mix(0.5, 1.0, lit);
    }
    gl_FragColor = vec4(color, alpha * uShow);
  }`;

const DOME_FRAGMENT = /* glsl */ `
  uniform float uDim;
  uniform float uGlory;
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    // Scanlines across the whole sky, the way a tube shows them when it is about to go.
    float line = 0.82 + 0.18 * step(0.5, fract(vUv.y * 240.0));
    vec4 dim = vec4(0.01, 0.0, 0.03, uDim * line);

    // The last sky: night from the top down to a burning horizon, stars, and curtains of light
    // hung all the way round. vUv.y is 0.5 at the horizon and 1 overhead.
    float up = clamp((vUv.y - 0.5) * 2.0, 0.0, 1.0), turn = vUv.x * 6.2831853;
    vec3 night = mix(vec3(0.62, 0.12, 0.42), vec3(0.03, 0.01, 0.12), smoothstep(0.0, 0.55, up));
    night += vec3(1.0, 0.55, 0.2) * smoothstep(0.16, 0.0, up) * 0.6;
    vec2 cell = floor(vUv * vec2(520.0, 260.0));
    float star = step(0.9965, hash(cell)) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(cell + 7.0) * 40.0));
    night += star * smoothstep(0.1, 0.5, up);
    float sway = sin(turn * 3.0 + uTime * 0.21 + sin(up * 7.0 + uTime * 0.5) * 1.4);
    float fold = sin(turn * 7.0 - uTime * 0.33 + sin(up * 11.0 - uTime * 0.7) * 0.9);
    float veil = smoothstep(0.15, 1.0, sway) * 0.8 + smoothstep(0.4, 1.0, fold) * 0.5;
    veil *= smoothstep(0.06, 0.3, up) * smoothstep(1.0, 0.45, up);
    vec3 light = mix(vec3(0.15, 1.0, 0.75), vec3(1.0, 0.3, 0.9), 0.5 + 0.5 * sin(turn * 2.0 + up * 4.0 + uTime * 0.27));
    light = mix(light, vec3(1.0, 0.85, 0.35), 0.5 + 0.5 * sin(turn * 5.0 - uTime * 0.4)) ;
    vec4 glory = vec4((night + light * veil * 1.5) * line, 0.96);
    gl_FragColor = mix(dim, glory, uGlory);
  }`;

/** The wall's material: `uTime` seconds, `uProgress` 0..1, `uSpan` the side's length, `uShow` its opacity. */
export const curtainMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uSpan: { value: 30 }, uShow: { value: 0 } },
    vertexShader: CURTAIN_VERTEX,
    fragmentShader: CURTAIN_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
export const CURTAIN = { height: CURTAIN_HEIGHT } as const;

/**
 * The shutdown, hung in the match's own world: the system's message written around the sky, the
 * sky going dark behind it, and the closing zone dressed as what it is here, a progress bar.
 * Everything follows the snapshot it is given, so it needs no events from the simulation.
 */
export class ShutdownSky {
  readonly root = new THREE.Group();
  /** Set to hold the reading still, as when the fight is over; undefined follows the zone. */
  percent?: number;
  /** Set for the last sky of all: night, stars and curtains of light where the afternoon was. */
  glory = false;
  private glow = 0;
  private message = NOTICE;
  private readonly sheet = document.createElement("canvas");
  private readonly text: THREE.CanvasTexture;
  private readonly band: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly curtain: THREE.ShaderMaterial;
  private readonly sides: THREE.Mesh[] = [];
  private written = -1;
  private shown = 0;
  private visible = false;

  constructor(
    parent: THREE.Object3D,
    private readonly size: number,
  ) {
    this.sheet.width = SHEET.width;
    this.sheet.height = SHEET.height;
    this.text = new THREE.CanvasTexture(this.sheet);
    this.text.colorSpace = THREE.SRGBColorSpace;
    this.text.wrapS = THREE.RepeatWrapping;
    // Seen from inside the cylinder the sheet would read backwards.
    this.text.repeat.set(-BAND.repeats, 1);
    this.band = new THREE.Mesh(
      new THREE.CylinderGeometry(BAND.radius, BAND.radius, BAND.height, 72, 1, true),
      new THREE.MeshBasicMaterial({
        map: this.text,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.band.position.y = BAND.lift;
    this.band.renderOrder = -1;
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { uDim: { value: 0 }, uGlory: { value: 0 }, uTime: { value: 0 } },
        vertexShader: CURTAIN_VERTEX,
        fragmentShader: DOME_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dome.renderOrder = -2;
    this.curtain = curtainMaterial();
    const plane = new THREE.PlaneGeometry(1, 1);
    for (let side = 0; side < 4; side++) {
      const mesh = new THREE.Mesh(plane, this.curtain);
      // Each side faces the middle of the map, so the bar reads left to right from inside.
      mesh.rotation.y = (side * Math.PI) / 2;
      mesh.renderOrder = 3;
      this.sides.push(mesh);
    }
    this.root.add(this.dome, this.band, ...this.sides);
    for (const object of [this.dome, this.band, ...this.sides]) object.frustumCulled = false;
    parent.add(this.root);
    this.write(FIRST);
  }

  /** Lets the message and the wall appear; until then the sky is the one act 4 left. */
  show() {
    this.visible = true;
  }

  /** Call once a frame with the live snapshot; `now` is wall time in milliseconds. */
  update(state: Readonly<GameSnapshot>, now: number) {
    const closing = state.storyBrawl ? Math.min(1, state.time / state.duration) : 0;
    const percent = this.percent ?? Math.round(FIRST + (LAST - 1 - FIRST) * closing);
    const message = this.glory ? UPDATING : NOTICE;
    if (percent !== this.written || message !== this.message) {
      this.message = message;
      this.write(percent);
    }
    this.glow += ((this.glory ? 1 : 0) - this.glow) * 0.02;
    this.dome.material.uniforms.uGlory.value = this.glow;
    this.dome.material.uniforms.uTime.value = now / 1000;
    this.shown += ((this.visible ? 1 : 0) - this.shown) * 0.04;
    this.band.material.opacity = this.shown;
    this.band.rotation.y = now * 0.00002;
    this.dome.material.uniforms.uDim.value = this.shown * (0.2 + 0.6 * (percent / 100) ** 1.4);

    // The inner face of the boundary, in world units from the middle of the map.
    const inset = state.zone ? zoneWallInset(state.time, state.zone) : 0.5;
    const half = ((this.size - 1) / 2 - inset) * TILE_SIZE - 0.04;
    const places: readonly [number, number][] = [
      [0, -half],
      [-half, 0],
      [0, half],
      [half, 0],
    ];
    this.sides.forEach((mesh, side) => {
      mesh.position.set(places[side][0], CURTAIN_HEIGHT / 2, places[side][1]);
      mesh.scale.set(half * 2, CURTAIN_HEIGHT, 1);
    });
    const uniforms = this.curtain.uniforms;
    uniforms.uTime.value = now / 1000;
    uniforms.uProgress.value = percent / 100;
    uniforms.uSpan.value = half * 2;
    uniforms.uShow.value = this.shown;
  }

  private write(percent: number) {
    this.written = percent;
    const { width, height } = this.sheet;
    const pen = this.sheet.getContext("2d")!;
    pen.clearRect(0, 0, width, height);
    // A system dialog, as wide as the sky: a dark bar, the message, the number, the bar again.
    pen.fillStyle = "rgba(6, 8, 26, 0.62)";
    pen.fillRect(0, 60, width, 392);
    pen.fillStyle = "rgba(120, 235, 255, 0.9)";
    pen.fillRect(0, 60, width, 6);
    pen.fillRect(0, 446, width, 6);
    pen.textBaseline = "middle";
    pen.fillStyle = "#f4fbff";
    pen.font = `150px ${FONT}`;
    // The notice is a line of twelve characters in Chinese; a longer one is set smaller to leave the number its room.
    const message = t(this.message),
      room = width - 140 - pen.measureText("100% ").width,
      wide = pen.measureText(message).width;
    if (wide > room) pen.font = `${Math.floor((150 * room) / wide)}px ${FONT}`;
    pen.fillText(message, 70, 190);
    pen.font = `150px ${FONT}`;
    pen.textAlign = "right";
    pen.fillStyle = "#7df0ff";
    pen.fillText(`${percent}%`, width - 70, 190);
    pen.textAlign = "left";
    const left = 70,
      top = 300,
      long = width - 140,
      tall = 90,
      blocks = 40;
    pen.strokeStyle = "#f4fbff";
    pen.lineWidth = 8;
    pen.strokeRect(left, top, long, tall);
    pen.fillStyle = "#7df0ff";
    const step = (long - 24) / blocks;
    for (let i = 0; i < Math.round((blocks * percent) / 100); i++)
      pen.fillRect(left + 14 + i * step, top + 16, step - 8, tall - 32);
    this.text.needsUpdate = true;
  }

  dispose() {
    this.root.removeFromParent();
    this.text.dispose();
    this.band.geometry.dispose();
    this.band.material.dispose();
    this.dome.geometry.dispose();
    this.dome.material.dispose();
    this.sides[0].geometry.dispose();
    this.curtain.dispose();
  }
}
