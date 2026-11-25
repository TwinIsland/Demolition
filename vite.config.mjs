import { cp, mkdir, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineConfig } from "vite";
import { CATEGORIES, scanMods, writeManifest } from "./scripts/reindex.mjs";

function serveManifest(middlewares, root, base) {
  middlewares.use(async (req, res, next) => {
    const pathname = req.url?.split("?")[0];
    if (pathname !== "/mods/manifest.json" && pathname !== base + "mods/manifest.json") return next();
    try {
      const manifest = await scanMods(root);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(manifest));
    } catch (error) {
      next(error);
    }
  });
}

export default defineConfig({
  base: "./",
  build: {
    // A release directory may already contain mods installed by its owner.
    emptyOutDir: false,
    rollupOptions: {
      input: { game: "index.html", "mod-sdk": "src/modules/sdk.js" },
      preserveEntrySignatures: "exports-only",
      output: {
        entryFileNames: (chunk) => (chunk.name === "mod-sdk" ? "mods/sdk.js" : "assets/[name]-[hash].js"),
      },
    },
  },
  plugins: [
    {
      name: "game-mod-folders",
      configureServer(server) {
        serveManifest(server.middlewares, join(server.config.root, "src/modules"), server.config.base);
      },
      configurePreviewServer(server) {
        const dist = resolve(server.config.root, server.config.build.outDir);
        serveManifest(server.middlewares, join(dist, "mods"), server.config.base);
      },
      async writeBundle(options) {
        const root = resolve("src/modules");
        const target = resolve(options.dir, "mods");
        await mkdir(target, { recursive: true });
        await Promise.all(
          CATEGORIES.map((category) => cp(join(root, category), join(target, category), { recursive: true })),
        );
        await Promise.all([
          copyFile("scripts/reindex.mjs", join(target, "reindex.mjs")),
          copyFile(join(root, "README.md"), join(target, "README.md")),
        ]);
        await writeManifest(target);
      },
    },
  ],
});
