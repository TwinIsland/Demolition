import type * as THREE from "three";
import { MinecraftAvatar } from "./minecraft-avatar";

/** Reconciles one snapshot entity list with its scene objects: removes stale, creates new, updates all. */
export function syncEntities<T extends { id: number }>(
  parent: THREE.Object3D,
  entities: readonly T[],
  cache: Map<number, THREE.Group>,
  create: (entity: T) => THREE.Group,
  update: (mesh: THREE.Group, entity: T) => void,
) {
  const ids = new Set(entities.map((e) => e.id));
  for (const [id, mesh] of cache)
    if (!ids.has(id)) {
      parent.remove(mesh);
      if (mesh instanceof MinecraftAvatar) mesh.dispose();
      cache.delete(id);
    }
  for (const entity of entities) {
    let mesh = cache.get(entity.id);
    if (!mesh) {
      mesh = create(entity);
      cache.set(entity.id, mesh);
      parent.add(mesh);
    }
    update(mesh, entity);
  }
}
