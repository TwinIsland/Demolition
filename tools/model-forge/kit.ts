import * as THREE from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Small modelling kit for the game's props. Every part is tagged with a shared
 * palette material and unwrapped at one texel density, so separately built
 * models read as one family once the game applies its surface library.
 */
export type Vec3 = readonly [number, number, number];
export interface Place {
  at?: Vec3;
  /** Euler angles in radians, applied in XYZ order. */
  rot?: Vec3;
  scale?: Vec3 | number;
}
/** Approximate colours, written into the GLB so other viewers show a sensible preview. */
const PREVIEW: Record<string, string> = {
  planks: "#a08a6c",
  "planks-dark": "#6f5c48",
  endgrain: "#b39a72",
  bark: "#6b5d4c",
  "paint-olive": "#4c5a3a",
  "paint-graphite": "#3a3f40",
  "paint-sand": "#a89a76",
  "paint-yellow": "#c9981f",
  "paint-red": "#963a2c",
  "paint-slate": "#687a82",
  "paint-ivory": "#d2ccb6",
  "paint-teal": "#2c6f73",
  hazard: "#c9981f",
  steel: "#9a9c98",
  "steel-dark": "#2c2f30",
  "steel-blade": "#a9aeb0",
  burlap: "#a8956d",
  "burlap-olive": "#6f7150",
  rubber: "#1f2020",
  concrete: "#9c9a90",
  glass: "#18262b",
  ground: "#5f5a40",
  "foliage-oak": "#55683a",
  "foliage-pine": "#3d5446",
  "foliage-jungle": "#33552f",
  "jungle-bark": "#6f6a55",
  "moss-rock": "#7b8068",
  "ruin-stone": "#4f4a40",
  moss: "#4c6a2c",
  leaf: "#3f7a2c",
  "leaf-dark": "#2f5a2a",
  "pool-tile": "#eef2f0",
  cardboard: "#a98554",
};

export function seeded(seed: number) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matrixOf = ({ at = [0, 0, 0], rot = [0, 0, 0], scale = 1 }: Place) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...at),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    typeof scale === "number"
      ? new THREE.Vector3(scale, scale, scale)
      : new THREE.Vector3(...scale),
  );

export class Forge {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  private stack = [new THREE.Matrix4()];
  private count = 0;
  /** @param texel World units covered by one texture repeat. */
  constructor(
    readonly name: string,
    private texel = 2,
  ) {}

  /** Run `build` inside a local frame. */
  frame(place: Place, build: () => void) {
    this.stack.push(
      this.stack[this.stack.length - 1].clone().multiply(matrixOf(place)),
    );
    build();
    this.stack.pop();
    return this;
  }

  /** Add any geometry. `wrapped` keeps UVs the caller already scaled to world units. */
  add(
    material: string,
    source: THREE.BufferGeometry,
    place: Place = {},
    wrapped = false,
  ) {
    const geometry = source.index ? source.toNonIndexed() : source;
    for (const name of Object.keys(geometry.attributes))
      if (name !== "position" && name !== "normal" && name !== "uv")
        geometry.deleteAttribute(name);
    geometry.clearGroups();
    geometry.applyMatrix4(
      this.stack[this.stack.length - 1].clone().multiply(matrixOf(place)),
    );
    if (!wrapped) this.boxProject(geometry);
    const list = this.parts.get(material) ?? [];
    list.push(geometry);
    this.parts.set(material, list);
    return this;
  }

  /** Planar projection per triangle along its dominant axis; each part gets its own offset. */
  private boxProject(geometry: THREE.BufferGeometry) {
    const position = geometry.attributes.position,
      uv = new Float32Array(position.count * 2);
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      n = new THREE.Vector3();
    const shift = (++this.count * 0.37) % 1;
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      n.crossVectors(b.clone().sub(a), c.clone().sub(a));
      const ax = Math.abs(n.x),
        ay = Math.abs(n.y),
        az = Math.abs(n.z);
      [a, b, c].forEach((p, k) => {
        const [u, v] =
          ax >= ay && ax >= az
            ? [p.z, p.y]
            : ay >= az
              ? [p.x, p.z]
              : [p.x, p.y];
        uv[(i + k) * 2] = u / this.texel + shift;
        uv[(i + k) * 2 + 1] = v / this.texel + shift * 0.61;
      });
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }

