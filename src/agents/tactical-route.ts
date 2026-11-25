import { modifiedStat } from "../core/content";
import { DIRECTIONS } from "../core/maps";
import type { GameSnapshot, Player, Vec2 } from "../core/types";
import type { BombForecast } from "./bomb-forecast";

const MOVES = [...DIRECTIONS, { x: 0, z: 0 }];
type Route = { first: Vec2; score: number; cell: Vec2 };

/** Layered BFS with a wait edge. Only settle at cells safe through the last predicted blast. */
export function safeRoute(
  s: Readonly<GameSnapshot>,
  p: Player,
  forecast: BombForecast,
  depth: number,
  value: (cell: Vec2) => number,
  escapeOnly = false,
  walkScale = 1,
): Route | undefined {
  const start = { x: Math.round(p.x), z: Math.round(p.z) };
  const step = 1 / Math.max(0.001, walkScale * modifiedStat(p, "moveSpeed", p.speed, s.time));
  const offset = Math.hypot(start.x - p.x, start.z - p.z) * step;
  let layer = [{ cell: start, first: start }];
  let best: Route | undefined;
  const values = new Map<number, number>();
  // In a calm arena ordinary BFS visits each cell once. Revisit by time only while hazards exist.
  const settled = new Set<number>([start.z * s.size + start.x]);
  for (let turn = 0; turn <= depth && layer.length; turn++) {
    const from = turn * step,
      to = from + step;
    const next: typeof layer = [],
      seen = new Set<number>();
    for (const node of layer) {
      const { x, z } = node.cell,
        id = z * s.size + x;
      if (!forecast.burning(x, z, Math.max(0, from - offset), Math.max(from, forecast.horizon) + 0.12)) {
        if (!values.has(id)) values.set(id, value(node.cell));
        const score = values.get(id)! - turn * 0.85;
        if (escapeOnly) return { ...node, score };
        if (!best || score > best.score) best = { ...node, score };
      }
      for (const d of MOVES) {
        const nx = x + d.x,
          nz = z + d.z,
          k = nz * s.size + nx;
        if (s.tiles[nz]?.[nx] !== 0 || seen.has(k) || (!forecast.horizon && settled.has(k))) continue;
        const cross = from + step * 0.5;
        if (
          forecast.burning(x, z, from, cross + offset + 0.05) ||
          forecast.burning(nx, nz, Math.max(0, cross - offset - 0.05), to + offset + 0.05)
        )
          continue;
        const staying = nx === start.x && nz === start.z && x === nx && z === nz;
        if (!staying && forecast.occupied(nx, nz, Math.max(0, cross - offset), to + offset)) continue;
        seen.add(k);
        if (!forecast.horizon) settled.add(k);
        const cell = { x: nx, z: nz };
        next.push({ cell, first: turn === 0 ? cell : node.first });
      }
    }
    layer = next;
  }
  return best;
}
