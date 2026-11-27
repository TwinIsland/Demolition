import { t } from "../i18n";
import type { SkinPack, MapDefinition, BombFinish } from "../core/pack-api";
import { ID_PATTERN } from "../core/schema";
import type { ContentModule, MutationDefinition } from "../core/module-api";

const content: ContentModule[] = [];
export default content;
export const skins: SkinPack[] = [];
export const finishes: BombFinish[] = [];
export const maps: MapDefinition[] = [];
export const mutations: MutationDefinition[] = [];

async function loadCategory<T>(root: URL, manifest: Record<string, unknown>, category: string): Promise<T[]> {
  const names = manifest[category];
  if (!Array.isArray(names)) throw new Error(t("Mod 清单缺少分类 {0}", category));
  return Promise.all(
    names.map(async (name) => {
      if (typeof name !== "string" || !ID_PATTERN.test(name))
        throw new Error(t("Mod 目录名无效 · {0}/{1}", category, String(name)));
      const entry = new URL(`${category}/${name}/index.js`, root);
      try {
        const module = await import(/* @vite-ignore */ entry.href);
        if (!module.default?.id) throw new Error("Missing default export with an ID");
        return module.default as T;
      } catch (cause) {
        throw new Error(t("Mod 加载失败 · {0}/{1}", category, name), { cause });
      }
    }),
  );
}

// Bootstrap awaits the complete catalog before simulation or UI registries are imported.
export async function loadCatalog() {
  // Release packs import `mods/sdk.js`, a stub that re-exports this object. The stub names no hashed chunk, so a
  // copy cached from an earlier deployment keeps working after the chunks it was built with are gone.
  // Imported here, not at the top: the SDK reaches core modules that import this catalog.
  (globalThis as { __demolitionSdk?: unknown }).__demolitionSdk = await import("./sdk.js");
  const base = new URL(import.meta.env.BASE_URL, document.baseURI);
  const response = await fetch(new URL("mods/manifest.json", base), { cache: "no-store" });
  if (!response.ok) throw new Error(t("Mod 清单加载失败 · HTTP {0}", response.status));
  const manifest = await response.json();
  const root = new URL(import.meta.env.DEV ? "src/modules/" : "mods/", base);
  const [skills, items, perks, skinPacks, bombFinishes, mapPacks, mutationPacks] = await Promise.all([
    loadCategory<ContentModule>(root, manifest, "skills"),
    loadCategory<ContentModule>(root, manifest, "items"),
    loadCategory<ContentModule>(root, manifest, "perks"),
    loadCategory<SkinPack>(root, manifest, "skins"),
    loadCategory<BombFinish>(root, manifest, "bomb-finishes"),
    loadCategory<MapDefinition>(root, manifest, "maps"),
    loadCategory<MutationDefinition>(root, manifest, "mutations"),
  ]);
  content.push(...skills, ...items, ...perks);
  skins.push(...skinPacks);
  finishes.push(...bombFinishes);
  maps.push(...mapPacks);
  mutations.push(...mutationPacks);
}
