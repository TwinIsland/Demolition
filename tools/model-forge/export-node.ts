// Exports one forge model without a browser: npx tsx tools/model-forge/export-node.ts ordnance/missile out.glb
import { writeFile } from "node:fs/promises";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { items } from "./items";
import { obstacles } from "./obstacles";
import { ordnance } from "./ordnance";
import { jungle } from "./jungle";
import { pool } from "./pool";
import { office } from "./office";

// GLTFExporter reads its binary chunks through FileReader, which Node does not provide.
class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}
Object.assign(globalThis, { FileReader: NodeFileReader });

const [id, out] = process.argv.slice(2);
const [group, name] = (id ?? "").split("/");
const build = { items, obstacles, ordnance, jungle, pool, office }[group]?.[name];
if (!build || !out) throw new Error("Usage: export-node.ts <items|obstacles|ordnance|jungle|pool|office>/<name> <out.glb>");
const model = build();
const buffer = (await new GLTFExporter().parseAsync(model, { binary: true })) as ArrayBuffer;
await writeFile(out, new Uint8Array(buffer));
console.log(out, buffer.byteLength, "bytes", JSON.stringify(model.userData));
