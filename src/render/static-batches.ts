import * as THREE from "three";

interface Slot {
  batch: THREE.InstancedMesh;
  index: number;
}
/** Static geometry shares draw calls; destructible cells retain removable slots. */
export class StaticBatches {
  readonly batches: THREE.InstancedMesh[] = [];
  readonly sourceMeshes: number;
  private cells = new Map<string, Slot[]>();
  private moved = new Set<THREE.InstancedMesh>();
  private matrix = new THREE.Matrix4();
  constructor(root: THREE.Group) {
    root.updateMatrixWorld(true);
    const groups = new Map<string, THREE.Mesh[]>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material.map(m=>m.uuid).join(",") : object.material.uuid;
      const key = `${object.geometry.uuid}:${materials}:${object.castShadow}:${object.receiveShadow}`;
      const list = groups.get(key) ?? [];
      list.push(object);
      groups.set(key, list);
    });
    this.sourceMeshes = [...groups.values()].reduce(
      (sum, list) => sum + list.length,
      0,
    );
    for (const sources of groups.values()) {
      const first = sources[0],
        batch = new THREE.InstancedMesh(
          first.geometry,
          first.material,
          sources.length,
        );
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sources.forEach((source, index) => {
        batch.setMatrixAt(index, source.matrixWorld);
        const cell = source.userData.destructibleCell as string | undefined;
        if (cell) {
          const slots = this.cells.get(cell) ?? [];
          slots.push({ batch, index });
          this.cells.set(cell, slots);
        }
        source.removeFromParent();
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      batch.matrixAutoUpdate = false;
      root.add(batch);
      this.batches.push(batch);
    }
    for (const child of [...root.children])
      if (child instanceof THREE.Group && child.children.length === 0)
        root.remove(child);
  }
  removeCell(key: string) {
    const slots = this.cells.get(key);
    if (!slots) return false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const { batch, index } of slots) {
      batch.setMatrixAt(index, hidden);
      batch.instanceMatrix.needsUpdate = true;
    }
    this.cells.delete(key);
    return true;
  }
  translateCell(key:string, dx:number, dz:number) {
    for (const {batch,index} of this.cells.get(key) ?? []) {
      batch.getMatrixAt(index,this.matrix);
      this.matrix.elements[12] += dx;
      this.matrix.elements[14] += dz;
      batch.setMatrixAt(index,this.matrix);
      this.moved.add(batch);
    }
  }
  finishMoves() {
    for (const batch of this.moved) {
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      if (batch.boundingBox) batch.computeBoundingBox();
    }
    this.moved.clear();
  }
  dispose() {
    this.batches.forEach((batch) => batch.dispose());
    this.cells.clear();
  }
}
