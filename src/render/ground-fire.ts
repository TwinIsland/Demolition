import * as THREE from "three";
import type { FireCell, GameSnapshot } from "../core/types";
import { TILE_SIZE, world } from "./arena";

/**
 * Flame billboards per burning cell: enough, scattered widely enough, that a pool burns as one low
 * carpet of fire. The Cataclysm's sweep covers the whole floor for a moment and uses fewer.
 */
const FLAMES_PER_CELL = 7;
const SWEEP_FLAMES = 2;
const SPARKS_PER_CELL = 3;
/** The ground layer of a cell reaches one tile past it, so neighbouring cells blend into one pool. */
const GROUND_SPAN = TILE_SIZE * 2;

/**
 * Both sheets come from Unity's CC0 flipbook pack, packed by scripts/make-fire-sheets.py.
 * `flames`: 16 x 4 frames, colour and alpha. `smoke`: 8 x 8 frames with shade in red and coverage
 * in green; its blue channel is tileable noise over the whole sheet.
 */
const SHEETS = /* glsl */ `
  uniform sampler2D flames;
  uniform sampler2D smoke;
  uniform float time;
  /** One frame of a sheet, blended into the next so the loop plays smooth at any frame rate. */
  vec4 gfFrames(sampler2D sheet, vec2 grid, vec2 uv, float at) {
    vec2 inside = clamp(uv, 0.004, 0.996);
    float count = grid.x * grid.y;
    float first = floor(at);
    float next = mod(first + 1.0, count);
    vec2 a = vec2(mod(first, grid.x) + inside.x, grid.y - floor(first / grid.x) - 1.0 + inside.y) / grid;
    vec2 b = vec2(mod(next, grid.x) + inside.x, grid.y - floor(next / grid.x) - 1.0 + inside.y) / grid;
    return mix(texture2D(sheet, a), texture2D(sheet, b), at - first);
  }
  float gfNoise(vec2 p) { return texture2D(smoke, p).b; }
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

type Uniforms = {
  flames: { value: THREE.Texture };
  smoke: { value: THREE.Texture };
  time: { value: number };
};

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
        // The sheet leaves a few empty rows under each flame; skip them so the base sits on the floor.
        vUv = vec2(fire.w > 0.5 ? 1.0 - uv.x : uv.x, 0.04 + uv.y * 0.96);
        vFire = fire.xy;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        // A flame catching or dying is shorter, not just dimmer.
        vec2 size = fire.z * vec2(0.8 + 0.2 * fire.y, 1.45 * (0.25 + 0.75 * fire.y));
        center.xy += position.xy * size;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      ${SHEETS}
      varying vec2 vUv;
      varying vec2 vFire;
      void main() {
        // Every flame runs the loop from its own point and at its own pace.
        float at = fract(time * (0.42 + 0.16 * vFire.x) + vFire.x * 7.0) * 64.0;
        vec4 flame = gfFrames(flames, vec2(16.0, 4.0), vUv, at);
        float alpha = flame.a * vFire.y;
        if (alpha < 0.01) discard;
        // Hot enough to bloom at the core; half-opaque, so flames stack into a dense carpet
        // without the order they are drawn in showing.
        gl_FragColor = vec4(flame.rgb * alpha * 2.1, alpha * 0.5);
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
      ${SHEETS}
      varying vec2 vUv;
      varying vec2 vWorld;
      varying float vStrength;
      void main() {
        // Cosine windows two tiles wide add up to one across neighbouring cells: no seams, no grid.
        // Everything is weighted by the window alone; any other mask would double up where cells overlap.
        vec2 w = 0.5 + 0.5 * cos(3.14159265 * clamp((vUv - 0.5) * 2.0, -1.0, 1.0));
        float window = w.x * w.y;
        // World-space noise, so the pattern runs unbroken from cell to cell.
        float slow = gfNoise(vWorld * 0.047 + vec2(time * 0.011, -time * 0.017));
        float fast = gfNoise(vWorld * 0.093 + vec2(-time * 0.05, time * 0.071));
        float film = smoothstep(0.36, 0.74, slow * 0.6 + fast * 0.75 - 0.18);
        float flicker = 0.8 + 0.2 * gfNoise(vec2(time * 0.31, vWorld.x * 0.013));
        vec3 light = vec3(1.0, 0.4, 0.07) * flicker * 0.42;
        vec3 fuel = mix(vec3(1.0, 0.3, 0.03), vec3(1.0, 0.72, 0.2), film) * film * 1.7;
        gl_FragColor = vec4((light + fuel) * window * vStrength, 0.4 * window * vStrength);
      }`,
  });
}

