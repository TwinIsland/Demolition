import { bombGuideColor, bombWarning } from "../core/bomb-warning";
import { strikeRevealed } from "../core/systems/strikes";
import { isCloaked } from "../core/types";
import type { GameSnapshot, Player } from "../core/types";
import { ringOf } from "../core/zone";
import { drawMapFrame, drawSelfMarker, mapBackdrop, mapPalette } from "./tactical-map";

/** The radar is drawn in these units whatever the canvas resolution is. */
const UNITS = 260;
const CASING = "#05080ae6";

export function drawMinimap(
  canvas: HTMLCanvasElement,
  state: Readonly<GameSnapshot>,
  self: Player,
  landing?: { x: number; z: number; valid: boolean },
) {
  const ctx = canvas.getContext("2d")!,
    scale = canvas.width / UNITS,
    w = UNITS,
    pad = 8,
    cell = (w - pad * 2) / state.size;
  const palette = mapPalette(state.mapId);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(mapBackdrop(state.mapId, state.size, canvas.width, pad * scale), 0, 0);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Walls read as solid blocks with a lit top edge; cover as smaller crates.
  for (let z = 0; z < state.size; z++)
    for (let x = 0; x < state.size; x++) {
      const tile = state.tiles[z][x];
      if (!tile) continue;
      const px = pad + x * cell,
        py = pad + z * cell;
      if (tile === 1) {
        ctx.fillStyle = "#00000059";
        ctx.fillRect(px + 1, py + 1.4, cell, cell);
        ctx.fillStyle = palette.wall;
        ctx.fillRect(px, py, cell + 0.3, cell + 0.3);
        if (state.tiles[z - 1]?.[x] !== 1) {
          ctx.fillStyle = palette.wallEdge;
          ctx.fillRect(px, py, cell + 0.3, Math.max(0.8, cell * 0.14));
        }
      } else {
        const inset = cell * 0.14;
        ctx.fillStyle = CASING;
        ctx.fillRect(px + inset - 0.6, py + inset - 0.6, cell - inset * 2 + 1.2, cell - inset * 2 + 1.2);
        ctx.fillStyle = palette.cover;
        ctx.fillRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2);
        ctx.fillStyle = palette.coverEdge;
        ctx.fillRect(px + inset, py + inset, cell - inset * 2, Math.max(0.7, cell * 0.12));
      }
    }
  // The ring the boundary wall is about to take.
  const warning = state.zone?.warningRing;
  if (warning !== undefined) {
    ctx.fillStyle = Math.sin(state.time * 10) > 0 ? "#ff4a3a8c" : "#ff4a3a40";
    for (let z = 0; z < state.size; z++)
      for (let x = 0; x < state.size; x++)
        if (ringOf(state.size, { x, z }) === warning)
          ctx.fillRect(pad + x * cell, pad + z * cell, cell, cell);
  }
  for (const zombie of state.zombies) {
    const x = pad + (zombie.x + 0.5) * cell,
      y = pad + (zombie.z + 0.5) * cell,
      r = cell * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.strokeStyle = CASING;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = zombie.level === 3 ? "#cf90ff" : zombie.level === 2 ? "#edb456" : "#a8cf5d";
    ctx.fill();
  }
  for (const item of state.items) {
    ctx.fillStyle = "#c9f6dc";
    ctx.fillRect(pad + (item.x + 0.35) * cell, pad + (item.z + 0.35) * cell, cell * 0.3, cell * 0.3);
  }
  // Incoming missiles: the blast radius and a blinking centre.
  for (const strike of state.strikes ?? []) {
    if (!strikeRevealed(strike, state.time, self.id)) continue;
    const cx = pad + (strike.x + 0.5) * cell,
      cy = pad + (strike.z + 0.5) * cell;
    ctx.fillStyle = "#ff3b2f38";
    ctx.strokeStyle = "#ff5a47";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, (strike.radius + 0.5) * cell, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (Math.sin(state.time * 14) > 0) {
      ctx.fillStyle = "#ffd9cf";
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    }
  }
  for (const b of state.blasts) {
    ctx.fillStyle = "#c4f3ffa0";
    ctx.fillRect(pad + b.x * cell, pad + b.z * cell, cell, cell);
  }
  for (const b of state.bombs) {
    ctx.fillStyle = bombGuideColor(state.players, b.ownerId, self.id);
    ctx.globalAlpha = bombWarning(b.detonateAt, state.time, !!b.slide).lit ? 1 : 0.65;
    ctx.beginPath();
    ctx.arc(pad + (b.x + 0.5) * cell, pad + (b.z + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = CASING;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ff8a3acc";
  for (const fire of state.fires)
    ctx.fillRect(pad + (fire.x + 0.12) * cell, pad + (fire.z + 0.12) * cell, cell * 0.76, cell * 0.76);
  for (const p of state.players) {
    if (p.id === self.id || !p.alive) continue;
    if (self.scanUntil <= state.time && isCloaked(p, state.time)) continue;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = CASING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pad + (p.x + 0.5) * cell, pad + (p.z + 0.5) * cell, Math.max(3, cell * 0.34), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
  }
  // The viewer goes on last, over every other contact.
  if (self.alive)
    drawSelfMarker(ctx, pad + (self.x + 0.5) * cell, pad + (self.z + 0.5) * cell, {
      radius: Math.max(6.5, cell * 0.62),
      yaw: self.yaw,
      color: self.color,
    });
  if (landing && landing.x >= 0 && landing.z >= 0 && landing.x < state.size && landing.z < state.size) {
    const cx = pad + (landing.x + 0.5) * cell,
      cy = pad + (landing.z + 0.5) * cell,
      r = cell * 0.56;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = "#101b20";
    ctx.fill();
    ctx.strokeStyle = "#101b20";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = landing.valid ? "#65ffcf" : "#ff7669";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    if (landing.valid) {
      ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "#edfff8";
      ctx.fill();
    } else {
      const k = r * 0.43;
      ctx.moveTo(cx - k, cy - k);
      ctx.lineTo(cx + k, cy + k);
      ctx.moveTo(cx + k, cy - k);
      ctx.lineTo(cx - k, cy + k);
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
  }
  drawMapFrame(ctx, w, "#e7bc70cc");
}
