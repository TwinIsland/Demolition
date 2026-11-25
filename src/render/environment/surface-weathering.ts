import * as THREE from "three";
import { NOISE_GLSL } from "./noise.glsl";

/**
 * Shader patches that stop repeated blocks from looking identical and let a map be wet.
 *
 * Nothing here adds textures or instance attributes. Variation is derived from each
 * instance's world position, and every mask is procedural noise in world space, so static
 * batches keep their draw calls.
 */
export type SurfaceProfile = "structure" | "ground" | "terrain" | "metal" | "prop";
/**
 * 0: instance variation and plain wetness. 1: adds raindrop ripples and rivulets.
 * 2: adds grime, streaks, moss, cracks and a second ripple layer.
 */
export type DetailLevel = 0 | 1 | 2;

export interface WeatherUniforms {
  [uniform: string]: THREE.IUniform;
  wxTime: { value: number };
  /** 0 dry, 1 soaked. */
  wxWet: { value: number };
  /** Strength of animated rain response: ripples and rivulets. */
  wxRain: { value: number };
  /** x grime at the foot of walls, y leak streaks, z moss, w cracks. */
  wxAmount: { value: THREE.Vector4 };
  /** Noise level above which standing water forms; lower means more puddles. */
  wxPuddleLevel: { value: number };
  /** Ground mist: x extinction per metre at ground level, y falloff per metre of height. */
  wxFog: { value: THREE.Vector2 };
  wxTile: { value: number };
  wxReflection: { value: THREE.Texture | null };
  wxReflectionMatrix: { value: THREE.Matrix4 };
  wxReflectionOn: { value: number };
}

export function createWeatherUniforms(): WeatherUniforms {
  return {
    wxTime: { value: 0 },
    wxWet: { value: 0 },
    wxRain: { value: 0 },
    wxAmount: { value: new THREE.Vector4(1, 1, 1, 1) },
    wxPuddleLevel: { value: 0.56 },
    wxFog: { value: new THREE.Vector2(0, 0.5) },
    wxTile: { value: 2.4 },
    wxReflection: { value: null },
    wxReflectionMatrix: { value: new THREE.Matrix4() },
    wxReflectionOn: { value: 0 },
  };
}

/** Which arena materials get which treatment, by the names the material library assigns. */
export function profileFor(material: THREE.Material): SurfaceProfile | undefined {
  const name = material.name;
  if (name === "enamel" || name === "wall-cap" || name === "exterior-building") return "structure";
  if (name === "floor") return "ground";
  if (name === "terrain") return "terrain";
  if (name === "wall-base" || name === "platform") return "metal";
  if (name.startsWith("df:")) return name === "df:glass" ? undefined : "prop";
  return undefined;
}

const VERTEX_PARS = /* glsl */ `
varying vec3 vWxPos;
varying vec3 vWxNormal;
varying vec4 vWxSeed;
#ifdef WX_REFLECT
  uniform mat4 wxReflectionMatrix;
  varying vec4 vWxReflUv;
#endif
float wxVertexHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

// Each block shows a different crop of its texture, turned by a multiple of 90 degrees.
// The tangent frame is derived from the same varyings, so normal maps stay consistent.
const VERTEX_UV = /* glsl */ `
vWxSeed = vec4(0.5);
#ifdef USE_INSTANCING
{
  vec4 wxOrigin = modelMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0));
  vec2 wxCell = floor(wxOrigin.xz * 4.0 + 0.5) + floor(wxOrigin.y * 4.0 + 0.5) * 17.0;
  vWxSeed = vec4(wxVertexHash(wxCell), wxVertexHash(wxCell + 19.7),
                 wxVertexHash(wxCell + 47.3), wxVertexHash(wxCell + 83.1));
  #ifdef WX_UV_JITTER
    float wxTurn = floor(vWxSeed.x * 4.0) * 1.5707963;
    float wxScale = mix(0.55, 0.95, vWxSeed.y);
    mat2 wxUvTurn = mat2(cos(wxTurn), -sin(wxTurn), sin(wxTurn), cos(wxTurn)) * wxScale;
    vec2 wxUvShift = vWxSeed.zw + 0.5;
    #ifdef USE_MAP
      vMapUv = wxUvTurn * (vMapUv - 0.5) + wxUvShift;
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv = wxUvTurn * (vNormalMapUv - 0.5) + wxUvShift;
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv = wxUvTurn * (vRoughnessMapUv - 0.5) + wxUvShift;
    #endif
  #endif
}
#endif
`;

const VERTEX_WORLD = /* glsl */ `
{
  vec4 wxWorld = vec4(transformed, 1.0);
  vec3 wxObjectNormal = objectNormal;
  #ifdef USE_INSTANCING
    wxWorld = instanceMatrix * wxWorld;
    wxObjectNormal = mat3(instanceMatrix) * wxObjectNormal;
  #endif
  wxWorld = modelMatrix * wxWorld;
  vWxPos = wxWorld.xyz;
  vWxNormal = normalize(mat3(modelMatrix) * wxObjectNormal);
  #ifdef WX_REFLECT
    vWxReflUv = wxReflectionMatrix * wxWorld;
  #endif
}
`;

const FRAGMENT_PARS = /* glsl */ `
varying vec3 vWxPos;
varying vec3 vWxNormal;
varying vec4 vWxSeed;
uniform float wxTime;
uniform float wxWet;
uniform float wxRain;
uniform vec4 wxAmount;
uniform float wxPuddleLevel;
uniform vec2 wxFog;
uniform float wxTile;
#ifdef WX_REFLECT
  uniform sampler2D wxReflection;
  uniform float wxReflectionOn;
  varying vec4 vWxReflUv;
