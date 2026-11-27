import { Matrix4, Uniform, Vector2, type Camera } from "three";
import { Effect, EffectAttribute } from "postprocessing";
import type { DimensionState } from "../story/dimension-field";

/**
 * The look of the flat world: beyond the front the picture is rebuilt from square blocks that lie
 * on the ground, a few to a cell, each one flat colour from a short palette. The blocks belong to
 * the world, not to the screen, so they stay put under a moving camera. Close to the front every
 * block lets go at a moment of its own and flashes as it does, and the front itself is a bright
 * line running outwards.
 *
 * A block is found from the world position of the pixel. With scene depth that is exact. The
 * composer cannot hand out depth from multisampled buffers; without it the pixel is taken to lie
 * on the floor, which is true of the flat world and wrong for whatever already stands in front
 * of it, so that variant is faded out by `cover` as the camera comes down.
 */
const shader = (depth: boolean) => /* glsl */ `
uniform mat4 dmInverse;
uniform mat4 dmProject;
uniform vec2 dmOrigin;
uniform float dmFront;
uniform float dmBlock;
uniform float dmCover;
uniform float dmGlow;

float dmHash(const in vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 dmPalette(const in vec3 linear) {
  // Count the steps on a display-like curve, where equal steps look equal.
  vec3 c = sqrt(clamp(linear / (1.0 + linear), 0.0, 0.98));
  float luma = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(vec3(luma), c, 1.25);
  c = floor(c * 6.0 + 0.5) / 6.0;
  c = clamp(c * c, 0.0, 0.96);
  return c / (1.0 - c);
}

bool dmWorld(const in vec2 uv, out vec3 point) {
${
  depth
    ? `  float z = readDepth(uv);
  if (z >= 0.99999) return false;
  vec4 p = dmInverse * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
  point = p.xyz / p.w;
  return true;`
    : `  vec4 a = dmInverse * vec4(uv * 2.0 - 1.0, -1.0, 1.0);
  vec4 b = dmInverse * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 from = a.xyz / a.w;
  vec3 dir = b.xyz / b.w - from;
  if (dir.y > -0.00001 || from.y < 0.0) return false;
  point = from - dir * (from.y / dir.y);
  return true;`
}
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 point;
  if (!dmWorld(uv, point)) {
    outputColor = inputColor;
    return;
  }
  vec2 cell = floor(point.xz / dmBlock);
  vec2 centre = (cell + 0.5) * dmBlock;
  float away = distance(centre, dmOrigin);
  float own = dmHash(cell);
  // A band of loose blocks runs ahead of the front; each lets go at its own distance.
  float band = 2.0 + dmFront * 0.12;
  float held = step(dmFront + (own - 0.15) * band, away);
  float letting = (1.0 - held) * smoothstep(dmFront - band * 0.6, dmFront + band, away);

  // Four taps inside the block, so that one bright blade of grass does not colour all of it.
  vec3 tile = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 corner = centre + (vec2(float(i - 2 * (i / 2)), float(i / 2)) - 0.5) * dmBlock * 0.5;
    vec4 clip = dmProject * vec4(corner.x, point.y, corner.y, 1.0);
    tile += texture2D(inputBuffer, clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0)).rgb;
  }
  tile *= 0.25;
  // Blocks smaller than a screen pixel would only shimmer: far away, keep the palette alone.
  float fine = 1.0 - smoothstep(0.6, 1.6, max(fwidth(point.x), fwidth(point.z)) / dmBlock);
  vec3 flatColor = dmPalette(mix(inputColor.rgb, tile, fine));
  vec2 inside = fract(point.xz / dmBlock);
  float seam = min(min(inside.x, 1.0 - inside.x), min(inside.y, 1.0 - inside.y));
  flatColor *= 1.0 - 0.14 * fine * (1.0 - smoothstep(0.0, 0.1, seam));

  vec3 color = mix(inputColor.rgb, flatColor, held * dmCover);
  // The flash of a block that has just let go, and the line of the front.
  color += vec3(0.5, 0.95, 1.0) * letting * (0.35 + own) * dmGlow * dmCover;
  float line = exp(-abs(away - dmFront) / (dmBlock * 1.5 + dmFront * 0.02));
  color += vec3(0.3, 0.9, 1.0) * line * 1.6 * dmGlow * step(0.5, dmFront);
  outputColor = vec4(color, inputColor.a);
}`;

/** How the flat world is drawn this frame. */
export interface DimensionLook extends DimensionState {
  /** Side of a block in world units. */
  block: number;
  /** 0..1 strength of the flat look; the depth-free variant lowers it as the camera tilts. */
  cover: number;
  /** 0..1 brightness of the front line and of the blocks letting go. */
  glow: number;
}

export class DimensionLookEffect extends Effect {
  private view = new Matrix4();

  /** `depth`: the composer can provide scene depth, so blocks follow what is really drawn. */
  constructor(
    private camera: Camera,
    readonly depth: boolean,
  ) {
    super("DimensionLookEffect", shader(depth), {
      attributes: depth ? EffectAttribute.DEPTH : EffectAttribute.NONE,
      uniforms: new Map<string, Uniform>([
        ["dmInverse", new Uniform(new Matrix4())],
        ["dmProject", new Uniform(new Matrix4())],
        ["dmOrigin", new Uniform(new Vector2())],
        ["dmFront", new Uniform(0)],
        ["dmBlock", new Uniform(0.3)],
        ["dmCover", new Uniform(1)],
        ["dmGlow", new Uniform(0)],
      ]),
    });
  }

  set(look: DimensionLook) {
    const u = this.uniforms;
    u.get("dmOrigin")!.value.set(look.x, look.z);
    u.get("dmFront")!.value = look.front;
    u.get("dmBlock")!.value = look.block;
    u.get("dmCover")!.value = this.depth ? Math.min(1, look.cover * 4) : look.cover;
    u.get("dmGlow")!.value = look.glow;
  }

  /** The camera is final by the time the pass runs: take the frame's matrices from it. */
  override update() {
    const { camera, view } = this;
    view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    (this.uniforms.get("dmProject")!.value as Matrix4).copy(view);
    (this.uniforms.get("dmInverse")!.value as Matrix4).copy(view).invert();
  }
}
