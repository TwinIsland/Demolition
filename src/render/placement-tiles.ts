import * as THREE from "three";
import { canPlace, placementRadius } from "../core/placement";
import { OWN_BOMB_COLOR } from "../core/bomb-warning";
import type { GameSnapshot, Player } from "../core/types";
import { world } from "./arena";

export class PlacementTiles {
  readonly root = new THREE.Group();
  private geometry = new THREE.PlaneGeometry(2.05, 2.05);
  private material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { guideColor: { value: new THREE.Color(OWN_BOMB_COLOR) } },
    vertexShader: `varying vec2 tile; void main(){tile=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 guideColor; varying vec2 tile; void main(){
      vec2 d=min(tile,1.-tile);
      float edge=min(d.x,d.y), arm=max(d.x,d.y);
      float outline=(1.-smoothstep(.041,.054,edge))*(1.-smoothstep(.17,.19,arm));
      if(outline<.01) discard;
      float ink=(1.-smoothstep(.021,.033,edge))*(1.-smoothstep(.15,.17,arm));
      gl_FragColor=vec4(mix(vec3(.014,.043,.056),guideColor,ink),.86*outline);
      #include <colorspace_fragment>
    }`,
  });
  private mesh?: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  private signature = "";
  warmObjects(): THREE.Object3D[] {
    return [new THREE.InstancedMesh(this.geometry, this.material, 1)];
  }
  update(s: Readonly<GameSnapshot>, p: Player, show: boolean, mapChanged: boolean) {
    this.root.visible = show;
    if (!show) {
      this.signature = "";
      return;
    }
    const r = placementRadius(p, s.time),
      x = Math.round(p.x),
      z = Math.round(p.z);
    const key = [
      s.mapId,
      s.seed,
      x,
      z,
      r,
      p.capacity,
      ...s.bombs.map((b) => `${b.ownerId}/${b.x}/${b.z}`),
    ].join(":");
    if (key === this.signature && !mapChanged) return;
    this.signature = key;
    const count = s.size * s.size;
    if (!this.mesh || this.mesh.instanceMatrix.count < count) {
      this.mesh?.removeFromParent();
      this.mesh?.dispose();
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 4;
      this.root.add(this.mesh);
    }
    let n = 0;
    for (let cz = Math.max(0, Math.ceil(z - r)); cz <= Math.min(s.size - 1, z + r); cz++)
      for (let cx = Math.max(0, Math.ceil(x - r)); cx <= Math.min(s.size - 1, x + r); cx++) {
        if (!canPlace(s, p, { x: cx, z: cz })) continue;
        this.matrix.setPosition(world(cx, s.size), 0.035, world(cz, s.size));
        this.mesh.setMatrixAt(n++, this.matrix);
      }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.mesh?.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