#endif
${NOISE_GLSL}
vec3 wxBump(vec3 surfacePosition, vec3 surfaceNormal, float height) {
  vec2 dH = vec2(dFdx(height), dFdy(height));
  vec3 sigmaX = dFdx(surfacePosition), sigmaY = dFdy(surfacePosition);
  vec3 r1 = cross(sigmaY, surfaceNormal), r2 = cross(surfaceNormal, sigmaX);
  float det = dot(sigmaX, r1);
  vec3 gradient = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * surfaceNormal - gradient);
}
#ifdef WX_HEX
// Stochastic tiling on a triangle grid (Heitz and Neyret 2018). The three samples are
// blended with the variance-preserving operator around the texture mean; the histogram
// Gaussianisation of the paper is left out, which is a close match for concrete.
void wxTriangleGrid(vec2 uv, out vec3 weights, out vec2 o1, out vec2 o2, out vec2 o3) {
  const mat2 toSkewed = mat2(1.0, 0.0, -0.57735027, 1.15470054);
  vec2 skewed = toSkewed * (uv * 3.4641016);
  vec2 base = floor(skewed);
  vec3 f = vec3(fract(skewed), 0.0);
  f.z = 1.0 - f.x - f.y;
  vec2 v1, v2, v3;
  if (f.z > 0.0) {
    weights = vec3(f.z, f.y, f.x);
    v1 = base; v2 = base + vec2(0.0, 1.0); v3 = base + vec2(1.0, 0.0);
  } else {
    weights = vec3(-f.z, 1.0 - f.y, 1.0 - f.x);
    v1 = base + vec2(1.0, 1.0); v2 = base + vec2(1.0, 0.0); v3 = base + vec2(0.0, 1.0);
  }
  o1 = wxHash2(v1); o2 = wxHash2(v2); o3 = wxHash2(v3);
}
vec4 wxStochastic(sampler2D tex, vec2 uv) {
  vec3 w; vec2 o1, o2, o3;
  wxTriangleGrid(uv, w, o1, o2, o3);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 mean = textureLod(tex, uv, 12.0);
  vec4 blended = w.x * (textureGrad(tex, uv + o1, dx, dy) - mean)
               + w.y * (textureGrad(tex, uv + o2, dx, dy) - mean)
               + w.z * (textureGrad(tex, uv + o3, dx, dy) - mean);
  return clamp(blended / length(w) + mean, 0.0, 1.0);
}
#endif
#if WX_LEVEL >= 1
// Rings spreading from raindrop impacts. Returns the slope of the water surface in xz.
vec2 wxRippleLayer(vec2 p, float rate, float seed) {
  vec2 cell = floor(p), f = fract(p), slope = vec2(0.0);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 id = cell + o + seed;
      float clock = wxTime * rate + wxHash(id + 3.7);
      float age = fract(clock);
      vec2 centre = o + 0.5 + (wxHash2(id + floor(clock) * vec2(7.1, 3.3)) - 0.5) * 0.7;
      vec2 d = f - centre;
      float r = length(d);
      float x = (r - age * 0.85) * 36.0;
      float fade = (1.0 - age) * (1.0 - age);
      slope += d / max(r, 0.0001) * sin(x) * exp(-x * x * 0.3) * fade;
    }
  return slope;
}
vec2 wxRipples(vec2 p) {
  vec2 slope = wxRippleLayer(p * 1.9, 1.1, 0.0) * 0.55;
  #if WX_LEVEL >= 2
    slope += wxRippleLayer(p * 3.1 + 4.2, 1.6, 17.0) * 0.35;
  #endif
  return slope;
}
#endif
`;

const FRAGMENT_MAP = /* glsl */ `
#if defined(USE_MAP) && defined(WX_HEX)
  diffuseColor *= wxStochastic(map, vMapUv);
