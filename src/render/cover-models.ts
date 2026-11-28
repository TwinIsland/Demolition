import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAPS } from "../core/maps";
import { mapObstacles } from "../core/cover-layout";
import { TILE_SIZE } from "../core/geometry";
import { BUILT_CRATE, resolveObstacles, type Obstacle } from "../core/obstacles";
import type { MaterialLibrary } from "./materials";

/**
 * Models that are not destructible obstacles: permanent-wall variants, fitted to a tile like an
 * obstacle, and scenery that stands outside the grid at its authored size.
 */
const SCENERY = {
  // Scanned plants and rocks, at the size they were photographed; the theme scales them.
  "fern-a": undefined,
  "fern-b": undefined,
  "fern-c": undefined,
  "calathea-a": undefined,
  "calathea-b": undefined,
  "anthurium-a": undefined,
  "anthurium-b": undefined,
  "shrub-a": undefined,
  "shrub-b": undefined,
  "rock-a": undefined,
  "rock-b": undefined,
  "rock-c": undefined,
  "rock-d": undefined,
  // The village: models of the KayKit packs at the size they stand in the game (tools/model-import/kaykit.mjs).
  "village-house-a": undefined,
  "village-house-b": undefined,
  "village-house-c": undefined,
  "village-tavern": undefined,
  "village-market": undefined,
  "village-archery": undefined,
  "village-barracks": undefined,
  "village-church": undefined,
  "village-blacksmith": undefined,
  "village-windmill": undefined,
  "village-tower": undefined,
  "village-well": undefined,
  // A Minecraft jukebox block (tools/model-import/jukebox.py).
  "village-jukebox": undefined,
  "village-castle": undefined,
  "village-crypt": undefined,
  "village-wall": undefined,
  "village-gate": undefined,
  "village-block": undefined,
  "village-low-wall": undefined,
  "village-lantern": undefined,
  "village-notice": undefined,
  "village-arch": undefined,
  "village-grave-a": undefined,
  "village-grave-b": undefined,
  "village-grave-c": undefined,
  "village-tree-a": undefined,
  "village-tree-b": undefined,
  "village-rock-a": undefined,
  "village-rock-b": undefined,
  "village-flag": undefined,
  "village-hills": undefined,
  "village-hills-b": undefined,
  "village-mountain": undefined,
  "village-mountain-b": undefined,
  "village-forest": undefined,
  "village-forest-b": undefined,
  "village-field": undefined,
} satisfies Record<string, { footprint: number; height: number } | undefined>;
export type SceneryId = keyof typeof SCENERY;

/**
 * Obstacle models for every map, loaded once before the arena combines
 * identical meshes into instance batches. Built-in presets and models shipped
 * by a map go through the same fit and the same surface palette.
 */
export class CoverModels {
  readonly ready: Promise<void[]>;
  readonly builtCrate = resolveObstacles([{ use: BUILT_CRATE, weight: 1 }])[0];
  private templates = new Map<string, THREE.Group>();
  constructor(
    manager: THREE.LoadingManager,
    private materials: MaterialLibrary,
  ) {
    const loader = new GLTFLoader(manager);
    const wanted = new Map<string, Obstacle>();
    wanted.set(BUILT_CRATE, this.builtCrate);
    for (const map of MAPS) for (const obstacle of mapObstacles(map)) wanted.set(obstacle.id, obstacle);
    const load = async (id: string, url: string, fit?: { footprint: number; height: number }) => {
      const { scene } = await loader.loadAsync(url);
      materials.applyPalette(scene);
      const model = new THREE.Group();
      model.add(scene);
      // Village pieces are authored in place, around the middle of their footprint.
      if (!fit && id.startsWith("scenery:") && !id.startsWith("scenery:village-")) {
        // Scans come half buried and off centre; stand them on the origin.
        const bounds = new THREE.Box3().setFromObject(scene);
        const center = bounds.getCenter(new THREE.Vector3());
        scene.position.set(-center.x, -bounds.min.y, -center.z);
      }
      if (fit) {
        const bounds = new THREE.Box3().setFromObject(scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = Math.min((fit.footprint * TILE_SIZE) / Math.max(size.x, size.z), fit.height / size.y);
        scene.scale.multiplyScalar(scale);
        scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      }
      scene.traverse((part) => {
        if (part instanceof THREE.Mesh) part.castShadow = part.receiveShadow = true;
      });
      this.templates.set(id, model);
    };
    this.ready = Promise.all(
      [
        ...[...wanted.values()].map((obstacle) => load(obstacle.id, obstacle.model, obstacle)),
        ...Object.entries(SCENERY).map(([id, fit]) =>
          load(`scenery:${id}`, `./assets/scenery/${id}.glb`, fit),
        ),
      ].map((task) => task.catch((error) => console.error("Obstacle model failed to load", error))),
    );
  }
  /** A wall variant or a piece of scenery; an empty group stands in when its model failed to load. */
  scenery(id: SceneryId) {
    return this.templates.get(`scenery:${id}`)?.clone(true) ?? new THREE.Group();
  }
  /** One named piece of a model that was exported cut up, such as one tile of a building. */
  part(id: SceneryId, name: string) {
    const piece = this.templates.get(`scenery:${id}`)?.getObjectByName(name)?.clone(true);
    const group = new THREE.Group();
    if (piece) group.add(piece);
    return group;
  }
  instance(obstacle: Obstacle) {
    return this.templates.get(obstacle.id)?.clone(true);
  }
  dispose() {
    const owned = new Set<THREE.Material>();
    const maps = new Set<THREE.Texture>();
    this.templates.forEach((root) =>
      root.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        part.geometry.dispose();
        // Palette materials belong to the material library.
        for (const mat of Array.isArray(part.material) ? part.material : [part.material])
          if (!this.materials.palette(mat.name)) owned.add(mat);
      }),
    );
    owned.forEach((mat) => {
      for (const value of Object.values(mat)) if (value instanceof THREE.Texture) maps.add(value);
      mat.dispose();
    });
    maps.forEach((map) => map.dispose());
    this.templates.clear();
  }
}
