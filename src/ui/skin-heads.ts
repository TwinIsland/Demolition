/**
 * Minecraft-style head portraits for HUD player cards.
 *
 * Crops the 8x8 face and the hat overlay from a skin PNG into a tiny canvas and
 * paints it as the background of every `.avatar[data-player]` under the root.
 * Skin resolution mirrors `MinecraftSkins.get` in render/minecraft-skins.ts.
 */
import { DEFAULT_SKIN, SKINS } from "../core/room";

const FACE = 8;
const heads = new Map<string, string | Promise<void>>();

function skinSource(playerId: string, preset?: string): string {
  if ((!preset || preset === "custom") && playerId === "you") {
    try {
      const saved = localStorage.getItem("demolition-skin");
      if (saved) return saved;
    } catch {}
  }
  const fallback = playerId === "sunny" || playerId === "mint" ? SKINS.scout : undefined;
  return (SKINS[preset ?? ""] ?? fallback ?? DEFAULT_SKIN).texture;
}

async function cropHead(source: string): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const scale = image.naturalWidth / 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = FACE * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const size = FACE * scale;
  // Face at (8,8) and hat layer at (40,8), the same in 64x32 and 64x64 layouts.
  ctx.drawImage(image, 8 * scale, 8 * scale, size, size, 0, 0, size, size);
  ctx.drawImage(image, 40 * scale, 8 * scale, size, size, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

function paint(avatar: HTMLElement) {
  const source = skinSource(avatar.dataset.player ?? "", avatar.dataset.skin || undefined);
  const head = heads.get(source);
  if (typeof head === "string") {
    avatar.style.backgroundImage = `url("${head}")`;
    avatar.classList.add("skin-head");
    return;
  }
  if (head) return;
  heads.set(
    source,
    cropHead(source).then(
      (url) => {
        heads.set(source, url);
        document.querySelectorAll<HTMLElement>(".avatar[data-player]").forEach(paint);
      },
      () => {
        heads.delete(source);
      },
    ),
  );
}

/** Crops every bundled skin head up front so the HUD never decodes one mid-match. */
export function preloadSkinHeads(): Promise<void> {
  const jobs = Object.values(SKINS).map((skin) => {
    const source = skin.texture;
    const known = heads.get(source);
    if (typeof known === "string") return undefined;
    if (known) return known;
    const job = cropHead(source).then(
      (url) => {
        heads.set(source, url);
      },
      () => {
        heads.delete(source);
      },
    );
    heads.set(source, job);
    return job;
  });
  return Promise.all(jobs).then(() => undefined);
}

/** Keeps head portraits applied as the HUD re-renders its player rows. */
export function mountSkinHeads(root: HTMLElement): () => void {
  const refresh = () => root.querySelectorAll<HTMLElement>(".avatar[data-player]").forEach(paint);
  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList: true, subtree: true });
  refresh();
  return () => observer.disconnect();
}