#elif defined(USE_MAP)
  diffuseColor *= texture2D(map, vMapUv);
#endif
`;

const FRAGMENT_ROUGHNESS = /* glsl */ `
float roughnessFactor = roughness;
#if defined(USE_ROUGHNESSMAP) && defined(WX_HEX)
  roughnessFactor *= wxStochastic(roughnessMap, vRoughnessMapUv).g;
#elif defined(USE_ROUGHNESSMAP)
  roughnessFactor *= texture2D(roughnessMap, vRoughnessMapUv).g;
#endif
`;

const FRAGMENT_SURFACE = /* glsl */ `
#if defined(USE_NORMALMAP_TANGENTSPACE) && defined(WX_HEX)
  vec3 mapN = wxStochastic(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize(tbn * mapN);
#else
  #include <normal_fragment_maps>
#endif
float wxPuddle = 0.0;
float wxFacingUp = 0.0;
vec2 wxWaterSlope = vec2(0.0);
{
  vec3 wxN = normalize(vWxNormal);
  vec3 wxP = vWxPos;
  float wxSide = 1.0 - smoothstep(0.35, 0.8, abs(wxN.y));
  wxFacingUp = smoothstep(0.6, 0.92, wxN.y);
  vec2 wxPlane = abs(wxN.y) > 0.6 ? wxP.xz : (abs(wxN.x) > abs(wxN.z) ? wxP.zy : wxP.xy);
  float wxHeight = 0.0;

  #ifdef USE_INSTANCING
    diffuseColor.rgb *= 1.0 + (vWxSeed.x - 0.5) * WX_TONE;
    diffuseColor.rgb *= mix(vec3(0.965, 1.0, 1.04), vec3(1.04, 1.0, 0.955), vWxSeed.z);
    roughnessFactor = clamp(roughnessFactor + (vWxSeed.w - 0.5) * 0.16, 0.04, 1.0);
  #endif

  #if WX_LEVEL >= 2 && defined(WX_WEATHERED)
    float wxMacro = wxFbm3(wxP * 0.23);
    float wxFine = wxFbm3(wxP * 1.9 + 7.3);
    diffuseColor.rgb *= mix(0.82, 1.12, wxMacro);

    #ifdef WX_STRUCTURE
      float wxAbove = max(wxP.y, 0.0);
      // Splashed mud at the foot of a wall.
      float wxGrime = (1.0 - smoothstep(0.0, 0.5 + 0.9 * wxMacro, wxAbove + (wxFine - 0.5) * 0.5))
        * wxSide * wxAmount.x;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.35, 0.27), wxGrime * 0.8);
      roughnessFactor = mix(roughnessFactor, 0.96, wxGrime * 0.7);
      // Leak streaks that start under the cap and thin out on the way down.
      float wxStreakNoise = wxNoise(vec2(wxPlane.x * 5.0 + vWxSeed.y * 31.0, wxP.y * 0.22));
      float wxStreak = smoothstep(0.56, 0.9, wxStreakNoise) * (0.3 + 0.7 * wxFine)
        * smoothstep(0.1, 2.3, wxAbove) * wxSide * wxAmount.y;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.45, 0.43, 0.39), wxStreak * 0.85);
      float wxMossBias = (1.0 - smoothstep(0.0, 1.2, wxAbove)) * 0.2 + wxFacingUp * 0.16;
    #else
      // Floor slabs gather dirt and growth along their joints.
      vec2 wxJoint = (0.5 - abs(fract(wxP.xz / wxTile + 0.5) - 0.5)) * wxTile;
      float wxSeam = 1.0 - smoothstep(0.0, 0.16 + 0.2 * wxFine, min(wxJoint.x, wxJoint.y));
      #ifdef WX_TERRAIN
        wxSeam = 0.0;
      #endif
      float wxDirt = smoothstep(0.5, 0.8, wxFbm(wxP.xz * 0.37 + 5.0) + wxSeam * 0.25) * wxAmount.x;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.44, 0.36), wxDirt * 0.7);
      roughnessFactor = mix(roughnessFactor, 0.95, wxDirt * 0.6);
      float wxMossBias = wxSeam * 0.16;
    #endif

    float wxMossField = wxFbm3(wxP * vec3(0.7, 0.45, 0.7) + 3.1) + wxMossBias + (wxFine - 0.5) * 0.3;
    float wxMoss = smoothstep(0.66, 0.78, wxMossField) * wxAmount.z
      * (0.5 + 0.5 * smoothstep(0.3, 0.65, wxNoise(wxPlane * 17.0)));
    vec3 wxMossColor = mix(vec3(0.035, 0.05, 0.02), vec3(0.1, 0.125, 0.045), wxNoise(wxPlane * 9.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, wxMossColor, wxMoss * 0.93);
    roughnessFactor = mix(roughnessFactor, 0.97, wxMoss);
    wxHeight += wxMoss * (0.4 + 0.6 * wxNoise(wxPlane * 31.0)) * 0.014;

    #if WX_LEVEL >= 2
      float wxCracked = smoothstep(0.5, 0.7, vWxSeed.y) * wxAmount.w;
      if (wxCracked > 0.0) {
        vec2 wxWarp = vec2(wxNoise(wxPlane * 3.1), wxNoise(wxPlane * 3.1 + 5.2)) - 0.5;
        vec2 wxCrackUv = wxPlane * 0.62 + wxWarp * 0.1 + vWxSeed.zw * 13.0;
        float wxEdge = wxVoronoiEdge(wxCrackUv);
        // Hairline width in metres, widened to a pixel so distant cracks do not shimmer.
        float wxHair = max(0.0035, fwidth(wxEdge) * 0.9);
        float wxCrack = (1.0 - smoothstep(wxHair * 0.4, wxHair, wxEdge))
          * smoothstep(0.5, 0.62, wxFbm(wxPlane * 0.45 + vWxSeed.xy * 9.0))
          * min(1.0, 0.0035 / wxHair * 1.6) * wxCracked;
        diffuseColor.rgb *= 1.0 - 0.7 * wxCrack;
        roughnessFactor = mix(roughnessFactor, 1.0, wxCrack);
        wxHeight -= wxCrack * 0.0025;
      }
    #endif
  #endif

  if (wxWet > 0.001) {
    // Undersides stay sheltered. Porous surfaces darken, every surface gains a thin film.
    float wxFilm = wxWet * smoothstep(-0.6, 0.1, wxN.y);
    diffuseColor.rgb *= mix(1.0, WX_WET_DARKEN, wxFilm * (1.0 - metalnessFactor));
    roughnessFactor = mix(roughnessFactor, roughnessFactor * WX_WET_GLOSS + 0.03, wxFilm);
    #if WX_LEVEL >= 1 && defined(USE_INSTANCING)
      float wxRun = wxNoise(vec2(wxPlane.x * 11.0,
        wxP.y * 1.6 + wxTime * 1.3 + wxNoise(vec2(wxPlane.x * 3.0, 0.5)) * 4.0));
      wxRun = smoothstep(0.64, 0.92, wxRun) * wxSide * wxFilm * wxRain;
      roughnessFactor = mix(roughnessFactor, 0.06, wxRun * 0.8);
      wxHeight += wxRun * 0.004;
    #endif
  }
  #if WX_LEVEL >= 1
    if (wxHeight != 0.0) normal = wxBump(-vViewPosition, normal, wxHeight);
  #endif
  #ifdef WX_PUDDLES
    if (wxWet > 0.001) {
      float wxPool = wxFbm(wxP.xz * 0.19 + 11.0) + (wxNoise(wxP.xz * 1.7) - 0.5) * 0.06;
      float wxDamp = smoothstep(wxPuddleLevel - 0.16, wxPuddleLevel, wxPool) * wxFacingUp * wxWet;
      wxPuddle = smoothstep(wxPuddleLevel, wxPuddleLevel + 0.035, wxPool) * wxFacingUp * wxWet;
      diffuseColor.rgb *= mix(1.0, 0.72, max(wxDamp * 0.6, wxPuddle));
      roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, wxDamp);
      roughnessFactor = mix(roughnessFactor, 0.03, wxPuddle);
      #if WX_LEVEL >= 1
        wxWaterSlope = wxRipples(wxP.xz) * wxRain;
      #endif
      vec3 wxWater = normalize(vec3(-wxWaterSlope.x * 0.35, 1.0, -wxWaterSlope.y * 0.35));
      normal = normalize(mix(normal, normalize((viewMatrix * vec4(wxWater, 0.0)).xyz), wxPuddle));
    }
  #endif
}
`;

// The floor is a plane, so a mirrored render of the scene is the exact specular answer for it.
// It replaces the environment-map radiance and still passes through the split-sum BRDF.
const FRAGMENT_REFLECTION = /* glsl */ `
#ifdef WX_REFLECT
  if (wxReflectionOn > 0.5 && wxFacingUp > 0.0) {
    vec3 wxWorldNormal = inverseTransformDirection(normal, viewMatrix);
    vec2 wxReflUv = vWxReflUv.xy / vWxReflUv.w + wxWorldNormal.xz * 0.045;
    vec3 wxMirror = textureLod(wxReflection, wxReflUv, material.roughness * 7.0).rgb;
    float wxMirrorMix = wxFacingUp * (1.0 - smoothstep(0.12, 0.5, material.roughness));
    radiance = mix(radiance, wxMirror, wxMirrorMix);
  }
