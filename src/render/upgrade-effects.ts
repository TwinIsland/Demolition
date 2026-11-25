import * as THREE from "three";

interface Burst { node: HTMLElement; color: THREE.Color; count: number; card: boolean }

/** A single instanced screen-space pass for a promotion and the newly dealt cards. */
export class UpgradeEffects {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0,1,1,0,.1,10);
  private pose = new THREE.Object3D();
  private shards = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({transparent:true, blending:THREE.AdditiveBlending, depthTest:false, depthWrite:false, toneMapped:false}), 96);
  private bursts: Burst[] = [];
  private started = 0;
  constructor() {
    this.camera.position.z = 1;
    this.shards.frustumCulled = false;
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.shards);
  }
  start(time: number, banner: HTMLElement, cards: HTMLElement[]) {
    this.bursts = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.started = time;
    this.bursts.push({node:banner,color:new THREE.Color("#ffce76"),count:39,card:false});
    for (const card of cards) this.bursts.push({node:card,color:new THREE.Color(card.style.getPropertyValue("--perk-color")),count:14,card:true});
  }
  draw(renderer: THREE.WebGLRenderer, time: number) {
    if (!this.bursts.length) return;
    const elapsed = (time-this.started)/1.7;
    if (elapsed >= 1) { this.bursts.length=0; return; }
    const screen = renderer.domElement.getBoundingClientRect();
    this.camera.right = screen.width; this.camera.top = screen.height;
    this.camera.updateProjectionMatrix();
    let i = 0;
    for (const burst of this.bursts) {
      if (!burst.node.isConnected) continue;
      const box = burst.node.getBoundingClientRect();
      const cx = box.left-screen.left+box.width/2, cy = screen.bottom-box.top-box.height/2;
      for (let j=0; j<burst.count; j++) {
        const angle = j * 2.39996, dx = Math.cos(angle), dy = Math.sin(angle);
        const t = THREE.MathUtils.clamp((elapsed-(j%5)*.027)*1.15,0,1);
        const travel = 1-(1-t)**3;
        const start = burst.card ? Math.min(box.width*.49/Math.max(.01,Math.abs(dx)),box.height*.48/Math.max(.01,Math.abs(dy))) : 14;
        const radius = start + travel * (burst.card ? 8+(j%4)*4 : 49+(j%7)*9);
        this.pose.position.set(cx+dx*radius*(burst.card?1:1.42),cy+dy*radius*(burst.card?1:.68),0);
        this.pose.rotation.z = Math.atan2(dy*(burst.card?1:.68),dx*(burst.card?1:1.42));
        const size = Math.sin(Math.PI*t)**.7;
        this.pose.scale.set(size*(burst.card?4:7+j%7), size*(burst.card?1.6:2.2),1);
        this.pose.updateMatrix();
        this.shards.setMatrixAt(i,this.pose.matrix);
        this.shards.setColorAt(i++,burst.color);
      }
    }
    this.shards.count=i;
    this.shards.instanceMatrix.needsUpdate=true;
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate=true;
    if (!i) return;
    const clear = renderer.autoClear;
    renderer.autoClear=false;
    try { renderer.render(this.scene,this.camera); } finally { renderer.autoClear=clear; }
  }
  dispose() { this.shards.geometry.dispose(); this.shards.material.dispose(); this.shards.dispose(); }
}
