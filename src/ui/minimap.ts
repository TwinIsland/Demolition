import { obscured, DEFAULT_SMOKE } from "../core/equipment";
import { bombGuideColor, bombWarning } from "../core/bomb-warning";
import type { GameSnapshot, Player } from "../core/types";

export function drawMinimap(
  canvas: HTMLCanvasElement,
  state: Readonly<GameSnapshot>,
  self: Player,
  landing?: { x: number; z: number; valid: boolean },
) {
  const ctx = canvas.getContext("2d")!,
    w = canvas.width,
    pad = 10,
    cell = (w - pad * 2) / state.size;
  ctx.clearRect(0, 0, w, w);
  ctx.fillStyle = "#211e30";
  ctx.fillRect(0, 0, w, w);
  for (let z = 0; z < state.size; z++)
    for (let x = 0; x < state.size; x++) {
      const tile = state.tiles[z][x];
      ctx.fillStyle = tile === 1 ? "#5c566f" : tile === 2 ? "#a18273" : "#2c283c";
      ctx.beginPath();
      ctx.roundRect(pad + x * cell + 1, pad + z * cell + 1, cell - 2, cell - 2, 2);
      ctx.fill();
    }
  for (const zombie of state.zombies) {
    ctx.fillStyle = zombie.level === 3 ? "#cf90ff" : zombie.level === 2 ? "#edb456" : "#a8cf5d";
    const x = pad + (zombie.x + 0.5) * cell,
      y = pad + (zombie.z + 0.5) * cell;
    ctx.fillRect(x - cell * 0.19, y - cell * 0.19, cell * 0.38, cell * 0.38);
  }
  for (const item of state.items) {
    ctx.fillStyle = "#c9f6dc";
    ctx.fillRect(pad + (item.x + 0.35) * cell, pad + (item.z + 0.35) * cell, cell * 0.3, cell * 0.3);
  }
  for (const b of state.blasts) {
    ctx.fillStyle = "#c4f3ffa0";
    ctx.fillRect(pad + b.x * cell, pad + b.z * cell, cell, cell);
  }
  for (const b of state.bombs) {
    ctx.fillStyle = bombGuideColor(state.players, b.ownerId, self.id);
    ctx.globalAlpha = bombWarning(b.detonateAt, state.time, !!b.slide).lit ? 1 : 0.65;
    ctx.beginPath();
    ctx.arc(pad + (b.x + 0.5) * cell, pad + (b.z + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const cloud of state.smoke) {
    ctx.fillStyle = "#b8c3c977";
    ctx.beginPath();
    ctx.arc(
      pad + (cloud.x + 0.5) * cell,
      pad + (cloud.z + 0.5) * cell,
      (cloud.radius ?? DEFAULT_SMOKE.radius) * cell,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (const p of state.players) {
    if (p.id !== self.id && self.scanUntil <= state.time && obscured(state, self, p)) continue;
    if (!p.alive) continue;
    const x = pad + (p.x + 0.5) * cell,
      y = pad + (p.z + 0.5) * cell;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = "#211e30";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (p.id === self.id) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-p.yaw);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(0, -cell * 0.62);
      ctx.lineTo(-3, -cell * 0.3);
      ctx.lineTo(3, -cell * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
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
}
