import * as THREE from "three";
import type { FireCell, GameSnapshot } from "../core/types";
import { TILE_SIZE, world } from "./arena";

const FLAMES_PER_CELL = 3;

const NOISE = /* glsl */ `
  float gfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gfNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(gfHash(i), gfHash(i + vec2(1, 0)), f.x), mix(gfHash(i + vec2(0, 1)), gfHash(i + vec2(1, 1)), f.x), f.y);
  }
  float gfFbm(vec2 p) { return 0.6 * gfNoise(p) + 0.3 * gfNoise(p * 2.1) + 0.1 * gfNoise(p * 4.3); }
`;

/** Camera-facing flame tongues. `fire` carries seed, strength (0 to 1) and the cell tint. */
function flameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 fire;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vFire;
      void main() {
        vUv = uv;
        vFire = fire.xyz;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(time * 3.1 + fire.x * 40.0) * 0.06 * uv.y;
        vec2 size = vec2(fire.w, fire.w * 1.55) * (0.35 + 0.65 * fire.y);
        center.xy += vec2((position.x + sway) * size.x, position.y * size.y);
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vFire;
      ${NOISE}
      void main() {
        vec2 p = vec2(vUv.x - 0.5, vUv.y);
        float n = gfFbm(vec2(p.x * 3.4 + vFire.x * 17.0, p.y * 2.6 - time * 2.4 - vFire.x * 9.0));
        // A teardrop that narrows with height; the noise eats holes into its upper half.
        float width = 0.46 * (1.0 - p.y) * (0.75 + 0.5 * n);
        float body = smoothstep(width, width * 0.25, abs(p.x)) * smoothstep(0.0, 0.08, p.y);
        float heat = body * (1.25 - p.y * 1.1) * (0.55 + 0.9 * n) * vFire.y;
        if (heat < 0.02) discard;
        vec3 cold = mix(vec3(0.75, 0.1, 0.02), vec3(0.42, 0.12, 0.7), vFire.z);
        vec3 warm = mix(vec3(1.0, 0.52, 0.08), vec3(0.95, 0.4, 0.85), vFire.z);
        vec3 color = mix(cold, warm, smoothstep(0.15, 0.6, heat));
        color = mix(color, vec3(1.0, 0.93, 0.7), smoothstep(0.7, 1.15, heat));
        gl_FragColor = vec4(color * heat, heat);
      }`,
  });
}

/** The burning patch on the floor under the flames. */
function emberMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    vertexShader: /* glsl */ `
      attribute vec4 fire;
      varying vec2 vUv;
      varying vec3 vFire;
      void main() {
        vUv = uv;
        vFire = fire.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vFire;
      ${NOISE}
      void main() {
        vec2 p = vUv - 0.5;
        float n = gfFbm(vUv * 5.0 + vec2(vFire.x * 13.0, time * 0.9));
        float pool = smoothstep(0.56, 0.2, length(p) + 0.16 * (n - 0.5));
        float glow = pool * (0.35 + 0.65 * n) * vFire.y;
        vec3 color = mix(vec3(1.0, 0.36, 0.05), vec3(0.7, 0.3, 1.0), vFire.z);
        gl_FragColor = vec4(color * glow * 0.9, glow * 0.9);
      }`,
  });
}

/**
 * Ground fire: Molotov pools and the Cataclysm sweep. Two instanced draws however many cells
 * burn. Both programs are compiled by `warm` on the loading screen.
 */
export class GroundFire {
  readonly root = new THREE.Group();
  private flames = flameMaterial();
  private embers = emberMaterial();
  private flameMesh?: THREE.InstancedMesh;
  private emberMesh?: THREE.InstancedMesh;
  private quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  private floor = new THREE.PlaneGeometry(TILE_SIZE * 1.25, TILE_SIZE * 1.25).rotateX(-Math.PI / 2);
  private transform = new THREE.Object3D();

  warm(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    this.resize(1);
    renderer.compile(this.root, camera);
  }

  private resize(cells: number) {
    if (this.emberMesh && this.emberMesh.instanceMatrix.count >= cells) return;
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(16, cells)));
    for (const mesh of [this.flameMesh, this.emberMesh]) {
      mesh?.removeFromParent();
      mesh?.dispose();
    }
    const make = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number) => {
      const own = geometry.clone();
      own.setAttribute("fire", new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
      const mesh = new THREE.InstancedMesh(own, material, count);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      this.root.add(mesh);
      return mesh;
    };
    this.flameMesh?.geometry.dispose();
    this.emberMesh?.geometry.dispose();
    this.flameMesh = make(this.quad, this.flames, capacity * FLAMES_PER_CELL);
    this.emberMesh = make(this.floor, this.embers, capacity);
    this.flameMesh.renderOrder = 5;
    this.emberMesh.renderOrder = 4;
  }

  /** `sweep` is extra, harmless fire drawn in another hue: the Cataclysm's flames. */
  update(state: Readonly<GameSnapshot>, wallTime: number, sweep: readonly FireCell[] = []) {
    const cells = state.fires.length + sweep.length;
    this.root.visible = cells > 0;
    if (!cells) return;
    this.resize(cells);
    const flames = this.flameMesh!,
      embers = this.emberMesh!;
    const flameData = flames.geometry.getAttribute("fire") as THREE.InstancedBufferAttribute,
      emberData = embers.geometry.getAttribute("fire") as THREE.InstancedBufferAttribute;
    this.flames.uniforms.time.value = this.embers.uniforms.time.value = wallTime;
    let i = 0;
    const draw = (fire: FireCell, tint: number) => {
      const left = fire.expiresAt - state.time,
        strength = Math.max(0, Math.min(1, (fire.duration - left) * 5, left * 1.6));
      const x = world(fire.x, state.size),
        z = world(fire.z, state.size);
      this.transform.rotation.set(0, 0, 0);
      this.transform.position.set(x, 0.04, z);
      this.transform.updateMatrix();
      embers.setMatrixAt(i, this.transform.matrix);
      emberData.setXYZW(i, (fire.id * 0.137) % 1, strength, tint, 1);
      for (let k = 0; k < FLAMES_PER_CELL; k++) {
        const seed = (fire.id * 0.137 + k * 0.371) % 1,
          angle = seed * Math.PI * 2 + k * 2.1,
          reach = TILE_SIZE * 0.3 * (k ? 1 : 0.2);
        this.transform.position.set(x + Math.cos(angle) * reach, 0.03, z + Math.sin(angle) * reach);
        this.transform.updateMatrix();
        flames.setMatrixAt(i * FLAMES_PER_CELL + k, this.transform.matrix);
        flameData.setXYZW(i * FLAMES_PER_CELL + k, seed, strength, tint, TILE_SIZE * (k ? 0.62 : 0.86));
      }
      i++;
    };
    for (const fire of state.fires) draw(fire, 0);
    for (const fire of sweep) draw(fire, 1);
    embers.count = i;
    flames.count = i * FLAMES_PER_CELL;
    for (const mesh of [flames, embers]) mesh.instanceMatrix.needsUpdate = true;
    flameData.needsUpdate = emberData.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.flameMesh, this.emberMesh]) {
      mesh?.geometry.dispose();
      mesh?.dispose();
    }
    this.quad.dispose();
    this.floor.dispose();
    this.flames.dispose();
    this.embers.dispose();
  }
}
