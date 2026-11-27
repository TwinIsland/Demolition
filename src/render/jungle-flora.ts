import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Geometry the rainforest builds in code: tall trees whose crowns are a few dozen leaf cards,
 * palms, dry-stone ruin walls and shafts of light. Scanned plants and rocks are loaded as models
 * instead; see `CoverModels`.
 *
 * Every function returns shared geometry for a given variant, so the arena's static batches draw
 * each kind once per chunk.
 */

/** Deterministic 0..1 sequence, so a variant always comes out the same. */
function sequence(seed: number) {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

class Builder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  vertex(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number) {
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.uvs.push(u, v);
    return this.positions.length / 3 - 1;
  }
  build(smooth = false) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    if (this.colors.length) geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    if (smooth) geometry.computeVertexNormals();
    return geometry;
  }
}

/** Height at which the overhead views cut a tree off, so it hides no more than a wall does. */
export const TREE_CUT = 2.9;
/** Metres of bark texture around a trunk and along it. */
const BARK_AROUND = 2;
const BARK_ALONG = 2.4;

/** A tube along a path, with a radius per point. Rings share a seam, which the bark hides. */
function tube(
  b: Builder,
  path: readonly THREE.Vector3[],
  radius: (t: number, angle: number) => number,
  sides: number,
) {
  const up = new THREE.Vector3(0, 1, 0),
    side = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    across = new THREE.Vector3(),
    p = new THREE.Vector3(),
    n = new THREE.Vector3();
  let length = 0;
  const first = b.positions.length / 3;
  path.forEach((centre, ring) => {
    const next = path[Math.min(ring + 1, path.length - 1)],
      previous = path[Math.max(ring - 1, 0)];
    forward.subVectors(next, previous).normalize();
    side.crossVectors(Math.abs(forward.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up, forward).normalize();
    across.crossVectors(forward, side);
    if (ring) length += centre.distanceTo(previous);
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      n.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle));
      p.copy(centre).addScaledVector(n, radius(ring / (path.length - 1), angle));
      b.vertex(p, n, (i / sides) * BARK_AROUND, length / BARK_ALONG);
    }
  });
  for (let ring = 0; ring < path.length - 1; ring++)
    for (let i = 0; i < sides; i++) {
      const a = first + ring * (sides + 1) + i,
        c = a + sides + 1;
      b.indices.push(a, a + 1, c, a + 1, c + 1, c);
    }
}

const trunks = new Map<string, THREE.BufferGeometry>();
/**
 * The woody part of a rainforest tree: a trunk on buttress roots, a few limbs that reach into
 * the crown and lianas hanging from them. `height` is where the crown starts.
 */
export function trunkGeometry(variant: number, height: number, girth: number, detail: "near" | "far") {
  const key = `${variant}:${height}:${girth}:${detail}`;
  const cached = trunks.get(key);
  if (cached) return cached;
  const random = sequence(variant * 31 + 7),
    b = new Builder(),
    near = detail === "near";
  const lean = new THREE.Vector2(random() - 0.5, random() - 0.5).multiplyScalar(0.9),
    fins = 4 + Math.floor(random() * 3),
    twist = random() * 6.28;
  const spine = (t: number) => new THREE.Vector3(lean.x * t * t, height * t, lean.y * t * t);
  const rings = near ? 9 : 4;
  // Rings crowd towards the ground, where the buttresses change the outline fastest.
  const path = Array.from({ length: rings + 1 }, (_, i) => spine((i / rings) ** 1.8));
  tube(
    b,
    path,
    (t, angle) => {
      const y = t ** 1.8 * height,
        flare = Math.exp(-y / 0.9),
        fin = Math.max(0, Math.cos(angle * fins + twist)) ** 3;
      return girth * (1 - 0.35 * t ** 1.8) * (1 + flare * (0.45 + 1.5 * fin));
    },
    near ? 14 : 7,
  );
  if (near) {
    // A lid where the overhead views cut the tree, so the cut shows wood and not a hollow shell.
    const centre = spine((TREE_CUT - 0.02) / height),
      n = new THREE.Vector3(0, 1, 0),
      hub = b.vertex(centre, n, 0.5, 0.5);
    const rim = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2,
        p = centre.clone().add(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(girth));
      return b.vertex(p, n, 0.5 + Math.cos(angle) * 0.2, 0.5 + Math.sin(angle) * 0.2);
    });
    rim.forEach((v, i) => b.indices.push(hub, rim[(i + 1) % 12], v));
  }
  const top = spine(1),
    limbs = near ? 5 : 3;
  for (let i = 0; i < limbs; i++) {
    const angle = (i / limbs) * 6.28 + random() * 0.9,
      reach = 2.2 + random() * 1.8,
      rise = 1.4 + random() * 1.6,
      out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const start = spine(0.86 + random() * 0.1);
    const limb = [0, 0.35, 0.7, 1].map((t) =>
      start
        .clone()
        .addScaledVector(out, reach * t)
        .add(new THREE.Vector3(0, rise * Math.sqrt(t), 0)),
    );
    tube(b, limb, (t) => girth * (0.42 - 0.3 * t), near ? 6 : 4);
    if (!near) continue;
    // A liana drops from the limb and stops above head height.
    const from = limb[2].clone().addScaledVector(out, random() * 0.6),
      drop = from.y - (3.1 + random() * 2.4),
      drift = new THREE.Vector3(random() - 0.5, 0, random() - 0.5).multiplyScalar(0.7);
    const vine = [0, 0.3, 0.65, 1].map((t) =>
      from
        .clone()
        .addScaledVector(drift, Math.sin(t * 3.1))
        .add(new THREE.Vector3(0, -drop * t, 0)),
    );
    tube(b, vine, () => 0.022 + random() * 0.006, 3);
  }
  // The limbs meet the trunk under a short stub that carries on into the leaves.
  tube(
    b,
    [top, top.clone().add(new THREE.Vector3(0, 1.6, 0))],
    (t) => girth * (0.65 - 0.4 * t),
    near ? 8 : 5,
  );
  const geometry = b.build();
  trunks.set(key, geometry);
  return geometry;
}

