import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAPS } from "../core/maps";

const dimensions = {
  oak: 3.25, pine: 3.55, logs: 1.55, press: 2.05, hopper: 2.05, valve:1.62, "robot-arm":2.25, barricade:1.55,
};

/** Load once, before the arena combines identical meshes into instance batches. */
export class CoverModels {
  readonly ready: Promise<void[]>;
  private templates = new Map<string, THREE.Group>();
  constructor(manager: THREE.LoadingManager) {
    const loader = new GLTFLoader(manager);
    const files = new Map<string,{url:string;height:number}>(Object.entries(dimensions).map(([kind,height]) =>
      [kind,{url:`./assets/cover/${kind}.glb`,height}] as const));
    for (const map of MAPS) for (const prop of map.covers ?? []) if ("model" in prop) {
      const height = prop.height ?? 2;
      files.set(JSON.stringify([prop.model,height]), {url:prop.model,height});
    }
    this.ready = Promise.all([...files].map(async ([id,{url,height}]) => {
      const { scene } = await loader.loadAsync(url);
      const bounds = new THREE.Box3().setFromObject(scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = Math.min(2.09 / Math.max(size.x, size.z), height / size.y);
      const model = new THREE.Group();
      model.add(scene);
      scene.scale.multiplyScalar(scale);
      scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      scene.traverse(part => {
        if (part instanceof THREE.Mesh) part.castShadow = part.receiveShadow = true;
      });
      this.templates.set(id, model);
    }).map(task => task.catch(error => console.error("Cover model failed to load",error))));
  }
  instance(id: string) { return this.templates.get(id)?.clone(true); }
  dispose() {
    const materials = new Set<THREE.Material>();
    const maps = new Set<THREE.Texture>();
    this.templates.forEach(root => root.traverse(part => {
      if (!(part instanceof THREE.Mesh)) return;
      part.geometry.dispose();
      for (const mat of Array.isArray(part.material) ? part.material : [part.material]) materials.add(mat);
    }));
    materials.forEach(mat => {
      for (const value of Object.values(mat)) if (value instanceof THREE.Texture) maps.add(value);
      mat.dispose();
    });
    maps.forEach(map => map.dispose());
    this.templates.clear();
  }
}
