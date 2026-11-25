import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAPS } from "../core/maps";
import { mapObstacles } from "../core/cover-layout";
import { TILE_SIZE } from "../core/geometry";
import { BUILT_CRATE, resolveObstacles, type Obstacle } from "../core/obstacles";
import type { MaterialLibrary } from "./materials";

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
    this.ready = Promise.all(
      [...wanted.values()]
        .map(async (obstacle) => {
          const { scene } = await loader.loadAsync(obstacle.model);
          materials.applyPalette(scene);
          const bounds = new THREE.Box3().setFromObject(scene);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const scale = Math.min(
            (obstacle.footprint * TILE_SIZE) / Math.max(size.x, size.z),
            obstacle.height / size.y,
          );
          const model = new THREE.Group();
          model.add(scene);
          scene.scale.multiplyScalar(scale);
          scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
          scene.traverse((part) => {
            if (part instanceof THREE.Mesh) part.castShadow = part.receiveShadow = true;
          });
          this.templates.set(obstacle.id, model);
        })
        .map((task) => task.catch((error) => console.error("Obstacle model failed to load", error))),
    );
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