const crowns = new Map<string, THREE.BufferGeometry>();
/**
 * Leaf cards for a crown that starts at `height`: clumps set all over a flattened ball, each
 * facing away from its middle, so the crown looks full from the ground, from afar and from above.
 * Each card shows one of the four clumps on the crown atlas and has both faces.
 *
 * Shading normals point up and outwards on either face, so the underside takes the light of the
 * sky like leaves that let it through. Whether the overhead views see a crown at all is up to
 * its material; see the `canopy` surface profile.
 */
export function crownGeometry(variant: number, height: number, spread: number, cards: number) {
  const key = `${variant}:${height}:${spread}:${cards}`;
  const cached = crowns.get(key);
  if (cached) return cached;
  const random = sequence(variant * 53 + 11),
    b = new Builder();
  const centre = new THREE.Vector3(0, height + spread * 0.28, 0),
    out = new THREE.Vector3(),
    face = new THREE.Vector3(),
    right = new THREE.Vector3(),
    upward = new THREE.Vector3(),
    shade = new THREE.Vector3(),
    p = new THREE.Vector3(),
    corner = new THREE.Vector3();
  for (let i = 0; i < cards; i++) {
    // Even directions over the ball, with a few cards inside it to close the gaps.
    const y = 1 - ((i + 0.5) / cards) * 1.75,
      around = i * 2.39996 + random() * 0.4,
      flat = Math.sqrt(Math.max(0, 1 - y * y)),
      depth = i % 4 === 0 ? 0.45 + random() * 0.25 : 0.82 + random() * 0.18;
    out.set(Math.cos(around) * flat, y, Math.sin(around) * flat);
    p.copy(centre).add(
      new THREE.Vector3(out.x * spread, out.y * spread * 0.5, out.z * spread).multiplyScalar(depth),
    );
    face
      .copy(out)
      .add(new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.7))
      .normalize();
    right.crossVectors(
      face,
      Math.abs(face.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0),
    );
    right.normalize().applyAxisAngle(face, random() * 6.28);
    upward.crossVectors(face, right);
    shade
      .copy(out)
      .multiplyScalar(0.4)
      .add(new THREE.Vector3(0, 1, 0))
      .normalize();
    const size = spread * (0.36 + random() * 0.22),
      cell = Math.floor(random() * 4),
      u0 = (cell % 2) * 0.5,
      v0 = Math.floor(cell / 2) * 0.5;
    const quad = [
      [-1, -1, 0, 0.5],
      [1, -1, 0.5, 0.5],
      [1, 1, 0.5, 0],
      [-1, 1, 0, 0],
    ].map(([x, yy, u, v]) => {
      corner
        .copy(p)
        .addScaledVector(right, (x * size) / 2)
        .addScaledVector(upward, (yy * size) / 2);
      return b.vertex(corner, shade, u0 + u, v0 + v);
    });
    // Leaves deep in the crown and low on it sit in its shade; each clump also has its own green.
    const lit = (0.6 + 0.4 * Math.min(1, Math.max(0, y * 0.6 + 0.55))) * (0.7 + 0.3 * depth),
      warm = random();
    for (let k = 0; k < 4; k++) b.colors.push(lit * (0.92 + warm * 0.1), lit, lit * (0.92 - warm * 0.1));
    b.indices.push(quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]);
    b.indices.push(quad[0], quad[2], quad[1], quad[0], quad[3], quad[2]);
  }
  const geometry = b.build();
  crowns.set(key, geometry);
  return geometry;
}

