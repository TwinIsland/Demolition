/** Procedural noise shared by the weathering, wetness and rain shaders. All names carry the `wx` prefix. */
export const NOISE_GLSL = /* glsl */ `
float wxHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 wxHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float wxHash3(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float wxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), f.x),
             mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wxNoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(wxHash3(i), wxHash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(wxHash3(i + vec3(0.0, 1.0, 0.0)), wxHash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y);
  float b = mix(mix(wxHash3(i + vec3(0.0, 0.0, 1.0)), wxHash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(wxHash3(i + vec3(0.0, 1.0, 1.0)), wxHash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y);
  return mix(a, b, f.z);
}
float wxFbm(vec2 p) {
  float sum = 0.0, weight = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += weight * wxNoise(p);
    p = p * 2.03 + 17.1;
    weight *= 0.5;
  }
  return sum / 0.9375;
}
float wxFbm3(vec3 p) {
  float sum = 0.0, weight = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += weight * wxNoise3(p);
    p = p * 2.03 + 11.7;
    weight *= 0.5;
  }
  return sum / 0.875;
}
/** Distance to the nearest Voronoi cell border. */
float wxVoronoiEdge(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  vec2 nearest = vec2(0.0), nearestOffset = vec2(0.0);
  float best = 8.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 r = o + wxHash2(cell + o) - f;
      float d = dot(r, r);
      if (d < best) { best = d; nearest = r; nearestOffset = o; }
    }
  float edge = 8.0;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) {
      vec2 o = nearestOffset + vec2(float(i), float(j));
      vec2 r = o + wxHash2(cell + o) - f;
      vec2 between = r - nearest;
      if (dot(between, between) > 0.0001)
        edge = min(edge, dot(0.5 * (nearest + r), normalize(between)));
    }
  return edge;
}
`;