  /** Scale a revolved surface's unit UVs to world size. Flat ends are projected instead. */
  private wrap(geometry: THREE.BufferGeometry, around: number, along: number) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const uv = g.attributes.uv,
      normal = g.attributes.normal,
      position = g.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(normal.getY(i)) > 0.999)
        uv.setXY(
          i,
          position.getX(i) / this.texel,
          position.getZ(i) / this.texel,
        );
      else
        uv.setXY(
          i,
          (uv.getX(i) * around) / this.texel,
          (uv.getY(i) * along) / this.texel,
        );
    }
    return g;
  }

  box(material: string, size: Vec3, place: Place = {}, bevel = 0.02) {
    const [w, h, d] = size;
    const radius = Math.min(bevel, w / 2, h / 2, d / 2);
    return this.add(
      material,
      radius > 0
        ? new RoundedBoxGeometry(w, h, d, 1, radius)
        : new THREE.BoxGeometry(w, h, d),
      place,
    );
  }
  cyl(
    material: string,
    top: number,
    bottom: number,
    height: number,
    place: Place = {},
    segments = 16,
    open = false,
  ) {
    const geometry = new THREE.CylinderGeometry(
      top,
      bottom,
      height,
      segments,
      1,
      open,
    );
    return this.add(
      material,
      this.wrap(geometry, 2 * Math.PI * Math.max(top, bottom), height),
      place,
      true,
    );
  }
  /** Hard-edged frustum with `sides` flat faces, e.g. a four-sided bin. */
  prism(
    material: string,
    top: number,
    bottom: number,
    height: number,
    sides: number,
    place: Place = {},
  ) {
    const geometry = new THREE.CylinderGeometry(
      top,
      bottom,
      height,
      sides,
      1,
    ).toNonIndexed();
    geometry.computeVertexNormals();
    return this.add(material, geometry, place);
  }
  /** Revolve a profile of [radius, y] points around the Y axis. */
  lathe(
    material: string,
    profile: readonly (readonly [number, number])[],
    place: Place = {},
    segments = 20,
  ) {
    const geometry = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      segments,
    );
    const lengths = [0];
    for (let j = 1; j < profile.length; j++)
      lengths.push(
        lengths[j - 1] +
          Math.hypot(
            profile[j][0] - profile[j - 1][0],
            profile[j][1] - profile[j - 1][1],
          ),
      );
    const around = 2 * Math.PI * Math.max(...profile.map((p) => p[0]));
    const uv = geometry.attributes.uv;
    for (let i = 0; i <= segments; i++)
      for (let j = 0; j < profile.length; j++)
        uv.setXY(
          i * profile.length + j,
          ((i / segments) * around) / this.texel,
          lengths[j] / this.texel,
        );
    return this.add(material, geometry, place, true);
  }
  sphere(material: string, radius: number, place: Place = {}, segments = 16) {
    const geometry = new THREE.SphereGeometry(
      radius,
      segments,
      Math.round(segments * 0.65),
    );
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        (uv.getX(i) * 2 * Math.PI * radius) / this.texel,
        (uv.getY(i) * Math.PI * radius) / this.texel,
      );
    return this.add(material, geometry, place, true);
  }
  torus(
    material: string,
    radius: number,
    tube: number,
    place: Place = {},
    segments = 20,
    arc = Math.PI * 2,
  ) {
    return this.add(
      material,
      new THREE.TorusGeometry(radius, tube, 6, segments, arc),
      place,
    );
  }
  /** Extrude an XY outline along Z, centred on Z. */
  extrude(
    material: string,
    outline: readonly (readonly [number, number])[],
    depth: number,
    place: Place = {},
    bevel = 0,
  ) {
    const shape = new THREE.Shape(
      outline.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - bevel * 2,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -depth / 2 + bevel);
    return this.add(material, geometry, place);
  }

  build() {
    const group = new THREE.Group();
    group.name = this.name;
    let triangles = 0;
    for (const [material, parts] of this.parts) {
      const merged = mergeVertices(mergeGeometries(parts), 1e-4);
      triangles += merged.index!.count / 3;
      const mesh = new THREE.Mesh(
        merged,
        new THREE.MeshStandardMaterial({
          name: `df:${material}`,
          color: PREVIEW[material] ?? "#888",
        }),
      );
      mesh.name = material;
      group.add(mesh);
    }
    const size = new THREE.Box3()
      .setFromObject(group)
      .getSize(new THREE.Vector3());
    group.userData = {
      triangles,
      size: size.toArray().map((v) => +v.toFixed(3)),
    };
    return group;
  }
}