/** Where one frond sits on the scanned fern sheet: left, top, width and height as fractions. */
const FROND = [0.305, 0.02, 0.15, 0.73] as const;
let palmLeaves: THREE.BufferGeometry | undefined;
/** The head of a palm: fronds that arch out of the top of a trunk `height` tall and droop. */
export function palmFronds(height: number) {
  if (palmLeaves) return palmLeaves;
  const random = sequence(97),
    b = new Builder(),
    segments = 5,
    up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 13; i++) {
    const angle = (i / 13) * 6.28 + random() * 0.4,
      length = 2.9 + random() * 1.1,
      lift = 0.5 + random() * 0.9,
      width = 0.85 + random() * 0.25;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      side = new THREE.Vector3().crossVectors(up, out);
    const rows: number[][] = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments,
        // Rises out of the crown shaft, then gravity takes the tip.
        y = height + lift * Math.sin(t * 2.2) - t * t * length * 0.42,
        centre = out
          .clone()
          .multiplyScalar(length * t * (1 - 0.15 * t))
          .setY(y),
        half = (width / 2) * Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI) ** 0.6 + 0.02,
        v = FROND[1] + FROND[3] * (1 - t);
      rows.push([
        b.vertex(
          centre
            .clone()
            .addScaledVector(side, -half)
            .add(new THREE.Vector3(0, -half * 0.3, 0)),
          up,
          FROND[0],
          v,
        ),
        b.vertex(centre, up, FROND[0] + FROND[2] / 2, v),
        b.vertex(
          centre
            .clone()
            .addScaledVector(side, half)
            .add(new THREE.Vector3(0, -half * 0.3, 0)),
          up,
          FROND[0] + FROND[2],
          v,
        ),
      ]);
    }
    for (let s = 0; s < segments; s++)
      for (let k = 0; k < 2; k++) {
        const a = rows[s][k],
          c = rows[s][k + 1],
          d = rows[s + 1][k],
          e = rows[s + 1][k + 1];
        b.indices.push(a, d, c, c, d, e);
      }
  }
  palmLeaves = b.build(true);
  return palmLeaves;
}
let palmStem: THREE.BufferGeometry | undefined;
export function palmTrunk(height: number) {
  if (palmStem) return palmStem;
  const b = new Builder();
  const path = [0, 0.3, 0.65, 1].map((t) => new THREE.Vector3(0.9 * t * t, height * t, 0.2 * t));
  tube(b, path, (t) => 0.2 - 0.07 * t + 0.1 * Math.exp(-t * 14), 7);
  palmStem = b.build();
  return palmStem;
}

/** Texture coordinates from position: one repeat every `metres`, on the plane each face looks along. */
function projectUv(geometry: THREE.BufferGeometry, metres: number, offset: THREE.Vector3) {
  const position = geometry.attributes.position,
    normal = geometry.attributes.normal,
    uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + offset.x,
      y = position.getY(i) + offset.y,
      z = position.getZ(i) + offset.z,
      ax = Math.abs(normal.getX(i)),
      ay = Math.abs(normal.getY(i)),
      az = Math.abs(normal.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x / metres, z / metres);
    else if (ax >= az) uv.setXY(i, z / metres, y / metres);
    else uv.setXY(i, x / metres, y / metres);
  }
}

const masonry = new Map<string, { stone: THREE.BufferGeometry; moss: THREE.BufferGeometry }>();
/**
 * A cell of ruined temple wall: courses of dressed blocks laid dry, each a little out of true,
 * with moss on whatever faces the rain. `broken` has lost its upper courses and left rubble.
 */
