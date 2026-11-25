import * as THREE from "three";
import type { MapDefinition } from "../core/pack-api";

const vertexShader = `
  varying vec2 screenUv;
  void main() {
    screenUv = uv;
    gl_Position = vec4(position.xy, 0., 1.);
  }`;

const fragmentShader = `
  uniform sampler2D firstArt, nextArt;
  uniform vec2 firstCrop, nextCrop;
  uniform float mixAmount, time, industrial, aspect, beat;
  varying vec2 screenUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float motes(vec2 p, float scale, vec2 wind) {
    p = p * scale + wind * time;
    vec2 cell = floor(p);
    float seed = hash(cell);
    vec2 center = .23 + .52 * vec2(seed, hash(cell + 17.4));
    center.x += .08 * sin(time * .65 + seed * 12.);
    float d = length(fract(p) - center);
    return (1. - smoothstep(.012, .048, d)) * smoothstep(.70, 1., seed);
  }
  void main() {
    vec2 uv = screenUv;
    vec2 drift = vec2(sin(time * .095) * .011, cos(time * .11) * .006);
    vec2 kick = vec2(sin(time * 29.) / aspect, cos(time * 24.)) * (.0018 * beat);
    vec2 framing = (uv - .5) * (.966 + .006 * sin(time * .085) - .013 * beat) + drift + kick;
    vec3 image = mix(texture2D(firstArt, .5 + framing * firstCrop).rgb,
                     texture2D(nextArt, .5 + framing * nextCrop).rgb, mixAmount);
    vec2 p = vec2(uv.x * aspect, uv.y);
    // Wind carries dust across the outpost. Narrow shafts of light sweep the depot.
    float sun = .5 + .5 * sin(uv.x * 8. + uv.y * 4. + sin(time * .23));
    float beamX = .64 + (.34 + .10 * sin(time * .32)) * (1. - uv.y);
    float beam = exp(-abs(uv.x - beamX) / (.025 + .10 * (1. - uv.y)));
    vec3 light = mix(vec3(.045,.030,.012) * sun * sun,
                     vec3(.030,.070,.10) * beam, industrial);
    float dust = motes(p, 14., mix(vec2(-.34,.07),vec2(.04,-.12),industrial))
               + .50 * motes(p + 2.71, 27., vec2(-.13,-.08));
    image += light * (.22 + .78 * uv.y) * (1. + .75 * beat);
    image += dust * mix(vec3(.50,.33,.12),vec3(.22,.42,.52),industrial);
    gl_FragColor = vec4(image,1.);
    #include <colorspace_fragment>
  }`;

type Backdrop = { texture: THREE.Texture<HTMLImageElement>; industrial: number };

export class MapBackdrop {
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private loader: THREE.TextureLoader;
  private textures = new Map<string, THREE.Texture<HTMLImageElement>>();
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private wanted?: Backdrop;
  private first?: Backdrop;
  private next?: Backdrop;
  private started = 0;
  private geometry = new THREE.PlaneGeometry(2,2);
  private uniforms = {
    firstArt: {value: null as THREE.Texture | null}, nextArt: {value: null as THREE.Texture | null},
    firstCrop: {value: new THREE.Vector2()}, nextCrop: {value: new THREE.Vector2()},
    mixAmount: {value:0}, industrial: {value:0}, time: {value:0}, aspect: {value:1}, beat: {value:0},
  };
  private material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms:this.uniforms, depthWrite:false, depthTest:false,
  });
  constructor(manager: THREE.LoadingManager) {
    this.loader = new THREE.TextureLoader(manager);
    const screen = new THREE.Mesh(this.geometry,this.material);
    screen.frustumCulled = false;
    this.scene.add(screen);
  }
  select(map: MapDefinition) {
    const url = map.backdrop || map.artwork;
    if (!url) {
      this.wanted = this.first = this.next = undefined;
      return;
    }
    let texture = this.textures.get(url);
    if (!texture) {
      texture = this.loader.load(url, undefined, undefined, () => {
        if (this.wanted?.texture === texture) this.wanted = undefined;
        this.textures.delete(url);
        texture?.dispose();
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(url,texture);
    }
    this.wanted = {texture,industrial:Number(map.theme === "midnight")};
  }
  draw(renderer: THREE.WebGLRenderer, time: number, beat: number) {
    if (!this.wanted) return false;
    const duration = .55;
    if (this.wanted !== this.next && this.wanted.texture.image?.width) {
      const progress = THREE.MathUtils.clamp((time - this.started) / duration, 0, 1);
      // Reversing a selection mid-fade keeps the current image brightness continuous.
      const reverse = this.first?.texture === this.wanted.texture && this.next;
      this.first = reverse || (progress < .5 ? this.first : this.next) || this.wanted;
      this.next = this.wanted;
      this.started = reverse ? time - (1 - progress) * duration : time;
    }
    if (!this.first || !this.next) return false;
    const t = this.reducedMotion.matches ? 1 : THREE.MathUtils.smoothstep(time-this.started,0,duration);
    const canvas = renderer.domElement, aspect = canvas.width / canvas.height;
    const u = this.uniforms;
    for (const [layer,crop] of [[this.first,u.firstCrop],[this.next,u.nextCrop]] as const) {
      const image = layer.texture.image;
      const ratio = aspect * image.height / image.width;
      crop.value.set(Math.min(1,ratio), Math.min(1,1/ratio));
    }
    u.firstArt.value = this.first.texture;
    u.nextArt.value = this.next.texture;
    u.mixAmount.value = t;
    u.industrial.value = THREE.MathUtils.lerp(this.first.industrial,this.next.industrial,t);
    u.time.value = this.reducedMotion.matches ? 0 : time;
    u.aspect.value = aspect;
    u.beat.value = beat;
    renderer.render(this.scene,this.camera);
    if (t === 1) this.first = this.next;
    return true;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.textures.forEach(t => t.dispose());
    this.textures.clear();
  }
}
