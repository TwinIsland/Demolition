import * as THREE from "three";
import { seededRandom } from "../core/maps";
import type { MinecraftAvatar } from "./minecraft-avatar";
import { standIn } from "./gpu-warmup";

export const ZOMBIE_FALL_DURATION = 0.65;
type Burst = {
  at: number;
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  body?: MinecraftAvatar;
  scale: number;
  materials: THREE.MeshStandardMaterial[];
};
export class ZombieAsh {
  readonly root = new THREE.Group();
  private geometry = new THREE.BufferGeometry();
  private bursts: Burst[] = [];
  constructor() {
    const rng = seededRandom(18419),
      positions: number[] = [],
      motion: number[] = [];
    for (let i = 0; i < 64; i++) {
      const y = rng() * 1.82;
      positions.push((rng() - 0.5) * (y > 1.46 ? 0.55 : 0.69), y, (rng() - 0.5) * 0.42);
      motion.push((rng() - 0.5) * 1.35, 0.22 + rng() * 0.9, (rng() - 0.5) * 1.35, rng());
    }
    this.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute("motion", new THREE.Float32BufferAttribute(motion, 4));
  }
  private material() {
    return new THREE.ShaderMaterial({
      uniforms: { age: { value: 0 } },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform float age; attribute vec4 motion; varying float shade;
        void main(){
          shade=motion.w; vec3 p=vec3(position.y,.34-position.x,position.z)+motion.xyz*age;
          p.y-=.64*age*age; p.x+=.20*age*age;
          vec4 v=modelViewMatrix*vec4(p,1.);
          gl_PointSize=clamp((55.+shade*50.)/max(.6,-v.z),2.,16.)*(1.-.55*age);
          gl_Position=projectionMatrix*v;
        }`,
      fragmentShader: `
        uniform float age; varying float shade;
        void main(){
          vec2 p=abs(gl_PointCoord-.5); if(p.x+p.y>.59) discard;
          vec3 ash=mix(vec3(.055,.071,.073),vec3(.46,.48,.43),shade);
          vec3 color=mix(ash,vec3(.95,.48,.13),step(.91,shade)*(1.-age));
          gl_FragColor=vec4(color,(1.-smoothstep(.48,1.,age))*smoothstep(0.,.13,age));
          #include <colorspace_fragment>
        }`,
    });
  }
  /** Bursts dispose their material when they end; this one keeps the program alive between them. */
  warmObjects(): THREE.Object3D[] {
    return [new THREE.Points(this.geometry, standIn(this.material()))];
  }
  start(at: number, x: number, z: number, level: number, body?: MinecraftAvatar) {
    const points = new THREE.Points(this.geometry, this.material());
    points.position.set(x, 0.02, z);
    points.rotation.y = body?.rotation.y ?? at * 2.7;
    const scale = 1 + (level - 1) * 0.12;
    points.scale.setScalar(scale);
    points.frustumCulled = false;
    points.renderOrder = 4;
    const materials = new Set<THREE.MeshStandardMaterial>();
    if (body) {
      this.root.add(body);
      body.position.set(x, 0, z);
      body.rotation.order = "YXZ";
      body.rotation.x = 0;
      body.rig.traverse((o) => {
        if (o instanceof THREE.Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m.color) materials.add(m);
      });
      for (const child of body.children) if (child !== body.rig) child.visible = false;
    }
    this.root.add(points);
    this.bursts.push({ at, points, body, scale, materials: [...materials] });
  }
  update(time: number) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i],
        t = Math.max(0, (time - b.at) / ZOMBIE_FALL_DURATION);
      if (t >= 1) {
        b.points.removeFromParent();
        b.points.material.dispose();
        b.body?.removeFromParent();
        b.body?.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      b.points.material.uniforms.age.value = THREE.MathUtils.clamp((t - 0.48) / 0.52, 0, 1);
      if (b.body) {
        const fall = THREE.MathUtils.smootherstep(t, 0, 0.62);
        const ash = THREE.MathUtils.smoothstep(t, 0.56, 0.83);
        b.body.rotation.z = -Math.PI * 0.5 * fall;
        b.body.position.y = 0.3 * b.scale * Math.sin(fall * Math.PI * 0.5);
        b.body.visible = t < 0.83;
        // The killing blow shows red on the body as it falls.
        b.body.setHurt(1 - THREE.MathUtils.smoothstep(t, 0.3, 0.56));
        for (const m of b.materials) m.color.setRGB(0.48 - 0.38 * ash, 0.32 - 0.22 * ash, 0.24 - 0.14 * ash);
      }
    }
  }
  clear() {
    this.update(Infinity);
  }
  dispose() {
    this.clear();
    this.geometry.dispose();
  }
}
