import * as THREE from "three";
import type { FireCell, GameSnapshot } from "../core/types";
import { TILE_SIZE, world } from "./arena";

/** Flame billboards per burning cell; the Cataclysm's sweep uses fewer, it covers the whole floor. */
const FLAMES_PER_CELL = 4;
const SWEEP_FLAMES = 2;
const SPARKS_PER_CELL = 3;
/** The ground layer of a cell reaches one tile past it, so neighbouring cells blend into one pool. */
const GROUND_SPAN = TILE_SIZE * 2;

/**
 * `sheet` is the baked flipbook (scripts/make-fire-flipbook.py): 8 x 8 frames with heat in red and
 * soot in green, plus tileable noise in blue over the whole sheet.
 */
const SHEET = /* glsl */ `
  uniform sampler2D sheet;
  uniform float time;
  vec2 gfFrame(float index, vec2 uv) {
    vec2 inside = clamp(uv, 0.5 / 128.0, 1.0 - 0.5 / 128.0);
    return vec2((mod(index, 8.0) + inside.x) / 8.0, 1.0 - (floor(index / 8.0) + 1.0 - inside.y) / 8.0);
  }
  /** Heat and soot at a frame-local position, blended between two frames so 24 fps plays smooth. */
  vec2 gfFlame(vec2 uv, float seed) {
    float at = fract(time * 0.36 + seed) * 64.0;
    float first = floor(at);
    vec2 a = texture2D(sheet, gfFrame(first, uv)).rg;
    vec2 b = texture2D(sheet, gfFrame(mod(first + 1.0, 64.0), uv)).rg;
    return mix(a, b, at - first);
  }
  float gfNoise(vec2 p) { return texture2D(sheet, p).b; }
  /** Blackbody-like ramp: dull red at the cool edge, orange body, pale yellow core. */
  vec3 gfGlow(float heat) {
    vec3 color = mix(vec3(0.5, 0.035, 0.0), vec3(1.0, 0.27, 0.02), smoothstep(0.08, 0.42, heat));
    color = mix(color, vec3(1.0, 0.62, 0.14), smoothstep(0.38, 0.72, heat));
    color = mix(color, vec3(1.0, 0.92, 0.68), smoothstep(0.72, 1.0, heat));
    return color * smoothstep(0.02, 0.3, heat);
  }
`;

/** Emission adds, soot covers: one pass, premultiplied. */
const OVER = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  toneMapped: false,
} as const;

type Uniforms = { sheet: { value: THREE.Texture }; time: { value: number } };

