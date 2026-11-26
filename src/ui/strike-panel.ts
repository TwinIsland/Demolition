import { bombGuideColor } from "../core/bomb-warning";
import type { PerkDefinition } from "../core/module-api";
import { strikeCells, strikeTargetValid } from "../core/systems/strikes";
import { isCloaked } from "../core/types";
import type { GameSnapshot, Player, Vec2 } from "../core/types";
import { field, t } from "../i18n";
import { query, setText } from "./dom";
import { icon } from "./icons";
import type { HudFrame, HudView } from "./view";

export interface StrikePanelActions {
  confirm(target: Vec2): void;
  cancel(): void;
  /** The cursor moved onto another cell. */
  tick(): void;
}

const PAD = 18;
const INK = "#8dffc4";

/**
 * Targeting tablet for perks that need a cell: a 2D tactical map of the arena. Move the mouse (or
 * use the movement keys) to place the cursor, click or press Enter to fire, right-click or Esc to
 * cancel. The match keeps running underneath, so the operator stands exposed while picking.
 */
export class StrikePanel implements HudView {
  private readonly canvas: HTMLCanvasElement;
  private readonly title: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly brief: HTMLElement;
  private readonly listeners = new AbortController();
  private perk?: PerkDefinition;
  private cursor?: Vec2;
  private view?: { snapshot: Readonly<GameSnapshot>; viewer: Player };

