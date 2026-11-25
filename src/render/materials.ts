import * as THREE from "three";

/** Downloaded PBR texture sets; color maps use sRGB, data maps stay linear. */
export class MaterialLibrary {
  constructor(private manager = THREE.DefaultLoadingManager) {}
  private materials = new Map<string, THREE.Material>();
  private textures: THREE.Texture[] = [];
  standard(
    name: string,
    color: string,
    surface: "ceramic" | "wood" | "metal" | "plain" = "plain",
  ) {
    const key = `${name}:${color}`;
    if (this.materials.has(key))
      return this.materials.get(key) as THREE.MeshStandardMaterial;
    const maps =
      surface === "plain" || surface === "metal"
        ? {}
        : this.surface(surface, name);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: surface === "metal" ? 0.4 : name === "floor" ? 0.55 : 0.88,
      metalness: surface === "metal" ? 0.65 : 0,
      ...maps,
    });
    mat.name = name;
    this.materials.set(key, mat);
    return mat;
  }
  bubble(color: string) {
    const key = `bubble:${color}`;
    if (this.materials.has(key))
      return this.materials.get(key) as THREE.MeshPhysicalMaterial;
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.3,
      metalness: 0.12,
      clearcoat: 0.3,
      clearcoatRoughness: 0.1,
      iridescence: 0.05,
      iridescenceIOR: 1.3,
      transparent: true,
      opacity: 1,
      envMapIntensity: 1.4,
    });
    this.materials.set(key, mat);
    return mat;
  }
  glow(color: string) {
    const key = `glow:${color}`;
    if (this.materials.has(key))
      return this.materials.get(key) as THREE.MeshBasicMaterial;
    const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    this.materials.set(key, mat);
    return mat;
  }
  label(text: string, color: string) {
    if (this.materials.has(`label:${text}`))
      return this.materials.get(`label:${text}`) as THREE.SpriteMaterial;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#242239dd";
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 20);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '700 26px "Barlow Semi Condensed","Noto Sans SC",sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(texture);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: true,
      transparent: true,
    });
    this.materials.set(`label:${text}`, mat);
    return mat;
  }
  private surface(kind: "ceramic" | "wood" | "metal", name: string) {
    const loader = new THREE.TextureLoader(this.manager);
    const load = (path: string, color = false, repeat = 1) => {
      const texture = loader.load(path);
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.setScalar(repeat);
      texture.anisotropy = 8;
      this.textures.push(texture);
      return texture;
    };
    if (kind === "wood")
      return {
        map: load("./assets/wood.jpg", true),
        bumpMap: load("./assets/wood-bump.jpg"),
        bumpScale: 0.025,
      };
    const floor = name === "floor" || name === "terrain";
    const set = floor ? "concrete_floor_02" : "concrete_wall_003";
    const repeat = name === "terrain" ? 90 : 1;
    return {
      map: load(`./assets/${set}_diff_1k.jpg`, true, repeat),
      roughnessMap: load(`./assets/${set}_rough_1k.jpg`, false, repeat),
      normalMap: load(`./assets/${set}_nor_gl_1k.jpg`, false, repeat),
      normalScale: new THREE.Vector2(0.65, 0.65),
    };
  }
  dispose() {
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
