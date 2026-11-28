// Lists the Chinese text of the story that has no English yet (and English left without a source).
// Usage: node scripts/story-i18n.mjs [--json]
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const root = new URL("../src/story/", import.meta.url).pathname;
const HAN = /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef…]/;
const files = readdirSync(root, { recursive: true })
  .map((name) => join(root, String(name)))
  .filter((file) => file.endsWith(".ts") && !file.includes("/locales/"));
const parse = (file) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

const keysOf = (file) => {
  const keys = new Set();
  (function walk(node) {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer)) keys.add(node.name.text);
    ts.forEachChild(node, walk);
  })(parse(file));
  return keys;
};
const known = keysOf(join(root, "locales/en.ts"));
// Words the story shares with the rest of the game are in the game's own dictionary.
const shared = keysOf(join(root, "../locales/en.ts"));

const found = new Map();
for (const file of files) {
  const source = parse(file);
  (function walk(node) {
    if (ts.isStringLiteralLike(node) && HAN.test(node.text) && !ts.isImportDeclaration(node.parent)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      // An act's title is its ordinal and its name, shown apart.
      for (const text of node.text.split("\u3000"))
        if (text && !found.has(text)) found.set(text, `${relative(root, file)}:${line + 1}`);
    } else if (
      ts.isTemplateExpression(node) &&
      [node.head, ...node.templateSpans.map((span) => span.literal)].some((part) => HAN.test(part.text))
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      console.error(`template with text, check by hand: ${relative(root, file)}:${line + 1}`);
    }
    ts.forEachChild(node, walk);
  })(source);
}

const missing = [...found].filter(([text]) => !known.has(text) && !shared.has(text));
const stale = [...known].filter((text) => !found.has(text));
if (process.argv.includes("--json")) console.log(JSON.stringify(Object.fromEntries(missing), null, 1));
else {
  for (const [text, where] of missing) console.log(`${where}\t${text}`);
  for (const text of stale) console.log(`(no longer in the story)\t${text}`);
  console.log(`${found.size} lines, ${missing.length} without English, ${stale.length} stale`);
}
