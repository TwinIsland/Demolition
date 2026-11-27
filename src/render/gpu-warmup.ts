import * as THREE from "three";

/**
 * Three.js compiles a shader program and uploads a texture the first time something is drawn
 * with it, and frees a program once the last material using it is disposed. Either one stalls
 * a frame in the middle of a match. The helpers here let the loading screen pay for both, and
 * a hidden group of stand-ins keeps every program referenced for as long as the match lasts.
 */

/** A material made only to stand in during warm-up; it is disposed with its group. */
export function standIn<T extends THREE.Material>(material: T): T {
  material.userData.standIn = true;
  return material;
}

const materialsOf = (object: THREE.Object3D): THREE.Material[] => {
  const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  return material ? (Array.isArray(material) ? material : [material]) : [];
};

/** Every texture reachable from the materials under `root`, shader uniforms included. */
export function texturesUnder(root: THREE.Object3D, found = new Set<THREE.Texture>()) {
  const visited = new Set<THREE.Material>();
  root.traverse((object) => {
    for (const material of materialsOf(object)) {
      if (visited.has(material)) continue;
      visited.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) found.add(value);
      const uniforms = (material as THREE.ShaderMaterial).uniforms as
        Record<string, { value: unknown }> | undefined;
      if (uniforms)
        for (const uniform of Object.values(uniforms))
          if (uniform?.value instanceof THREE.Texture) found.add(uniform.value);
    }
  });
  return found;
}

/** Decodes and uploads textures now instead of on the frame that first shows them. */
export function uploadTextures(renderer: THREE.WebGLRenderer, textures: Iterable<THREE.Texture>) {
  for (const texture of textures) {
    // Render targets own their storage; a texture without pixels yet has nothing to upload.
    if (texture.isRenderTargetTexture || !texture.image) continue;
    const image = texture.image as { complete?: boolean; width?: number };
    if (image.complete === false || !image.width) continue;
    renderer.initTexture(texture);
  }
}

/** Frees what a retired warm-up group owned. Shared library assets are left alone. */
export function disposeStandIns(group: THREE.Object3D) {
  group.removeFromParent();
  const disposers = new Set<{ dispose(): void }>();
  group.traverse((object) => {
    if (typeof object.userData.disposeStandIn === "function")
      disposers.add({ dispose: object.userData.disposeStandIn as () => void });
    for (const material of materialsOf(object)) if (material.userData.standIn) disposers.add(material);
    if (object instanceof THREE.InstancedMesh) disposers.add(object);
  });
  for (const item of disposers) item.dispose();
}
