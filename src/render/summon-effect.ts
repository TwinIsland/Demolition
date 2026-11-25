import * as THREE from "three";
import type { Zombie } from "../core/types";

/** A short ground signal, rising motes and an emerging body share the server clock. */
export class SummonEffects {
  private rim = new THREE.RingGeometry(.88,1,48);
  private motes = new THREE.BufferGeometry();
  private materials = ["#9bc886","#e6ad5f","#bb8eef"].map(color => ({
    rim: new THREE.MeshBasicMaterial({color, transparent:true, opacity:.74, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending}),
    sparks: new THREE.PointsMaterial({color, size:.065, transparent:true, opacity:.88, depthWrite:false, blending:THREE.AdditiveBlending}),
  }));
  constructor() {
    const positions = [];
    for (let i=0; i<31; i++) {
      const angle = i * 2.39996, radius = .32 + .49 * ((i * 7) % 19) / 18;
      positions.push(Math.cos(angle)*radius, ((i * 13) % 31)/31, Math.sin(angle)*radius);
    }
    this.motes.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  }
  update(parent: THREE.Group, enemy: Zombie, t: number) {
    let portal = parent.getObjectByName("summon");
    if (t >= 1) { portal?.removeFromParent(); return; }
    if (!portal) {
      const material = this.materials[enemy.level-1];
      portal = new THREE.Group();
      portal.name = "summon";
      const ring = new THREE.Mesh(this.rim,material.rim);
      ring.rotation.x = -Math.PI/2;
      ring.position.y = .045;
      portal.add(ring,new THREE.Points(this.motes,material.sparks));
      parent.add(portal);
    }
    const envelope = Math.min(1,t*7,(1-t)*5);
    portal.children[0].scale.setScalar((.52 + .46*t) * envelope);
    const sparks = portal.children[1];
    sparks.position.y = .03 + .43*t;
    sparks.scale.set(envelope, (.25 + 1.15*t)*envelope,envelope);
    sparks.rotation.y = t*1.5 + enemy.id;
  }
  dispose() {
    this.rim.dispose(); this.motes.dispose();
    this.materials.forEach(m => {m.rim.dispose(); m.sparks.dispose();});
  }
}