/** Black smoke rolling up off the fire. `fire` carries seed, strength, size and mirror flag. */
function smokeMaterial(uniforms: Uniforms) {
  return new THREE.ShaderMaterial({
    ...OVER,
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 fire;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vPuff;
      void main() {
        vUv = vec2(fire.w > 0.5 ? 1.0 - uv.x : uv.x, uv.y);
        float age = fract(time * 0.3 + fire.x);
        // Thin where it leaves the flames, then it swells, drifts and thins out again.
        vPuff = vec3(fire.x, age, fire.y * smoothstep(0.0, 0.25, age) * (1.0 - age));
        vec3 rise = vec3(sin(fire.x * 31.0) * 0.5 * age, 1.1 + 3.4 * age, cos(fire.x * 17.0) * 0.5 * age);
        vec4 center = modelViewMatrix * instanceMatrix * vec4(rise, 1.0);
        center.xy += (position.xy - vec2(0.0, 0.5)) * fire.z * (0.7 + 1.3 * age);
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      ${SHEETS}
      varying vec2 vUv;
      varying vec3 vPuff;
      void main() {
        vec4 puff = gfFrames(smoke, vec2(8.0, 8.0), vUv, fract(time * 0.2 + vPuff.x * 5.0) * 64.0);
        float alpha = puff.g * vPuff.z * 0.55;
        if (alpha < 0.01) discard;
        // Lit from below by the fire while it is still young.
        vec3 shade = vec3(0.02 + 0.1 * puff.r) + vec3(0.5, 0.16, 0.02) * (1.0 - vPuff.y) * (1.0 - vPuff.y) * 0.5;
        gl_FragColor = vec4(shade * alpha, alpha);
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
 * Ground fire: Molotov pools and the Cataclysm sweep. Four instanced draws however many cells
 * burn. The sheets load with the other assets and the programs are compiled by `warm`, both on
 * the loading screen.
 */
export class GroundFire {
  readonly root = new THREE.Group();
  private sheets: THREE.Texture[];
  private renderer?: THREE.WebGLRenderer;
  private uniforms: Uniforms;
  private materials: THREE.ShaderMaterial[];
  private ground?: THREE.InstancedMesh;
  private flames?: THREE.InstancedMesh;
  private smoke?: THREE.InstancedMesh;
  private sparks?: THREE.InstancedMesh;
  private quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  private dot = new THREE.PlaneGeometry(1, 1);
  private floor = new THREE.PlaneGeometry(GROUND_SPAN, GROUND_SPAN).rotateX(-Math.PI / 2);
  private transform = new THREE.Object3D();

  constructor(manager: THREE.LoadingManager) {
    const loader = new THREE.TextureLoader(manager);
    const load = (file: string, colour: boolean) => {
      const sheet = loader.load(`./assets/effects/${file}`, (loaded) => this.renderer?.initTexture(loaded));
      sheet.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      sheet.wrapS = sheet.wrapT = THREE.RepeatWrapping;
      // No mipmaps: they would bleed neighbouring frames into each other.
      sheet.minFilter = sheet.magFilter = THREE.LinearFilter;
      sheet.generateMipmaps = false;
      return sheet;
    };
    this.sheets = [load("fire-flames.webp", true), load("fire-smoke.webp", false)];
    this.uniforms = {
      flames: { value: this.sheets[0] },
      smoke: { value: this.sheets[1] },
      time: { value: 0 },
    };
    this.materials = [
      groundMaterial(this.uniforms),
      flameMaterial(this.uniforms),
      smokeMaterial(this.uniforms),
      sparkMaterial(this.uniforms),
    ];
  }

  /** Builds the layers so the scene-wide warm-up compiles them. */
  warm(renderer: THREE.WebGLRenderer) {
    this.resize(1);
    // Upload the sheets now, or as soon as they arrive: still on the loading screen either way.
    this.renderer = renderer;
    for (const sheet of this.sheets) if (sheet.image) renderer.initTexture(sheet);
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
    this.smoke = make(this.smoke, this.quad, 2, capacity);
    this.sparks = make(this.sparks, this.dot, 3, capacity * SPARKS_PER_CELL);
  }

  /** `sweep` is extra, harmless fire: the Cataclysm's flames rolling over the floor. */
  update(state: Readonly<GameSnapshot>, wallTime: number, sweep: readonly FireCell[] = []) {
    const cells = state.fires.length + sweep.length;
    this.root.visible = cells > 0;
    if (!cells) return;
    this.resize(cells);
    const ground = this.ground!,
      flames = this.flames!,
      smoke = this.smoke!,
      sparks = this.sparks!;
    const data = (mesh: THREE.InstancedMesh) =>
      mesh.geometry.getAttribute("fire") as THREE.InstancedBufferAttribute;
    const groundData = data(ground),
      flameData = data(flames),
      smokeData = data(smoke),
      sparkData = data(sparks);
    this.uniforms.time.value = wallTime;
    let cell = 0,
      flame = 0,
      puff = 0,
      spark = 0;
    const place = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number) => {
      this.transform.position.set(x, y, z);
      this.transform.updateMatrix();
      mesh.setMatrixAt(index, this.transform.matrix);
    };
    const draw = (fire: FireCell, tongues: number, smoky: boolean) => {
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
        // Spread over the whole cell and a little beyond its edge, so neighbouring cells run
        // together and a pool never reads as a grid of separate fires.
        const seed = fraction(fire.id * 0.137 + k * 0.371),
          dx = (fraction(seed * 7.3 + k * 0.29) - 0.5) * TILE_SIZE * 1.1,
          dz = (fraction(seed * 3.9 + k * 0.53) - 0.5) * TILE_SIZE * 1.1;
        place(flames, flame, x + dx, 0.02, z + dz);
        // Low and wide: waist height for most, a few taller ones to break the skyline.
        const width = TILE_SIZE * (k === 0 ? 0.62 : 0.36 + 0.2 * fraction(seed * 5.7));
        flameData.setXYZW(flame++, seed, strength, width, fraction(seed * 5.1) > 0.5 ? 1 : 0);
      }
      if (smoky) {
        const seed = fraction(fire.id * 0.311);
        place(smoke, puff, x, 0, z);
        smokeData.setXYZW(puff++, seed, strength, TILE_SIZE * 0.9, seed > 0.5 ? 1 : 0);
      }
      for (let k = 0; k < SPARKS_PER_CELL; k++) {
        const seed = fraction(fire.id * 0.219 + k * 0.447),
          angle = seed * Math.PI * 2,
          reach = TILE_SIZE * 0.35 * seed;
        place(sparks, spark, x + Math.cos(angle) * reach, 0.15, z + Math.sin(angle) * reach);
        sparkData.setXYZW(spark++, seed, strength, 1.6 + 1.6 * fraction(seed * 9.1), fraction(seed * 4.3));
      }
    };
    for (const fire of state.fires) draw(fire, FLAMES_PER_CELL, true);
    for (const fire of sweep) draw(fire, SWEEP_FLAMES, false);
    ground.count = cell;
    flames.count = flame;
    smoke.count = puff;
    sparks.count = spark;
    for (const mesh of [ground, flames, smoke, sparks]) {
      mesh.instanceMatrix.needsUpdate = true;
      data(mesh).needsUpdate = true;
    }
  }

  dispose() {
    for (const mesh of [this.ground, this.flames, this.smoke, this.sparks]) {
      mesh?.geometry.dispose();
      mesh?.dispose();
    }
    for (const geometry of [this.quad, this.dot, this.floor]) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const sheet of this.sheets) sheet.dispose();
  }
}
