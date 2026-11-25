import * as THREE from "three";
import { MinecraftAvatar } from "./minecraft-avatar";

/** One post-scene draw projects the animated limbs even when the arena occludes them. */
export class NightVision {
  private scene = new THREE.Scene();
  private mesh: THREE.InstancedMesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>;
  private boxes = new WeakMap<THREE.BufferGeometry,THREE.Matrix4>();
  private matrix = new THREE.Matrix4();
  constructor(manager: THREE.LoadingManager) {
    const map = new THREE.TextureLoader(manager).load("./assets/scan-body.svg");
    map.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({
      map, transparent:true, depthTest:false, depthWrite:false, toneMapped:false, fog:false,
    }), 64);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
  }
  draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera, actors: Iterable<THREE.Group>, time: number) {
    let index = 0;
    for (const actor of actors) {
      if (!(actor instanceof MinecraftAvatar) || !actor.visible || !actor.rig.visible) continue;
      const skin = actor.rig.skin;
      for (const part of [skin.head,skin.body,skin.leftArm,skin.rightArm,skin.leftLeg,skin.rightLeg]) {
        const limb = part.innerLayer as THREE.Mesh;
        if (!limb.isMesh) continue;
        let box = this.boxes.get(limb.geometry);
        if (!box) {
          limb.geometry.computeBoundingBox();
          const bounds = limb.geometry.boundingBox!;
          const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(1.025);
          box = new THREE.Matrix4().makeScale(size.x,size.y,size.z).setPosition(bounds.getCenter(new THREE.Vector3()));
          this.boxes.set(limb.geometry,box);
        }
        this.mesh.setMatrixAt(index++,this.matrix.multiplyMatrices(limb.matrixWorld,box));
      }
    }
    this.mesh.count = index;
    if (!index) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.material.opacity = .85 + .07 * Math.sin(time*4);
    const before = renderer.autoClear;
    renderer.autoClear = false;
    try { renderer.render(this.scene,camera); } finally { renderer.autoClear = before; }
  }
  dispose() {
    this.mesh.material.map?.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose();
  }
}
