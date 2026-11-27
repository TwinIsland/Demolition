import { MAPS } from "../core/maps";
import type { MapDefinition } from "../core/pack-api";
import { motionLevel } from "../feel/settings";

/**
 * Shared drawing for the 2D tactical maps (HUD radar and the strike targeting tablet): the map
 * backdrop, per-theme palette and the marker of the locally controlled operator.
 */

export interface MapPalette {
  ground: string;
  /** Lighter blotches over the ground, used only by the procedural backdrop. */
  groundLift: string;
  wall: string;
  wallEdge: string;
  cover: string;
  coverEdge: string;
  water: string;
}

const PALETTES: Record<MapDefinition["theme"], MapPalette> = {
  garden: {
    ground: "#232c1f",
    groundLift: "#3a4a30",
    wall: "#a9b39a",
    wallEdge: "#e3ead6",
    cover: "#b98f5c",
    coverEdge: "#e6c391",
    water: "#3d8fb0",
  },
  midnight: {
    ground: "#151a25",
    groundLift: "#27324a",
    wall: "#8a96b0",
    wallEdge: "#d5def2",
    cover: "#b0875f",
    coverEdge: "#e2bd93",
    water: "#3d7fc0",
  },
  rainforest: {
    ground: "#18261b",
    groundLift: "#2c4a30",
    wall: "#87a383",
    wallEdge: "#d2e8cd",
    cover: "#ab8f55",
    coverEdge: "#dcc68d",
    water: "#3d9aa0",
  },
  poolrooms: {
    ground: "#15262b",
    groundLift: "#28474e",
    wall: "#bfd4d3",
    wallEdge: "#f1fbfa",
    cover: "#c9a86a",
    coverEdge: "#f0d9a6",
    water: "#49b6d6",
  },
  backrooms: {
    ground: "#28240f",
    groundLift: "#4a4220",
    wall: "#c5b671",
    wallEdge: "#f3e9b4",
    cover: "#9c7d4b",
    coverEdge: "#d3b582",
    water: "#3d8fb0",
  },
};

const mapOf = (mapId: string) => MAPS.find((map) => map.id === mapId);
export const mapPalette = (mapId: string): MapPalette => PALETTES[mapOf(mapId)?.theme ?? "midnight"];

/**
 * Optional painted ground for a map: `minimap.webp` (or .png / .jpg) next to the map's `index.js`.
 * Found at build time, so adding the file is all it takes. A map pack from outside this folder
 * can set `minimap` on its definition instead.
 */
const BUNDLED = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../modules/maps/*/minimap.{webp,png,jpg,jpeg}", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.split("/").at(-2)!, url]),
);
const art = new Map<string, HTMLImageElement>();

/** Decodes every map's minimap art behind the loading screen. A map without art uses the drawn backdrop. */
export function preloadMinimapArt(maps: readonly MapDefinition[] = MAPS): Promise<void>[] {
  return maps.flatMap((map) => {
    const url = map.minimap ?? BUNDLED[map.id];
    if (!url) return [];
    const image = new Image();
    image.src = url;
    return [image.decode().then(() => void art.set(map.id, image))];
  });
}

/** Deterministic noise, so the drawn backdrop of a map looks the same every match. */
function seeded(text: string) {
  let s = 2166136261;
  for (const ch of text) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };
}

const backdrops = new Map<string, HTMLCanvasElement>();

/**
 * Static ground layer of a map at `pixels` square: painted art when the map has it, otherwise a
 * drawn surface in the theme's colours. Water, grid lines and a vignette go over either. Cached.
 */
