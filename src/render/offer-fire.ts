import * as THREE from "three";

const panels = [".round-status", ".players", ".radar", ".combat-feed", ".skill-buttons", "#equipment-wheel", ".top-actions"];
const emitterCount = 4 + panels.length;

// Each segment is an origin and a tangent in CSS pixels. All emitters share one draw.
const vertexShader = `
  uniform float seconds;
  uniform float intensity;
  uniform vec2 viewport;
  uniform vec4 lines[${emitterCount}];
  attribute vec4 particle;
  attribute float emitter;
  varying vec2 sprite;
  varying vec2 screenPx;
  varying vec4 appearance;
  varying float wisp;
  void main() {
    vec4 line = lines[int(emitter)];
    if (dot(line.zw,line.zw) < 1.) { gl_Position = vec4(2.,2.,2.,1.); return; }
    vec2 along = normalize(line.zw), inward = vec2(-along.y,along.x);
    float spark = step(.62,particle.w);
    wisp = 1.-step(.17,particle.w);
    float life = mix(.46,1.45,particle.z) + spark*.35 + wisp*.65;
    float cycle = seconds/life + particle.y;
    float age = fract(cycle);
    float drift = fract(sin(dot(particle.xy,vec2(23.7,73.1)) + floor(cycle)*4.7)*9245.3);
    float lane = fract(particle.x + (drift-.5)*.12);
    float scale = mix(clamp(min(viewport.x,viewport.y)/760.,.68,1.28),.48,step(3.5,emitter));
    scale *= mix(1.35*intensity,1.,step(3.5,emitter));
    float lift = (mix(11.+14.*drift,26.+40.*drift,spark)+wisp*18.)*scale;
    float curl = sin(age*5.4 + particle.y*6.28) - sin(particle.y*6.28);
    vec2 center = line.xy + lane*line.zw + inward*(age*lift)
      + along*(curl*4. + (drift-.4)*age*18.)*scale;
    float width = mix(9.+10.*particle.z,.85+1.15*particle.z,spark);
    float height = mix(12.+13.*drift,2.4+4.*drift,spark);
    vec2 size = vec2(width,height)*scale*(1.-age*mix(.56,.26,spark)+wisp*age*1.5);
    sprite = position.xy*2.;
    screenPx = center + along*(sprite.x*size.x + sprite.y*size.y*.24*curl) + inward*sprite.y*size.y;
    appearance = vec4(age,spark,particle.y,drift);
    gl_Position = vec4(screenPx/viewport*2.-1.,0.,1.);
  }`;

const fragmentShader = `
  uniform float rewardGold;
  uniform vec4 exclusions[2];
  uniform sampler2D vapor;
  varying vec2 sprite;
  varying vec2 screenPx;
  varying vec4 appearance;
  varying float wisp;
  float grain(vec2 p) {
    vec2 i=floor(p), t=fract(p); t=t*t*(3.-2.*t);
    vec4 h=fract(sin(dot(i,vec2(21.1,47.7))+vec4(0.,21.1,47.7,68.8))*1954.3);
    return mix(mix(h.x,h.y,t.x),mix(h.z,h.w,t.x),t.y);
  }
  bool inside(vec4 bounds) {
    return all(greaterThanEqual(screenPx,bounds.xy)) && all(lessThanEqual(screenPx,bounds.zw));
  }
  void main() {
    if (inside(exclusions[0]) || inside(exclusions[1])) discard;
    float age=appearance.x, spark=appearance.y;
    float alpha;
    vec3 color;
    if (spark > .5) {
      float r=dot(sprite,sprite);
      alpha=exp(-3.2*r)*(1.-smoothstep(.68,1.,r));
      color=mix(mix(vec3(1.,.25,.035),vec3(.94,.65,.045),rewardGold),vec3(1.,.96,.66),(1.-age)*(1.-min(r,1.)));
    } else if (wisp > .5) {
      vec2 uv=sprite*.46+.5;
      uv.x=mix(uv.x,1.-uv.x,step(.5,appearance.z));
      vec4 puff=texture2D(vapor,uv);
      alpha=puff.a*(.12+.16*puff.r)*(1.-smoothstep(.7,1.,length(sprite)));
      color=mix(mix(vec3(.60,.29,.12),vec3(.61,.49,.19),rewardGold),vec3(.22,.21,.20),age);
    } else {
      vec2 flow=vec2(sprite.x*1.22,sprite.y-age*2.)+appearance.zw*13.;
      float noise=grain(flow*2.)*.7+grain(flow*4.3)*.3;
      float r=length(vec2(sprite.x*(1.12+.32*sprite.y),sprite.y))+.32*(.5-noise);
      float core=1.-smoothstep(.04,.77,r);
      alpha=(1.-smoothstep(.26,1.,r))*(.3+.38*noise);
      color=mix(mix(vec3(.91,.19,.025),vec3(.77,.54,.035),rewardGold),
                mix(vec3(1.,.78,.32),vec3(1.,.96,.51),rewardGold),core*(1.-age));
    }
    alpha *= smoothstep(0.,.10,age)*(1.-smoothstep(.48,1.,age));
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }`;