export function ruinWall(variant: number, broken: boolean) {
  const key = `${variant}:${broken}`;
  const cached = masonry.get(key);
  if (cached) return cached;
  const random = sequence(variant * 17 + (broken ? 5 : 3)),
    side = 2.32,
    stones: THREE.BufferGeometry[] = [],
    mosses: THREE.BufferGeometry[] = [];
  const block = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    turn: number,
    tilt = 0,
    mossy = true,
  ) => {
    const stone = new RoundedBoxGeometry(w, h, d, 1, 0.045);
    // Slide the texture per block, so neighbouring blocks never show the same patch of stone.
    projectUv(stone, 3, new THREE.Vector3(random() * 9, random() * 9, random() * 9));
    const place = new THREE.Matrix4()
      .makeTranslation(x, y + h / 2, z)
      .multiply(new THREE.Matrix4().makeRotationY(turn))
      .multiply(new THREE.Matrix4().makeRotationZ(tilt));
    stone.applyMatrix4(place);
    stones.push(stone);
    if (!mossy) return;
    const moss = new RoundedBoxGeometry(
      w * (0.7 + random() * 0.25),
      0.06,
      d * (0.7 + random() * 0.25),
      1,
      0.028,
    );
    moss.applyMatrix4(
      new THREE.Matrix4()
        .makeTranslation(x + (random() - 0.5) * w * 0.12, y + h + 0.012, z + (random() - 0.5) * d * 0.12)
        .multiply(new THREE.Matrix4().makeRotationY(turn)),
    );
    mosses.push(moss);
  };
  const heights = [0.86, 0.8, 0.82];
  let y = 0;
  heights.forEach((height, course) => {
    const alongX = course % 2 === 0,
      split = side * (0.36 + random() * 0.28),
      top = course === heights.length - 1,
      // The top of a course only shows, and only grows moss, where nothing lies on it.
      open = top || (broken && course === 1);
    for (const half of [0, 1]) {
      if (broken && course === 2) continue;
      if (broken && course === 1 && half === 1) continue;
      const length = half ? side - split : split,
        centre = half ? split / 2 : -(side - split) / 2,
        inset = random() * 0.07,
        deep = side - inset * 2 - random() * 0.05,
        turn = (random() - 0.5) * 0.045;
      if (alongX)
        block(length - 0.014, height - 0.012, deep, centre, y, (random() - 0.5) * 0.05, turn, 0, open);
      else block(deep, height - 0.012, length - 0.014, (random() - 0.5) * 0.05, y, centre, turn, 0, open);
    }
    y += height;
  });
  if (broken) {
    // What fell off: one block leaning on the base and smaller pieces beside it.
    block(0.95, 0.6, 0.8, 0.5, heights[0] - 0.02, 0.55, 0.5, 0.2, true);
    block(0.6, 0.42, 0.7, 0.62, heights[0] - 0.02, -0.5, -0.3, -0.12, false);
    mosses.push(
      new RoundedBoxGeometry(1.0, 0.06, 2.0, 1, 0.028).applyMatrix4(
        new THREE.Matrix4().makeTranslation(0.55, heights[0] + 0.012, 0),
      ),
    );
  }
  const result = { stone: mergeGeometries(stones)!, moss: mergeGeometries(mosses)! };
  stones.forEach((g) => g.dispose());
  mosses.forEach((g) => g.dispose());
  masonry.set(key, result);
  return result;
}

let shaft: THREE.BufferGeometry | undefined;
/** Two crossed sheets, one unit tall and one wide, standing on the origin. */
export function shaftGeometry() {
  if (shaft) return shaft;
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
    c = a.clone().rotateY(Math.PI / 2);
  shaft = mergeGeometries([a, c])!;
  a.dispose();
  c.dispose();
  return shaft;
}

/**
 * Sunlight made visible by the mist: a soft additive column. It thins out close to the camera so
 * walking through one never whites out the view, and disappears for cameras above the canopy.
 */
export function shaftMaterial(time: { value: number }, color: THREE.Color) {
  return new THREE.ShaderMaterial({
    name: "jungle-shaft",
    uniforms: { jsTime: time, jsColor: { value: color } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vSeed;
      void main() {
        vUv = uv;
        vec4 world = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          world = instanceMatrix * world;
          vSeed = fract(instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61);
        #else
          vSeed = 0.0;
        #endif
        world = modelMatrix * world;
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform float jsTime;
      uniform vec3 jsColor;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vSeed;
      void main() {
        float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
        // Streaks along the beam that drift slowly, as leaves move in front of the sun.
        float streak = 0.7 + 0.3 * sin(vUv.x * 9.0 + vSeed * 40.0 + sin(jsTime * 0.35 + vSeed * 9.0) * 1.6);
        float ends = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float near = smoothstep(1.5, 9.0, distance(vWorld, cameraPosition));
        float far = 1.0 - smoothstep(45.0, 80.0, distance(vWorld, cameraPosition));
        float under = 1.0 - smoothstep(10.0, 16.0, cameraPosition.y);
        float amount = across * across * (3.0 - 2.0 * across) * streak * ends * near * far * under;
        gl_FragColor = vec4(jsColor * amount, 1.0);
      }`,
  });
}
