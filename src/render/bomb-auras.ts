import * as THREE from "three";
import type { BombAura } from "../core/pack-api";

/** Enough for about seventy charges at once; anything beyond is simply not drawn. */
const CAPACITY = 1024;
const TAU = Math.PI * 2;
const hash = (seed: number, i: number, salt: number) => {
  const v = Math.sin(seed * 12.9898 + i * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Themed particles around placed charges (cold mist, fumes, sparkles, dust). Every charge shares
 * one point cloud and one draw call. Motion is a function of time alone, so nothing is simulated
 * or allocated per frame: `begin`, `add` for each charge, then `commit`.
 */
export class BombAuras {
  readonly root: THREE.Points;
  private positions = new Float32Array(CAPACITY * 3);
  private tints = new Float32Array(CAPACITY * 4);
  private looks = new Float32Array(CAPACITY * 2);
  private count = 0;
  private time = 0;
  private colors = new Map<string, THREE.Color>();
  private uniforms = { scale: { value: 1 }, ortho: { value: 0 } };

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("tint", new THREE.BufferAttribute(this.tints, 4));
    geometry.setAttribute("look", new THREE.BufferAttribute(this.looks, 2));
    for (const name of ["position", "tint", "look"])
      (geometry.getAttribute(name) as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec4 tint;
        attribute vec2 look;
        uniform float scale;
        uniform float ortho;
        varying vec4 vTint;
        varying float vGlow;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = look.x * scale * mix(1.0 / max(0.1, -mv.z), 1.0, ortho);
          vTint = tint;
          vGlow = look.y;
        }`,
      fragmentShader: /* glsl */ `
        varying vec4 vTint;
        varying float vGlow;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float soft = smoothstep(1.0, 0.0, d);
          // Smoke is a wide soft puff; a glow keeps a hot core.
          float a = mix(soft * soft, pow(soft, 3.0) + 0.6 * smoothstep(0.35, 0.0, d), vGlow) * vTint.a;
          // Premultiplied: alpha fades out as the particle turns from smoke into light.
          gl_FragColor = vec4(vTint.rgb * a, a * (1.0 - vGlow));
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.root = new THREE.Points(geometry, material);
    this.root.name = "bomb-auras";
    this.root.frustumCulled = false;
    this.root.renderOrder = 3;
    const buffer = new THREE.Vector2();
    this.root.onBeforeRender = (renderer, _scene, camera) => {
      // World size to pixels: exact for both the perspective and the overhead camera.
      const projection = camera.projectionMatrix.elements;
      this.uniforms.scale.value = (renderer.getDrawingBufferSize(buffer).y * projection[5]) / 2;
      this.uniforms.ortho.value = projection[11] === 0 ? 1 : 0;
    };
  }

  private color(hex: string) {
    let color = this.colors.get(hex);
    if (!color) this.colors.set(hex, (color = new THREE.Color(hex)));
    return color;
  }

  begin(time: number) {
    this.time = time;
    this.count = 0;
  }

  /** One charge at `origin`. `seed` keeps its particles apart from those of other charges. */
  add(origin: THREE.Vector3, seed: number, aura: BombAura) {
    const first = this.color(aura.color);
    const second = aura.color2 ? this.color(aura.color2) : first;
    const { positions, tints, looks, time } = this;
    const sinks = aura.rise < 0;
    for (let i = 0; i < aura.count && this.count < CAPACITY; i++) {
      const a = hash(seed, i, 1);
      const b = hash(seed, i, 2);
      const c = hash(seed, i, 3);
      const life = time * aura.speed * (0.7 + 0.6 * a) + b;
      const phase = life - Math.floor(life);
      const angle = c * TAU + time * aura.swirl * (0.6 + 0.8 * b);
      const reach = aura.radius * (0.5 + 0.5 * a) + aura.spread * phase;
      const color = i % 2 ? second : first;
      const n = this.count++;
      positions[n * 3] = origin.x + Math.cos(angle) * reach;
      positions[n * 3 + 1] = origin.y + (sinks ? 0.16 + 0.2 * b : 0.2 + 0.55 * b) + aura.rise * phase;
      positions[n * 3 + 2] = origin.z + Math.sin(angle) * reach;
      // Fade in and out over one life; sparkles also flicker.
      let alpha = Math.sin(Math.PI * phase) * aura.opacity;
      if (aura.twinkle) alpha *= 1 - aura.twinkle * (0.5 + 0.5 * Math.sin(time * 11 + c * 40));
      tints[n * 4] = color.r;
      tints[n * 4 + 1] = color.g;
      tints[n * 4 + 2] = color.b;
      tints[n * 4 + 3] = alpha;
      looks[n * 2] = aura.size * (aura.twinkle ? 0.7 + 0.6 * a : 0.55 + 0.9 * phase);
      looks[n * 2 + 1] = aura.glow;
    }
  }

  commit() {
    const geometry = this.root.geometry;
    geometry.setDrawRange(0, this.count);
    if (!this.count) return;
    for (const name of ["position", "tint", "look"]) {
      const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }

  dispose() {
    this.root.geometry.dispose();
    (this.root.material as THREE.Material).dispose();
  }
}