export function mapBackdrop(mapId: string, size: number, pixels: number, pad: number): HTMLCanvasElement {
  const key = `${mapId}:${size}:${pixels}:${pad}`;
  const cached = backdrops.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = pixels;
  const ctx = canvas.getContext("2d")!;
  const palette = mapPalette(mapId);
  const map = mapOf(mapId);
  const image = art.get(mapId);
  const cell = (pixels - pad * 2) / size;

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, pixels, pixels);
  if (image) {
    ctx.drawImage(image, 0, 0, pixels, pixels);
    // Painted art is kept under the markers: pull it down so contacts stay the brightest thing.
    ctx.fillStyle = "#05080a59";
    ctx.fillRect(0, 0, pixels, pixels);
  } else {
    const random = seeded(mapId);
    for (let i = 0; i < 46; i++) {
      const x = random() * pixels,
        y = random() * pixels,
        r = (0.06 + random() * 0.16) * pixels;
      const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
      blot.addColorStop(0, palette.groundLift + (random() > 0.5 ? "66" : "3d"));
      blot.addColorStop(1, palette.groundLift + "00");
      ctx.fillStyle = blot;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const grain = ctx.getImageData(0, 0, pixels, pixels);
    for (let i = 0; i < grain.data.length; i += 4) {
      const n = (random() - 0.5) * 22;
      grain.data[i] += n;
      grain.data[i + 1] += n;
      grain.data[i + 2] += n;
    }
    ctx.putImageData(grain, 0, 0);
  }

  if (map?.groundAt) {
    ctx.fillStyle = palette.water + (image ? "40" : "73");
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++)
        if (map.groundAt(x, z, size) === "water") ctx.fillRect(pad + x * cell, pad + z * cell, cell, cell);
  }

  ctx.strokeStyle = "#ffffff12";
  ctx.lineWidth = Math.max(1, pixels / 520);
  ctx.beginPath();
  for (let i = 0; i <= size; i++) {
    ctx.moveTo(pad + i * cell, pad);
    ctx.lineTo(pad + i * cell, pixels - pad);
    ctx.moveTo(pad, pad + i * cell);
    ctx.lineTo(pixels - pad, pad + i * cell);
  }
  ctx.stroke();

  const vignette = ctx.createRadialGradient(
    pixels / 2,
    pixels / 2,
    pixels * 0.32,
    pixels / 2,
    pixels / 2,
    pixels * 0.74,
  );
  vignette.addColorStop(0, "#00000000");
  vignette.addColorStop(1, "#000000a6");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, pixels, pixels);
  backdrops.set(key, canvas);
  return canvas;
}

export interface SelfMarkerOptions {
  /** Half-length of the arrow, in canvas units. */
  radius: number;
  /** Operator heading, radians, as stored on the player. */
  yaw: number;
  /** The player's roster colour, shown as the arrow's core. */
  color: string;
  /** Colour of the halo, the sweep cone and the arrow's rim. */
  ink?: string;
  /** Text drawn beside the marker, for example "YOU" on the targeting tablet. */
  label?: string;
}

/**
 * The local operator on a 2D map: a sonar-style pulse, a facing cone and a large rimmed arrow, so
 * it reads at a glance among the round contacts of everyone else. Drawn last, above all markers.
 */
export function drawSelfMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  { radius: r, yaw, color, ink = "#ffffff", label }: SelfMarkerOptions,
) {
  const motion = motionLevel();
  const now = performance.now() / 1000;
  ctx.save();
  ctx.translate(x, y);

  // Two staggered rings expanding from the marker; a steady ring when motion is turned down.
  ctx.strokeStyle = ink;
  for (const offset of motion === "full" ? [0, 0.5] : [0.45]) {
    const phase = motion === "full" ? (now / 1.6 + offset) % 1 : offset;
    ctx.globalAlpha = 0.85 * (1 - phase) ** 1.5;
    ctx.lineWidth = r * (0.28 - phase * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.1 + phase * 2.4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.rotate(-yaw);
  const reach = r * 4.2;
  const cone = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, reach);
  cone.addColorStop(0, ink + "70");
  cone.addColorStop(1, ink + "00");
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, reach, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
  ctx.closePath();
  ctx.fill();

  // Chevron arrow: dark casing, bright rim, roster colour in the core.
  const arrow = (k: number) => {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.15 * k);
    ctx.lineTo(r * 0.86 * k, r * 0.86 * k);
    ctx.lineTo(0, r * 0.4 * k);
    ctx.lineTo(-r * 0.86 * k, r * 0.86 * k);
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  arrow(1);
  ctx.strokeStyle = "#05080af2";
  ctx.lineWidth = r * 0.62;
  ctx.stroke();
  ctx.shadowColor = ink;
  ctx.shadowBlur = r * 1.1;
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.shadowBlur = 0;
  arrow(0.52);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  if (!label) return;
  ctx.save();
  ctx.font = `800 ${r * 1.15}px "Barlow Semi Condensed", "Noto Sans SC", sans-serif`;
  ctx.textBaseline = "middle";
  const width = ctx.measureText(label).width;
  // Keep the tag on the canvas: flip to the left of the marker near the right edge.
  const right = x + r * 2 + width + r < ctx.canvas.width;
  ctx.textAlign = right ? "left" : "right";
  const tx = x + (right ? r * 1.9 : -r * 1.9);
  ctx.lineWidth = r * 0.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#05080af2";
  ctx.strokeText(label, tx, y);
  ctx.fillStyle = ink;
  ctx.fillText(label, tx, y);
  ctx.restore();
}

/** Corner brackets and a north tick: the frame of a tactical display. */
export function drawMapFrame(ctx: CanvasRenderingContext2D, w: number, color: string) {
  const inset = w * 0.012,
    arm = w * 0.075;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, w / 170);
  ctx.beginPath();
  for (const [sx, sy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const x = sx ? w - inset : inset,
      y = sy ? w - inset : inset;
    ctx.moveTo(x + (sx ? -arm : arm), y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + (sy ? -arm : arm));
  }
  ctx.stroke();
  ctx.restore();
}
