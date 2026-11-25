import * as THREE from "three";
import type { GameSnapshot } from "../core/types";
import { world } from "./arena";

/** One world-space shell per protected player. The local camera can look through its inner face. */
export class ShieldField {
  readonly root = new THREE.Group();
  private geometry = new THREE.SphereGeometry(1.28,36,24);
  private cells: THREE.Texture;
  private shells = new Map<string,THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>>();
  constructor(manager:THREE.LoadingManager) {
    this.cells = new THREE.TextureLoader(manager).load("./assets/shield-field.webp");
    this.cells.wrapS = this.cells.wrapT = THREE.RepeatWrapping;
  }
  private create() {
    const material = new THREE.ShaderMaterial({
      uniforms:{cells:{value:this.cells},time:{value:0},strength:{value:1},impact:{value:0}},
      side:THREE.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`
        varying vec2 surface; varying vec3 viewPos, n;
        void main() {
          surface=uv; vec4 v=modelViewMatrix*vec4(position,1.);
          viewPos=v.xyz; n=normalize(normalMatrix*normal); gl_Position=projectionMatrix*v;
        }`,
      fragmentShader:`
        uniform sampler2D cells; uniform float time,strength,impact;
        varying vec2 surface; varying vec3 viewPos,n;
        void main() {
          float cell=texture2D(cells,surface*vec2(3.,1.6)+vec2(.008*time,0.)).g;
          vec3 eye=normalize(-viewPos);
          float rim=pow(1.-abs(dot(normalize(n),eye)),2.);
          float edge=1.-smoothstep(.58,1.,eye.z);
          float scan=pow(max(0.,cos(surface.y*24.-time*2.4)),10.);
          float glow=gl_FrontFacing ? .48*cell+.30*rim : cell*(.15+.32*edge)+.06*edge;
          glow+=(.045*scan+.42*impact)*(cell+.07);
          gl_FragColor=vec4(vec3(.19,.78,.94),clamp(glow*strength,0.,.85));
          #include <colorspace_fragment>
        }`,
    });
    const shell = new THREE.Mesh(this.geometry,material);
    shell.renderOrder = 6;
    this.root.add(shell);
    return shell;
  }
  update(s:Readonly<GameSnapshot>) {
    for (const shell of this.shells.values()) shell.visible = false;
    for (const p of s.players) {
      if (!p.alive || p.shield <= 0) continue;
      let shell = this.shells.get(p.id);
      if (!shell) { shell=this.create(); this.shells.set(p.id,shell); }
      shell.visible = true;
      shell.position.set(world(p.x,s.size),p.elevation+.96,world(p.z,s.size));
      const u = shell.material.uniforms;
      u.time.value = s.time;
      u.strength.value = Math.min(1,.22+p.shield*2);
      let impact = 0;
      for (const e of s.events) if (e.blocked && e.playerId === p.id)
        impact = Math.max(impact,1-Math.max(0,s.time-e.at)/.28);
      u.impact.value=impact;
    }
  }
  dispose() {
    this.shells.forEach(s => s.material.dispose());
    this.geometry.dispose(); this.cells.dispose();
  }
}