#endif
#include <lights_fragment_end>
`;

const FRAGMENT_FOG = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    // Exponential height fog, integrated analytically along the view ray, on top of the scene fog.
    float wxEyeY = abs(cameraPosition.y), wxHitY = max(vWxPos.y, 0.0);
    float wxEye = exp(-wxFog.y * wxEyeY), wxHit = exp(-wxFog.y * wxHitY);
    float wxRise = wxHitY - wxEyeY;
    float wxMean = abs(wxRise) > 0.01 ? (wxEye - wxHit) / (wxFog.y * wxRise) : wxEye;
    float wxDepth = fogDensity * vFogDepth;
    float fogFactor = 1.0 - exp(-wxDepth * wxDepth - wxFog.x * distance(vWxPos, cameraPosition) * wxMean);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
`;

const DEFINES: Record<SurfaceProfile, string[]> = {
  structure: [
    "WX_UV_JITTER",
    "WX_WEATHERED",
    "WX_STRUCTURE",
    "WX_TONE 0.22",
    "WX_WET_DARKEN 0.66",
    "WX_WET_GLOSS 0.45",
  ],
  ground: [
    "WX_UV_JITTER",
    "WX_WEATHERED",
    "WX_PUDDLES",
    "WX_TONE 0.16",
    "WX_WET_DARKEN 0.64",
    "WX_WET_GLOSS 0.7",
  ],
  terrain: [
    "WX_HEX",
    "WX_WEATHERED",
    "WX_TERRAIN",
    "WX_PUDDLES",
    "WX_TONE 0.0",
    "WX_WET_DARKEN 0.6",
    "WX_WET_GLOSS 0.7",
  ],
  metal: ["WX_TONE 0.12", "WX_WET_DARKEN 0.85", "WX_WET_GLOSS 0.4"],
  prop: ["WX_TONE 0.1", "WX_WET_DARKEN 0.72", "WX_WET_GLOSS 0.45"],
};

