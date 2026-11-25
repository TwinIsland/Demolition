import { readdir } from "node:fs/promises";
import type { ContentModule, MutationDefinition } from "../core/module-api";
import type { SkinPack, MapDefinition, BombFinish } from "../core/pack-api";

async function discover<T>(category: string): Promise<T[]> {
  const base = new URL(`./${category}/`, import.meta.url);
  const dirs = await readdir(base, { withFileTypes: true });
  const entries = dirs.filter(dir => dir.isDirectory()).sort((a,b) => a.name.localeCompare(b.name,"en"));
  return Promise.all(entries.map(async dir => (await import(new URL(`${dir.name}/index.js`, base).href)).default));
}
const [skills, items, perks, skins, finishes, maps, mutations] = await Promise.all([
  discover<ContentModule>("skills"), discover<ContentModule>("items"), discover<ContentModule>("perks"),
  discover<SkinPack>("skins"), discover<BombFinish>("bomb-finishes"), discover<MapDefinition>("maps"),
  discover<MutationDefinition>("mutations"),
]);
export { skins, finishes, maps, mutations };
export default [...skills, ...items, ...perks];