function particleGeometry() {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const seeds:number[] = [], emitters:number[] = [];
  // Interleave origins so reduced graphics settings retain particles on every edge.
  for (let n=0; n<84; n++) for (let i=0; i<emitterCount; i++) {
    if (i>=4 && n%4 !== 0) continue;
    seeds.push((n*.618034+Math.random()*.05)%1,Math.random(),Math.random(),Math.random());
    emitters.push(i);
  }
  geometry.setAttribute("particle",new THREE.InstancedBufferAttribute(new Float32Array(seeds),4));
  geometry.setAttribute("emitter",new THREE.InstancedBufferAttribute(new Float32Array(emitters),1));
  return geometry;
}

export class OfferFire {
  private geometry = particleGeometry();
  private uniforms = {
    seconds:{value:0}, intensity:{value:1}, rewardGold:{value:0}, viewport:{value:new THREE.Vector2()},
    vapor:{value:null as THREE.Texture|null},
    lines:{value:Array.from({length:emitterCount},()=>new THREE.Vector4())},
    exclusions:{value:[new THREE.Vector4(),new THREE.Vector4()]},
  };
  private material = new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,fragmentShader,
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private anchors?: (Element|null)[];
  private nextLayout = 0;
  constructor(smokeTexture:THREE.Texture) {
    this.uniforms.vapor.value=smokeTexture;
    const mesh = new THREE.Mesh(this.geometry,this.material);
    mesh.frustumCulled=false;
    this.scene.add(mesh);
  }
  private layout(canvas:HTMLCanvasElement) {
    const root = canvas.parentElement!;
    this.anchors ??= panels.map(selector=>root.querySelector(selector));
    const rect = canvas.getBoundingClientRect(), {width:w,height:h}=rect;
    const lines=this.uniforms.lines.value;
    this.uniforms.viewport.value.set(w,h);
    lines[0].set(0,0,w,0); lines[1].set(w,0,0,h);
    lines[2].set(w,h,-w,0); lines[3].set(0,h,0,-h);
    this.anchors.forEach((node,i)=>{
      const box=node?.getBoundingClientRect();
      if (box && box.width && box.height) lines[i+4].set(box.left-rect.left,rect.bottom-box.top,box.width,0);
      else lines[i+4].set(0,0,0,0);
    });
    ["#player-stats","#perk-tray"].forEach((selector,i)=>{
      const box=root.querySelector(selector)?.getBoundingClientRect();
      const bounds=this.uniforms.exclusions.value[i];
      if (box) bounds.set(box.left-rect.left-3,rect.bottom-box.bottom-3,box.right-rect.left+3,rect.bottom-box.top+3);
      else bounds.set(1,1,-1,-1);
    });
  }
  draw(renderer:THREE.WebGLRenderer, time:number, quality:number, intensity:number, rewardGold:boolean) {
    if (time>=this.nextLayout) {
      this.layout(renderer.domElement);
      this.nextLayout=time+.12;
    }
    this.uniforms.seconds.value=time;
    this.uniforms.intensity.value=intensity;
    this.uniforms.rewardGold.value=Number(rewardGold);
    this.geometry.instanceCount=Math.floor(this.geometry.getAttribute("emitter").count*quality);
    const clear=renderer.autoClear;
    renderer.autoClear=false;
    try { renderer.render(this.scene,this.camera); } finally { renderer.autoClear=clear; }
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
