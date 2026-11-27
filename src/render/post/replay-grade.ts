import { Uniform } from "three";
import { Effect, EffectAttribute } from "postprocessing";

/**
 * One gather pass, 18 taps on a golden-angle spiral. The radius follows the circle of confusion
 * at the centre pixel; each tap is weighted by its own, so what is in focus does not smear into
 * the blur behind it. Taps are dealt to red, green and blue in turn and shifted along the screen
 * radius, which gives the fringing without further samples. Runs on the scene-linear image.
 *
 * `confusion` comes in two forms. With scene depth it is the distance from the focal plane. The
 * composer cannot hand out depth from multisampled buffers, so without it the blur grows with
 * the distance from the middle of the picture, where the replay keeps its subject.
 */
const shader = (depth: boolean) => /* glsl */ `
uniform float strength;
uniform float focus;

${
  depth
    ? `float confusion(const in vec2 point) {
  float away = -getViewZ(readDepth(point));
  return clamp(abs(away - focus) / (focus * 0.9) - 0.12, 0.0, 1.0);
}`
    : `float confusion(const in vec2 point) {
  vec2 off = (point - 0.5) * vec2(aspect, 1.0);
  return clamp((length(off) - 0.2) / 0.5, 0.0, 1.0);
}`
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 fromCentre = uv - 0.5;
  float edge = dot(fromCentre, fromCentre);
  vec2 fringe = fromCentre * edge * 0.014 * strength;
  float radius = confusion(uv) * strength * resolution.y * 0.009;
  vec3 sum = vec3(0.0);
  vec3 weight = vec3(0.0);
  for (int i = 0; i < 18; i++) {
    float n = float(i);
    float angle = n * 2.39996323;
    vec2 offset = vec2(cos(angle), sin(angle)) * sqrt((n + 0.5) / 18.0) * radius * texelSize;
    int channel = i - 3 * (i / 3);
    vec3 mask = vec3(channel == 0, channel == 1, channel == 2);
    vec2 tap = uv + offset + fringe * float(channel - 1);
    float w = 0.2 + confusion(tap);
    sum += texture2D(inputBuffer, tap).rgb * mask * w;
    weight += mask * w;
  }
  vec3 color = sum / weight;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 graded = mix(vec3(luma), color, 0.74) * vec3(0.95, 1.0, 1.07);
  graded *= 1.0 - 0.55 * smoothstep(0.1, 0.5, edge);
  outputColor = vec4(mix(color, graded, strength), inputColor.a);
}`;

/** The killcam's lens: depth of field around a focus distance, chromatic fringing and a cool grade. */
export class ReplayGradeEffect extends Effect {
  /** `depth`: the composer can provide scene depth, so the blur can follow real distance. */
  constructor(depth: boolean) {
    super("ReplayGradeEffect", shader(depth), {
      attributes: depth ? EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH : EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ["strength", new Uniform(0)],
        ["focus", new Uniform(5)],
      ]),
    });
  }

  /** `strength` is 0..1; `focus` is the distance from the camera, in world units, that stays sharp. */
  set(strength: number, focus: number) {
    this.uniforms.get("strength")!.value = strength;
    this.uniforms.get("focus")!.value = Math.max(0.5, focus);
  }
}
