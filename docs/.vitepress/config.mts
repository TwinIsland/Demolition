import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

const docs = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Sidebar entries for one generated content folder, titled by each page's first heading. */
function contentPages(category: string) {
  const folder = join(docs, "content", category);
  return readdirSync(folder)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({
      text: readFileSync(join(folder, file), "utf8").match(/^# (.+)$/m)?.[1] ?? file,
      link: `/content/${category}/${file.replace(/\.md$/, "")}`,
    }))
    .sort((a, b) => a.text.localeCompare(b.text, "en"));
}
const contentGroup = (text: string, category: string) => ({
  text,
  collapsed: true,
  items: contentPages(category),
});

export default defineConfig({
  title: "Demolition Front Wiki",
  description: "Rules, numbers, modding and development guides for Demolition Front",
  lang: "en",
  // Served next to the game. Override with `--base` when the game is hosted under a sub-path.
  base: "/wiki/",
  cleanUrls: false,
  appearance: false,
  lastUpdated: false,
  srcExclude: ["tools/**"],
  rewrites: { "README.md": "index.md", ":folder/README.md": ":folder/index.md" },
  // Pages link to source files in the repository, which are not part of the site.
  ignoreDeadLinks: [/\/src\//, /\/public\//, /\.\.\/README/],
  head: [["link", { rel: "icon", href: "/wiki/logo.png" }]],
  themeConfig: {
    logo: "/logo.png",
    siteTitle: "Demolition Front Wiki",
    search: { provider: "local" },
    outline: { level: [2, 3], label: "Contents" },
    nav: [
      { text: "Play the game", link: "https://twinisland.github.io/Demolition/" },
      { text: "Playing", link: "/playing" },
      { text: "Content", link: "/content/" },
      { text: "Modding", link: "/modding/" },
      { text: "Development", link: "/developer-guide" },
    ],
    sidebar: [
      {
        text: "Playing",
        items: [
          { text: "Main page", link: "/" },
          { text: "How to play", link: "/playing" },
          { text: "Game rules", link: "/game-rules" },
          { text: "Probabilities", link: "/probabilities" },
        ],
      },
      {
        text: "Content",
        items: [
          { text: "Content reference", link: "/content/" },
          contentGroup("Skills", "skills"),
          contentGroup("Items", "items"),
          contentGroup("Perks", "perks"),
          contentGroup("Mutations", "mutations"),
        ],
      },
      {
        text: "Modding",
        items: [
          { text: "Overview", link: "/modding/" },
          { text: "Map mods", link: "/modding/maps" },
          { text: "Item mods", link: "/modding/items" },
          { text: "Skill mods", link: "/modding/skills" },
          { text: "Perk mods", link: "/modding/perks" },
          { text: "Other packs", link: "/modding/other-packs" },
        ],
      },
      {
        text: "Development",
        items: [
          { text: "Developer guide", link: "/developer-guide" },
          { text: "Architecture (中文)", link: "/architecture" },
          { text: "Performance (中文)", link: "/performance" },
        ],
      },
    ],
    docFooter: { prev: false, next: false },
  },
});