/** Camera-facing flames. `fire` carries seed, strength (0 to 1), width and mirror flag. */
function flameMaterial(uniforms: Uniforms) {
  return new THREE.ShaderMaterial({
    ...OVER,
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 fire;
      varying vec2 vUv;
      varying vec2 vFire;
      void main() {
        vUv = vec2(fire.w > 0.5 ? 1.0 - uv.x : uv.x, uv.y);
        vFire = fire.xy;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        // A flame catching or dying is shorter, not just dimmer.
        vec2 size = fire.z * vec2(0.75 + 0.25 * fire.y, 1.5 * (0.3 + 0.7 * fire.y));
        center.xy += position.xy * size;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      ${SHEET}
      varying vec2 vUv;
      varying vec2 vFire;
      void main() {
        // Scrolling noise frays the silhouette, more towards the tips.
        float fray = gfNoise(vec2(vUv.x * 0.21 + vFire.x, vUv.y * 0.17 - time * 0.11 + vFire.x * 3.0)) - 0.5;
        vec2 sampled = gfFlame(vUv + vec2(fray * 0.07 * vUv.y, 0.0), vFire.x);
        float heat = sampled.r * (0.55 + 0.45 * vFire.y);
        float soot = sampled.g * vFire.y;
        float body = smoothstep(0.12, 0.75, heat) * 0.5;
        float smoke = soot * 0.42 * (1.0 - body);
        float alpha = body + smoke;
        if (heat < 0.02 && alpha < 0.01) discard;
        gl_FragColor = vec4(gfGlow(heat) * 2.3 * vFire.y + vec3(0.035, 0.03, 0.028) * smoke, alpha);
      }`,
  });
}

/** The burning floor: charred ground, licks of burning fuel, and the glow the fire throws around. */
function groundMaterial(uniforms: Uniforms) {
  return new THREE.ShaderMaterial({
    ...OVER,
    uniforms,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    vertexShader: /* glsl */ `
      attribute vec4 fire;
      varying vec2 vUv;
      varying vec2 vWorld;
      varying float vStrength;
      void main() {
        vUv = uv;
        vStrength = fire.y;
        vec4 at = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = at.xz;
        gl_Position = projectionMatrix * viewMatrix * at;
      }`,
    fragmentShader: /* glsl */ `
      ${SHEET}
      varying vec2 vUv;
      varying vec2 vWorld;
      varying float vStrength;
      void main() {
        // Cosine windows two tiles wide add up to one across neighbouring cells: no seams, no grid.
        vec2 w = 0.5 + 0.5 * cos(3.14159265 * clamp((vUv - 0.5) * 2.0, -1.0, 1.0));
        float window = w.x * w.y;
        // World-space noise, so the pattern runs unbroken from cell to cell.
        float slow = gfNoise(vWorld * 0.047 + vec2(time * 0.011, -time * 0.017));
        float fast = gfNoise(vWorld * 0.093 + vec2(-time * 0.05, time * 0.071));
        // Everything is weighted by the window alone: any other mask would double up where cells overlap.
        float film = smoothstep(0.4, 0.76, slow * 0.6 + fast * 0.75 - 0.18);
        float flicker = 0.82 + 0.18 * gfNoise(vec2(time * 0.31, vWorld.x * 0.013));
        vec3 light = vec3(1.0, 0.36, 0.06) * flicker * 0.3;
        vec3 fuel = gfGlow(0.3 + 0.7 * film) * film * 1.5;
        float scorch = 0.32 * window;
        gl_FragColor = vec4((light + fuel) * window * vStrength, scorch * vStrength);
      }`,
  });
}

/** Sparks carried up by the fire. Animated in the vertex shader from a per-spark seed. */
function sparkMaterial(uniforms: Uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 fire;
      uniform float time;
      varying vec2 vUv;
      varying float vLife;
      void main() {
        vUv = uv - 0.5;
        float age = fract(time * (0.45 + 0.35 * fire.w) + fire.x);
        vLife = (1.0 - age) * fire.y;
        vec3 drift = vec3(sin(time * 2.3 + fire.x * 40.0), 0.0, cos(time * 1.9 + fire.x * 23.0)) * 0.22 * age;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(drift + vec3(0.0, age * fire.z, 0.0), 1.0);
        center.xy += position.xy * (0.035 + 0.035 * fire.w) * (1.0 - 0.6 * age);
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vLife;
      void main() {
        float glow = smoothstep(0.5, 0.1, length(vUv)) * vLife;
        if (glow < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.8, 0.4), vLife) * glow * 2.6, glow);
      }`,
  });
}

const fraction = (value: number) => value - Math.floor(value);

/**
 * Ground fire: Molotov pools and the Cataclysm sweep. Three instanced draws however many cells
 * burn. The sheet loads with the other assets and the programs are compiled by `warm`, both on
 * the loading screen.
 */
export class GroundFire {
  readonly root = new THREE.Group();
  private sheet: THREE.Texture;
  private renderer?: THREE.WebGLRenderer;
  private uniforms: Uniforms;
  private materials: THREE.ShaderMaterial[];
  private flames?: THREE.InstancedMesh;
  private ground?: THREE.InstancedMesh;
  private sparks?: THREE.InstancedMesh;
  private quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  private dot = new THREE.PlaneGeometry(1, 1);
  private floor = new THREE.PlaneGeometry(GROUND_SPAN, GROUND_SPAN).rotateX(-Math.PI / 2);
  private transform = new THREE.Object3D();

  constructor(manager: THREE.LoadingManager) {
    this.sheet = new THREE.TextureLoader(manager).load("./assets/effects/fire-flipbook.webp", (sheet) =>
      this.renderer?.initTexture(sheet),
    );
    // Data, not colour. No mipmaps: they would bleed neighbouring frames into each other.
    this.sheet.colorSpace = THREE.NoColorSpace;
    this.sheet.wrapS = this.sheet.wrapT = THREE.RepeatWrapping;
    this.sheet.minFilter = this.sheet.magFilter = THREE.LinearFilter;
    this.sheet.generateMipmaps = false;
    this.uniforms = { sheet: { value: this.sheet }, time: { value: 0 } };
    this.materials = [
      groundMaterial(this.uniforms),
      flameMaterial(this.uniforms),
      sparkMaterial(this.uniforms),
    ];
  }

  warm(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    this.resize(1);
    renderer.compile(this.root, camera);
    // Upload the sheet now, or as soon as it arrives: still on the loading screen either way.
    this.renderer = renderer;
    if (this.sheet.image) renderer.initTexture(this.sheet);
  }

  private resize(cells: number) {
    if (this.ground && this.ground.instanceMatrix.count >= cells) return;
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(16, cells)));
    const make = (
      old: THREE.InstancedMesh | undefined,
      geometry: THREE.BufferGeometry,
      layer: number,
      count: number,
    ) => {
      old?.removeFromParent();
      old?.geometry.dispose();
      old?.dispose();
      const own = geometry.clone();
      own.setAttribute("fire", new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
      const mesh = new THREE.InstancedMesh(own, this.materials[layer], count);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.renderOrder = 4 + layer;
      this.root.add(mesh);
      return mesh;
    };
    this.ground = make(this.ground, this.floor, 0, capacity);
    this.flames = make(this.flames, this.quad, 1, capacity * FLAMES_PER_CELL);
    this.sparks = make(this.sparks, this.dot, 2, capacity * SPARKS_PER_CELL);
  }

  /** `sweep` is extra, harmless fire: the Cataclysm's flames rolling over the floor. */
  update(state: Readonly<GameSnapshot>, wallTime: number, sweep: readonly FireCell[] = []) {
    const cells = state.fires.length + sweep.length;
    this.root.visible = cells > 0;
    if (!cells) return;
    this.resize(cells);
    const ground = this.ground!,
      flames = this.flames!,
      sparks = this.sparks!;
    const data = (mesh: THREE.InstancedMesh) =>
      mesh.geometry.getAttribute("fire") as THREE.InstancedBufferAttribute;
    const groundData = data(ground),
      flameData = data(flames),
      sparkData = data(sparks);
    this.uniforms.time.value = wallTime;
    let cell = 0,
      flame = 0,
      spark = 0;
    const place = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number) => {
      this.transform.position.set(x, y, z);
      this.transform.updateMatrix();
      mesh.setMatrixAt(index, this.transform.matrix);
    };
    const draw = (fire: FireCell, tongues: number) => {
      const left = fire.expiresAt - state.time,
        age = fire.duration - left;
      if (age <= 0) return;
      // Catches in a quarter of a second, dies down over the last two thirds of one.
      const strength = Math.max(0, Math.min(1, age * 4, left * 1.5));
      const x = world(fire.x, state.size),
        z = world(fire.z, state.size);
      place(ground, cell, x, 0.04, z);
      groundData.setXYZW(cell++, 0, strength, 0, 0);
      for (let k = 0; k < tongues; k++) {
        // Scattered over the cell and a little beyond, so a pool never reads as a grid of flames.
        const seed = fraction(fire.id * 0.137 + k * 0.371),
          angle = seed * Math.PI * 2 + k * 2.4,
          reach = TILE_SIZE * (k ? 0.24 + 0.24 * fraction(seed * 7.3) : 0.08);
        place(flames, flame, x + Math.cos(angle) * reach, 0.02, z + Math.sin(angle) * reach);
        const width = TILE_SIZE * (k ? 0.5 + 0.22 * fraction(seed * 3.7) : 0.82);
        flameData.setXYZW(flame++, seed, strength, width, fraction(seed * 5.1) > 0.5 ? 1 : 0);
      }
      for (let k = 0; k < SPARKS_PER_CELL; k++) {
        const seed = fraction(fire.id * 0.219 + k * 0.447),
          angle = seed * Math.PI * 2;
        place(
          sparks,
          spark,
          x + Math.cos(angle) * TILE_SIZE * 0.35 * seed,
          0.15,
          z + Math.sin(angle) * TILE_SIZE * 0.35 * seed,
        );
        sparkData.setXYZW(spark++, seed, strength, 1.6 + 1.6 * fraction(seed * 9.1), fraction(seed * 4.3));
      }
    };
    for (const fire of state.fires) draw(fire, FLAMES_PER_CELL);
    for (const fire of sweep) draw(fire, SWEEP_FLAMES);
    ground.count = cell;
    flames.count = flame;
    sparks.count = spark;
    for (const mesh of [ground, flames, sparks]) {
      mesh.instanceMatrix.needsUpdate = true;
      data(mesh).needsUpdate = true;
    }
  }

  dispose() {
    for (const mesh of [this.ground, this.flames, this.sparks]) {
      mesh?.geometry.dispose();
      mesh?.dispose();
    }
    for (const geometry of [this.quad, this.dot, this.floor]) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.sheet.dispose();
  }
}
