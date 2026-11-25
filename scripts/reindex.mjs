import { readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

export const CATEGORIES = ["skills", "items", "perks", "mutations", "skins", "bomb-finishes", "maps"];
// An in-place build preserves installed mods and may still contain these old built-ins.
const RETIRED_ITEMS = new Set(["capacity", "core", "heal", "range", "speed"]);

export async function scanMods(root) {
  const entries = await Promise.all(
    CATEGORIES.map(async (category) => {
      const folder = join(root, category);
      const dirs = await readdir(folder, { withFileTypes: true }).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      const packs = await Promise.all(
        dirs
          .filter((dir) => dir.isDirectory())
          .map(async (dir) => {
            if (category === "items" && RETIRED_ITEMS.has(dir.name)) return;
            const entry = await stat(join(folder, dir.name, "index.js")).catch((error) => {
              if (error.code !== "ENOENT") throw error;
            });
            if (!entry?.isFile()) return;
            if (!/^[a-z][a-z0-9-]*$/.test(dir.name))
              throw new Error(`Invalid mod folder: ${category}/${dir.name}`);
            return dir.name;
          }),
      );
      return [category, packs.filter(Boolean).sort()];
    }),
  );
  return Object.fromEntries(entries);
}

export async function writeManifest(root) {
  const manifest = await scanMods(root);
  const temp = join(root, `manifest.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(manifest, null, 2) + "\n");
  await rename(temp, join(root, "manifest.json"));
}

// The release includes this script next to its manifest. No npm installation needed.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await writeManifest(dirname(fileURLToPath(import.meta.url)));
}