interface Patch {
  profile: SurfaceProfile;
}

/** Applies and re-tunes the patches. One instance serves every material in the scene. */
export class SurfaceWeathering {
  private patched = new Map<THREE.Material, Patch>();
  private level: DetailLevel = 2;
  private reflect = false;
  constructor(readonly uniforms: WeatherUniforms) {}

  /** Patch every recognised material below `root`. Safe to call again after a rebuild. */
  apply(root: THREE.Object3D) {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        this.patch(material);
    });
  }

  setDetail(level: DetailLevel, reflect: boolean) {
    if (level === this.level && reflect === this.reflect) return;
    this.level = level;
    this.reflect = reflect;
    for (const material of this.patched.keys()) material.needsUpdate = true;
  }

  private patch(material: THREE.Material) {
    if (this.patched.has(material) || !(material as THREE.MeshStandardMaterial).isMeshStandardMaterial)
      return;
    const profile = profileFor(material);
    if (!profile) return;
    this.patched.set(material, { profile });
    const key = () => `wx:${profile}:${this.level}:${profile === "ground" && this.reflect ? 1 : 0}`;
    material.customProgramCacheKey = key;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      const defines = [...DEFINES[profile], `WX_LEVEL ${this.level}`];
      if (profile === "ground" && this.reflect) defines.push("WX_REFLECT");
      const header = defines.map((define) => `#define ${define}`).join("\n") + "\n";
      shader.vertexShader = (header + shader.vertexShader)
        .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
        .replace("#include <uv_vertex>", `#include <uv_vertex>\n${VERTEX_UV}`)
        .replace("#include <project_vertex>", `#include <project_vertex>\n${VERTEX_WORLD}`);
      shader.fragmentShader = (header + shader.fragmentShader)
        .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}`)
        .replace("#include <map_fragment>", FRAGMENT_MAP)
        .replace("#include <roughnessmap_fragment>", FRAGMENT_ROUGHNESS)
        .replace("#include <normal_fragment_maps>", FRAGMENT_SURFACE)
        .replace("#include <lights_fragment_end>", FRAGMENT_REFLECTION)
        .replace("#include <fog_fragment>", FRAGMENT_FOG);
    };
    material.needsUpdate = true;
  }
}
