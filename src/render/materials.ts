import * as THREE from "three";

/** A texture set under `assets/surfaces`, optionally tinted. */
interface Surface {
  maps?: string;
  /** Colour map when it differs from `<maps>_diff`. */
  diff?: string;
  color?: string;
  roughness?: number;
  metalness?: number;
  normal?: number;
  maplessNormal?: boolean;
}
const paint = (color: string): Surface => ({
  maps: "paint",
  diff: "paint-neutral",
  color,
  metalness: 0.15,
  normal: 0.9,
});
/**
 * Shared surfaces for props. A GLB material named `df:<key>` is replaced with
 * the matching entry, so every model that uses the palette shares one look,
 * one texel density and one set of GPU textures.
 */
const PALETTE: Record<string, Surface> = {
  planks: { maps: "planks", color: "#d9cdb8" },
  "planks-dark": { maps: "planks", color: "#8f7b62" },
  endgrain: { diff: "endgrain", roughness: 0.85 },
  bark: { maps: "bark", color: "#c9c2b4" },
  "paint-olive": { maps: "paint", metalness: 0.15, normal: 0.9 },
  "paint-graphite": paint("#4a5052"),
  "paint-sand": paint("#b9a981"),
  "paint-yellow": paint("#d8a31d"),
  "paint-red": paint("#a53f2f"),
  "paint-slate": paint("#73858d"),
  "paint-ivory": paint("#ddd6bf"),
  "paint-teal": paint("#2f7a7e"),
  hazard: { maps: "paint", diff: "hazard", metalness: 0.15, normal: 0.9 },
  steel: { maps: "steel", color: "#c4c6c4", metalness: 0.7 },
  "steel-dark": { maps: "steel", color: "#44484a", metalness: 0.75 },
  "steel-blade": {
    maps: "paint",
    diff: "paint-neutral",
    color: "#b4babd",
    metalness: 0.9,
    roughness: 0.45,
    normal: 0.35,
  },
  burlap: { maps: "burlap", color: "#d0c8b0" },
  "burlap-olive": { maps: "burlap", color: "#8f9474" },
  rubber: { maps: "rubber", color: "#2a2b2b" },
  concrete: { maps: "../concrete_wall_003", color: "#807e75" },
  glass: { color: "#16262c", roughness: 0.08, metalness: 0.2 },
  ground: { maps: "ground", color: "#b9ad98" },
  "foliage-oak": { maps: "ground", color: "#8fa565", normal: 1.6 },
  "foliage-pine": { maps: "ground", color: "#5d7f6c", normal: 1.6 },
};
export const PALETTE_PREFIX = "df:";

/** Downloaded PBR texture sets; color maps use sRGB, data maps stay linear. */
export class MaterialLibrary {
  constructor(private manager = THREE.DefaultLoadingManager) {}
  private materials = new Map<string, THREE.Material>();
  private textures: THREE.Texture[] = [];
  standard(name: string, color: string, surface: "ceramic" | "metal" | "plain" = "plain") {
    const key = `${name}:${color}`;
    if (this.materials.has(key)) return this.materials.get(key) as THREE.MeshStandardMaterial;
    const maps = surface === "plain" || surface === "metal" ? {} : this.surface(name);
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
  private shared = new Map<string, THREE.Texture>();
  private texture(path: string, color: boolean) {
    let texture = this.shared.get(path);
    if (!texture) {
      texture = new THREE.TextureLoader(this.manager).load(path);
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      // GLB texture coordinates use the glTF convention.
      texture.flipY = false;
      this.shared.set(path, texture);
      this.textures.push(texture);
    }
    return texture;
  }
  /** The shared prop surface for a GLB material name, or undefined when the name is not in the palette. */
  palette(materialName: string) {
    if (!materialName.startsWith(PALETTE_PREFIX)) return undefined;
    const key = materialName.slice(PALETTE_PREFIX.length),
      surface = PALETTE[key];
    if (!surface) return undefined;
    const cached = this.materials.get(materialName);
    if (cached) return cached as THREE.MeshStandardMaterial;
    const path = (name: string, suffix: string) => {
      const poly = name.startsWith("../");
      const file = poly
        ? `${name}_${{ diff: "diff", nor: "nor_gl", rough: "rough" }[suffix]}_1k.jpg`
        : `${name}_${suffix}.webp`;
      return `./assets/surfaces/${file}`;
    };
    const mat = new THREE.MeshStandardMaterial({
      name: materialName,
      color: surface.color ?? "#ffffff",
      roughness: surface.roughness ?? 1,
      metalness: surface.metalness ?? 0,
    });
    const diff = surface.diff ?? surface.maps;
    if (diff) mat.map = this.texture(path(diff, "diff"), true);
    if (surface.maps) {
      mat.normalMap = this.texture(path(surface.maps, "nor"), false);
      mat.normalScale.setScalar(surface.normal ?? 1);
      if (surface.roughness === undefined)
        mat.roughnessMap = this.texture(path(surface.maps, "rough"), false);
    }
    this.materials.set(materialName, mat);
    return mat;
  }
  /** Swap palette-named materials on a loaded model; other materials are left as authored. */
  applyPalette(root: THREE.Object3D) {
    root.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      const swap = (material: THREE.Material) => {
        const shared = this.palette(material.name);
        if (shared) material.dispose();
        return shared ?? material;
      };
      part.material = Array.isArray(part.material) ? part.material.map(swap) : swap(part.material);
    });
  }
  private pending: Promise<void>[] = [];
  /** Resolves when every emblem requested so far has finished loading. */
  emblemsReady() {
    return Promise.all(this.pending);
  }
  /**
   * A stencilled owner mark: the emblem image inside a ring of the owner's colour.
   * The ring shows at once and the image joins it when it has loaded.
   */
  emblem(url: string, color: string) {
    const key = `emblem:${url}:${color}`;
    const cached = this.materials.get(key);
    if (cached) return cached as THREE.MeshStandardMaterial;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.textures.push(texture);
    const draw = (image?: HTMLImageElement) => {
      ctx.clearRect(0, 0, 256, 256);
      ctx.strokeStyle = color;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.stroke();
      if (image) ctx.drawImage(image, 58, 58, 140, 140);
      texture.needsUpdate = true;
    };
    draw();
    this.pending.push(
      new Promise<void>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          draw(image);
          resolve();
        };
        image.onerror = () => {
          console.error("Emblem failed to load", url);
          resolve();
        };
        image.src = url;
      }),
    );
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.materials.set(key, mat);
    return mat;
  }
  bubble(color: string) {
    const key = `bubble:${color}`;
    if (this.materials.has(key)) return this.materials.get(key) as THREE.MeshPhysicalMaterial;
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
    if (this.materials.has(key)) return this.materials.get(key) as THREE.MeshBasicMaterial;
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
  private surface(name: string) {
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