  constructor(
    readonly root: HTMLElement,
    private readonly actions: StrikePanelActions,
  ) {
    root.hidden = true;
    root.innerHTML = `<div class="strike-tablet"><header><span class="strike-title"></span><span class="strike-readout"></span></header>
      <div class="strike-screen"><canvas width="640" height="640"></canvas><i class="strike-sweep"></i></div>
      <footer><span class="strike-brief"></span><span class="strike-keys"></span></footer></div>`;
    this.canvas = query<HTMLCanvasElement>(root, "canvas");
    this.title = query(root, ".strike-title");
    this.readout = query(root, ".strike-readout");
    this.brief = query(root, ".strike-brief");
    const { signal } = this.listeners;
    this.canvas.addEventListener("mousemove", (event) => this.point(event), { signal });
    this.canvas.addEventListener("mouseleave", () => this.aim(undefined), { signal });
    root.addEventListener(
      "mousedown",
      (event) => {
        if (!this.isOpen) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) this.actions.cancel();
        else if (event.button === 0 && event.target === this.canvas) {
          this.point(event);
          this.confirm();
        }
      },
      { signal },
    );
  }

  get isOpen() {
    return !!this.perk;
  }

  open(perk: PerkDefinition, snapshot: Readonly<GameSnapshot>, viewer: Player) {
    this.perk = perk;
    this.view = { snapshot, viewer };
    // Start on the operator's own cell, so the keyboard can steer from somewhere sensible.
    this.cursor = { x: Math.round(viewer.x), z: Math.round(viewer.z) };
    this.root.hidden = false;
    this.title.innerHTML = `${icon(perk.icon)}<b>${field(perk, "name")}</b><small>${t("选择落点")}</small>`;
    query(this.root, ".strike-keys").innerHTML =
      `<span><kbd>${t("左键")}</kbd>/<kbd>Enter</kbd> ${t("确认发射")}</span><span><kbd>${t("右键")}</kbd>/<kbd>Esc</kbd> ${t("取消")}</span>`;
    const { delay, radius } = perk.stats ?? {};
    setText(this.brief, delay && radius ? t("{0} 秒后命中 · 半径 {1} 格", delay, radius) : "");
    this.draw();
  }

  close() {
    this.perk = this.view = this.cursor = undefined;
    this.root.hidden = true;
  }

  /** Keyboard steering: one cell per press. */
  nudge(dx: number, dz: number) {
    const size = this.view?.snapshot.size;
    if (!size) return;
    const from = this.cursor ?? { x: Math.floor(size / 2), z: Math.floor(size / 2) };
    this.aim({
      x: Math.max(1, Math.min(size - 2, from.x + dx)),
      z: Math.max(1, Math.min(size - 2, from.z + dz)),
    });
  }

  confirm() {
    if (this.view && strikeTargetValid(this.view.snapshot, this.cursor)) this.actions.confirm(this.cursor);
  }

  update({ snapshot, viewer }: HudFrame) {
    if (!this.isOpen) return;
    this.view = { snapshot, viewer };
    this.draw();
  }

  dispose() {
    this.listeners.abort();
  }

  private point(event: MouseEvent) {
    const size = this.view?.snapshot.size;
    if (!size) return;
    const box = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / box.width;
    const cell = (this.canvas.width - PAD * 2) / size;
    const target = {
      x: Math.floor(((event.clientX - box.left) * scale - PAD) / cell),
      z: Math.floor(((event.clientY - box.top) * scale - PAD) / cell),
    };
    this.aim(strikeTargetValid(this.view!.snapshot, target) ? target : undefined);
  }

  private aim(target: Vec2 | undefined) {
    const moved = target?.x !== this.cursor?.x || target?.z !== this.cursor?.z;
    this.cursor = target;
    if (!moved) return;
    if (target) this.actions.tick();
    this.draw();
  }

  private draw() {
    if (!this.view || !this.perk) return;
    const { snapshot: s, viewer } = this.view;
    const ctx = this.canvas.getContext("2d")!,
      w = this.canvas.width,
      cell = (w - PAD * 2) / s.size;
    const at = (v: number) => PAD + v * cell;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = "#06120e";
    ctx.fillRect(0, 0, w, w);
    for (let z = 0; z < s.size; z++)
      for (let x = 0; x < s.size; x++) {
        const tile = s.tiles[z][x];
        ctx.fillStyle = tile === 1 ? "#2f6b54" : tile === 2 ? "#8a7a3c" : "#0c231b";
        ctx.fillRect(at(x) + 1, at(z) + 1, cell - 2, cell - 2);
      }
    // Grid references along the top and left edges.
    ctx.fillStyle = "#8dffc480";
    ctx.font = `600 ${Math.max(9, cell * 0.36)}px "Barlow Semi Condensed", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 1; i < s.size - 1; i++) {
      ctx.fillText(column(i), at(i + 0.5), PAD * 0.5);
      ctx.fillText(String(i).padStart(2, "0"), PAD * 0.5, at(i + 0.5));
    }
    for (const strike of s.strikes ?? []) this.footprint(ctx, s, strike, strike.radius, cell, "#ff5a4766");
    for (const zombie of s.zombies) {
      ctx.fillStyle = "#c9e36a";
      ctx.fillRect(
        at(zombie.x + 0.5) - cell * 0.17,
        at(zombie.z + 0.5) - cell * 0.17,
        cell * 0.34,
        cell * 0.34,
      );
    }
    for (const bomb of s.bombs) {
      ctx.fillStyle = bombGuideColor(s.players, bomb.ownerId, viewer.id);
      ctx.beginPath();
      ctx.arc(at(bomb.x + 0.5), at(bomb.z + 0.5), cell * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of s.players) {
      if (!p.alive) continue;
      // Same sensor rules as the radar: optical camo hides a contact, a scan restores it.
      if (p.id !== viewer.id && viewer.scanUntil <= s.time && isCloaked(p, s.time)) continue;
      const x = at(p.x + 0.5),
        y = at(p.z + 0.5);
      ctx.fillStyle = p.id === viewer.id ? "#ffffff" : p.color;
      ctx.strokeStyle = "#06120e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (p.id === viewer.id) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-p.yaw);
        ctx.moveTo(0, -cell * 0.46);
        ctx.lineTo(cell * 0.32, cell * 0.34);
        ctx.lineTo(-cell * 0.32, cell * 0.34);
        ctx.closePath();
        ctx.restore();
      } else ctx.arc(x, y, cell * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const cursor = this.cursor;
    const radius = this.perk.stats?.radius ?? 0;
    if (!cursor) {
      setText(this.readout, "-- · --");
      return;
    }
    this.footprint(ctx, s, cursor, radius, cell, "#ff8a3d59");
    const cx = at(cursor.x + 0.5),
      cy = at(cursor.z + 0.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, PAD);
    ctx.lineTo(cx, w - PAD);
    ctx.moveTo(PAD, cy);
    ctx.lineTo(w - PAD, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffb27a";
    ctx.beginPath();
    ctx.arc(cx, cy, (radius + 0.5) * cell, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(cx - cell / 2 + 1, cy - cell / 2 + 1, cell - 2, cell - 2);
    const self = Math.hypot(viewer.x - cursor.x, viewer.z - cursor.z) <= radius + 0.5;
    this.readout.classList.toggle("danger", self);
    setText(
      this.readout,
      `${column(cursor.x)}-${String(cursor.z).padStart(2, "0")}${self ? " · " + t("你在爆炸范围内") : ""}`,
    );
  }

  private footprint(
    ctx: CanvasRenderingContext2D,
    s: Readonly<GameSnapshot>,
    target: Vec2,
    radius: number,
    cell: number,
    color: string,
  ) {
    ctx.fillStyle = color;
    for (const c of strikeCells(s, target, radius))
      ctx.fillRect(PAD + c.x * cell, PAD + c.z * cell, cell, cell);
  }
}

const column = (x: number) => String.fromCharCode(64 + ((x - 1) % 26) + 1);
