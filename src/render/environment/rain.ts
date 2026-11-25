import * as THREE from "three";
import type { WeatherUniforms } from "./surface-weathering";

const STREAK_VERTEX = /* glsl */ `
attribute vec4 seed;
uniform float wxTime;
uniform vec3 wxFall;
uniform vec3 wxBox;
uniform float wxPixel;
uniform float wxStrength;
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  vec3 velocity = vec3(wxFall.x, -wxFall.y * (0.82 + 0.36 * seed.w), wxFall.z);
  // Drops live in a box that follows the camera and wrap at its faces.
  vec3 drop = seed.xyz * wxBox + velocity * wxTime;
  drop = mod(drop - cameraPosition + 0.5 * wxBox, wxBox) - 0.5 * wxBox + cameraPosition;
  drop.y += 0.2 * wxBox.y;
  vec3 along = normalize(velocity);
  vec3 toEye = cameraPosition - drop;
  float range = length(toEye);
  vec3 across = normalize(cross(along, toEye));
  // A streak is one shutter time long and never thinner than about a pixel.
  float span = mix(0.42, 0.85, seed.w);
  float thin = 0.007;
  float width = max(thin, range * wxPixel * 0.75);
  vec3 world = drop + along * (position.y * span) + across * (position.x * width);
  vUv = position.xy;
  float fill = min(1.0, thin / width * 1.6);
  vAlpha = wxStrength * fill * smoothstep(0.0, 0.25, world.y + 0.1)
    * smoothstep(0.8, 2.6, range) * (1.0 - smoothstep(0.38 * wxBox.x, 0.5 * wxBox.x, range));
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const STREAK_FRAGMENT = /* glsl */ `
uniform vec3 wxTint;
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  float profile = (1.0 - abs(vUv.x) * 2.0) * sin(3.14159265 * (vUv.y + 0.5));
  gl_FragColor = vec4(wxTint, vAlpha * profile);
  #include <fog_fragment>
}`;

const SPLASH_VERTEX = /* glsl */ `
attribute vec4 seed;
attribute float upright;
uniform float wxTime;
uniform float wxArea;
uniform float wxStrength;
uniform sampler2D wxHeights;
uniform vec3 wxField;
varying vec2 vUv;
varying float vAge;
varying float vUpright;
varying float vSeed;
#include <fog_pars_vertex>
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float period = 0.5 + 0.4 * seed.w;
  float clock = wxTime / period + seed.z;
  float cycle = floor(clock);
  float age = fract(clock) * period / 0.22;
  vec2 cell = vec2(hash(seed.xy * 91.0 + cycle), hash(seed.yx * 57.0 - cycle)) * wxArea;
  vec2 xz = mod(cell - cameraPosition.xz + 0.5 * wxArea, wxArea) - 0.5 * wxArea + cameraPosition.xz;
  // Occluder heights of the arena: the drop lands on the wall cap or on the floor.
  vec2 fieldUv = xz / wxField.x + 0.5;
  float inside = step(0.0, fieldUv.x) * step(fieldUv.x, 1.0) * step(0.0, fieldUv.y) * step(fieldUv.y, 1.0);
  float ground = mix(wxField.y, texture2D(wxHeights, fieldUv).r, inside);
  vec3 centre = vec3(xz.x, ground + 0.012, xz.y);
  vec3 world;
  if (upright > 0.5) {
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), cameraPosition - centre));
    float rise = sin(min(age, 1.0) * 3.14159265);
    world = centre + right * position.x * (0.05 + 0.07 * age)
      + vec3(0.0, (position.y + 0.5) * (0.02 + 0.07 * rise), 0.0);
  } else {
    world = centre + vec3(position.x, 0.0, position.y) * (0.04 + 0.22 * age);
  }
  vUv = position.xy;
  vAge = age;
  vUpright = upright;
  vSeed = seed.w;
  if (age > 1.0 || wxStrength <= 0.0) world = vec3(0.0, -1000.0, 0.0);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const SPLASH_FRAGMENT = /* glsl */ `
uniform vec3 wxTint;
uniform float wxStrength;
varying vec2 vUv;
varying float vAge;
varying float vUpright;
varying float vSeed;
#include <fog_pars_fragment>
void main() {
  float alpha;
  if (vUpright > 0.5) {
    // A crown of a few droplets thrown outward from the impact.
    float x = vUv.x * 2.0;
    float y = vUv.y + 0.5;
    float jets = pow(abs(cos(x * 4.0 + vSeed * 6.28)), 3.0);
    float body = 1.0 - smoothstep(0.0, 0.2 + 0.75 * jets * (1.0 - x * x), y);
    alpha = body * (1.0 - x * x) * (1.0 - y) * (1.0 - vAge) * 0.34;
  } else {
    float r = length(vUv) * 2.0;
    alpha = (1.0 - smoothstep(0.0, 0.1, abs(r - 0.85))) * (1.0 - vAge) * (1.0 - vAge) * 0.3;
  }
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(wxTint, alpha * wxStrength);
  #include <fog_fragment>
}`;

