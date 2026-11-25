import { t } from "../i18n";
import { DEFAULT_SKIN, SKINS, type Appearance } from "../core/room";
import * as THREE from "three";
import { inferModelType, loadSkinToCanvas } from "skinview-utils";
export type SkinModel = "auto" | "default" | "slim";
export const validSkinSize = (w: number, h: number) =>
  w >= 64 && w <= 1024 && w % 64 === 0 && (h === w || h === w / 2);
export interface MinecraftSkin {
  texture: THREE.CanvasTexture;
  model: "default" | "slim";
}

/** Normalize legacy skin UVs and preserve the hat/jacket outer layer. */
export class MinecraftSkins {
  private cache = new Map<string, Promise<MinecraftSkin>>();
  private custom?: MinecraftSkin;
  private currentSource?: string;
  private currentModel: SkinModel = "auto";
  private textures: THREE.Texture[] = [];
  private request = 0;
  constructor(private manager = THREE.DefaultLoadingManager) {
    try {
      const model = localStorage.getItem("demolition-skin-model");
      if (model === "slim" || model === "default") this.currentModel = model;
      const saved = localStorage.getItem("demolition-skin") ?? undefined;
      const legacy = saved?.match(/^\/assets\/skin-([a-z0-9-]+)\.png$/);
      this.currentSource = legacy ? (SKINS[legacy[1]] ?? DEFAULT_SKIN).texture : saved;
    } catch {}
  }
  get(playerId: string, preset?: Appearance["skin"]): Promise<MinecraftSkin> {
    if ((!preset || preset === "custom") && playerId === "you" && this.custom)
      return Promise.resolve(this.custom);
    const profile =
      SKINS[preset ?? ""] ??
      (playerId === "sunny" || playerId === "mint" ? SKINS.scout : undefined) ??
      DEFAULT_SKIN;
    const custom = (!preset || preset === "custom") && playerId === "you" && this.currentSource;
    const source = custom || profile.texture;
    const model = custom ? this.currentModel : profile.model;
    const key = model + source;
    if (!this.cache.has(key)) this.cache.set(key, this.decode(source, model));
    return this.cache.get(key)!;
  }
  /** Skin and glow map for a zombie tier (1 to 3). The glow map lights the eyes and any embers. */
  zombie(tier: number) {
    const load = (source: string) => {
      const key = "default" + source;
      if (!this.cache.has(key)) this.cache.set(key, this.decode(source, "default"));
      return this.cache.get(key)!;
    };
    const base = `./assets/zombies/zombie-${Math.min(3, Math.max(1, Math.round(tier)))}`;
    return Promise.all([load(`${base}.png`), load(`${base}-glow.png`)]);
  }
  async import(file: File | undefined, model: SkinModel) {
    const ticket = ++this.request;
    let source = this.currentSource ?? DEFAULT_SKIN.texture;
    if (file) {
      if (file.type !== "image/png" || file.size > 2 * 1024 * 1024)
        throw new Error(t("请选择不超过 2 MB 的 PNG 皮肤"));
      source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(t("无法读取皮肤")));
        reader.readAsDataURL(file);
      });
    }
    const skin = await this.decode(source, model);
    if (ticket !== this.request) return false;
    this.custom = skin;
    this.currentSource = source;
    this.currentModel = model;
    try {
      if (file) localStorage.setItem("demolition-skin", source);
      localStorage.setItem("demolition-skin-model", model);
    } catch {}
    return true;
  }
  private async decode(source: string, model: SkinModel): Promise<MinecraftSkin> {
    this.manager.itemStart(source);
    try {
      return await this.decodeImage(source, model);
    } catch (error) {
      this.manager.itemError(source);
      throw error;
    } finally {
      this.manager.itemEnd(source);
    }
  }
  private async decodeImage(source: string, model: SkinModel): Promise<MinecraftSkin> {
    const image = new Image();
    image.src = source;
    await image.decode();
    if (!validSkinSize(image.naturalWidth, image.naturalHeight))
      throw new Error(t("皮肤需为 64×64、64×32 或同比例高清 PNG"));
    const canvas = document.createElement("canvas");
    loadSkinToCanvas(canvas, image);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    this.textures.push(texture);
    return {
      texture,
      model: model === "auto" ? inferModelType(canvas) : model,
    };
  }
  dispose() {
    this.textures.forEach((t) => t.dispose());
  }
}