function seeds(count: number) {
  const data = new Float32Array(count * 4);
  // A fixed sequence keeps the pattern identical between sessions; presentation only.
  let n = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    data[i] = (n >>> 0) / 4294967296;
  }
  return new THREE.InstancedBufferAttribute(data, 4);
}

/** Rain streaks and ground splashes: two instanced draws animated entirely on the GPU. */
export class Rain {
  readonly root = new THREE.Group();
  private streaks: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private splashes: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private heights: THREE.DataTexture;
  private own = {
    wxFall: { value: new THREE.Vector3(1.6, 13, 0.7) },
    wxBox: { value: new THREE.Vector3(26, 18, 26) },
    wxPixel: { value: 0.001 },
    wxStrength: { value: 0 },
    wxTint: { value: new THREE.Color(0.62, 0.68, 0.74) },
    wxArea: { value: 24 },
    wxHeights: { value: null as THREE.Texture | null },
    /** x arena width in metres, y height of the ground outside the arena. */
    wxField: { value: new THREE.Vector3(1, -1.45, 0) },
  };
  constructor(
    uniforms: WeatherUniforms,
    private maxStreaks = 9000,
    private maxSplashes = 900,
  ) {
    const shared = {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      wxTime: uniforms.wxTime,
      ...this.own,
    };
    this.heights = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType);
    this.heights.needsUpdate = true;
    this.own.wxHeights.value = this.heights;

    const quad = new THREE.PlaneGeometry(1, 1);
    const streakGeometry = new THREE.InstancedBufferGeometry();
    streakGeometry.index = quad.index;
    streakGeometry.setAttribute("position", quad.getAttribute("position"));
    streakGeometry.setAttribute("seed", seeds(maxStreaks));
    this.streaks = new THREE.Mesh(
      streakGeometry,
      new THREE.ShaderMaterial({
        vertexShader: STREAK_VERTEX,
        fragmentShader: STREAK_FRAGMENT,
        uniforms: shared,
        transparent: true,
        depthWrite: false,
        fog: true,
        side: THREE.DoubleSide,
      }),
    );

    // One flat ring and one upright crown per splash.
    const position = quad.getAttribute("position");
    const corners = new Float32Array(position.count * 2 * 3);
    corners.set(position.array as Float32Array, 0);
    corners.set(position.array as Float32Array, position.count * 3);
    const upright = new Float32Array(position.count * 2);
    upright.fill(1, position.count);
    const quadIndex = quad.index!.array;
    const index = new Uint16Array(quadIndex.length * 2);
    index.set(quadIndex, 0);
    for (let i = 0; i < quadIndex.length; i++) index[quadIndex.length + i] = quadIndex[i] + position.count;
    const splashGeometry = new THREE.InstancedBufferGeometry();
    splashGeometry.setIndex(new THREE.BufferAttribute(index, 1));
    splashGeometry.setAttribute("position", new THREE.BufferAttribute(corners, 3));
    splashGeometry.setAttribute("upright", new THREE.BufferAttribute(upright, 1));
    splashGeometry.setAttribute("seed", seeds(maxSplashes));
    this.splashes = new THREE.Mesh(
      splashGeometry,
      new THREE.ShaderMaterial({
        vertexShader: SPLASH_VERTEX,
        fragmentShader: SPLASH_FRAGMENT,
        uniforms: shared,
        transparent: true,
        depthWrite: false,
        fog: true,
        side: THREE.DoubleSide,
      }),
    );
    quad.dispose();
    for (const mesh of [this.streaks, this.splashes]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      this.root.add(mesh);
    }
    this.root.visible = false;
  }

  /** Describe where drops land: 1 marks a permanent wall cell in the square tile grid. */
  setField(tiles: readonly (readonly number[])[], tileSize: number, wallTop = 2.49) {
    const size = tiles.length;
    const data = new Float32Array(size * size);
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) data[z * size + x] = tiles[z][x] === 1 ? wallTop : 0;
    this.heights.dispose();
    this.heights = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
    this.heights.needsUpdate = true;
    this.own.wxHeights.value = this.heights;
    this.own.wxField.value.x = size * tileSize;
  }

  /** `strength` 0 hides the rain; `density` 0..1 scales the number of streaks and splashes drawn. */
  set(strength: number, density: number) {
    this.own.wxStrength.value = strength;
    this.root.visible = strength > 0 && density > 0;
    this.streaks.geometry.instanceCount = Math.round(this.maxStreaks * density);
    this.splashes.geometry.instanceCount = density >= 0.5 ? Math.round(this.maxSplashes * density) : 0;
    this.splashes.visible = this.splashes.geometry.instanceCount > 0;
  }

  update(camera: THREE.Camera, viewportHeight: number) {
    // World size of one pixel at unit distance, from the vertical field of view.
    this.own.wxPixel.value = 2 / (camera.projectionMatrix.elements[5] * Math.max(1, viewportHeight));
  }

  dispose() {
    this.heights.dispose();
    for (const mesh of [this.streaks, this.splashes]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
