import { ITEMS } from "../core/content";
import { SUPPLY } from "../core/economy";
import { SUPPLY_CATALOG, supplyPrice, supplyRefusal, type SupplyRefusal } from "../core/systems/supply";
import type { ItemId } from "../core/types";
import { field, t } from "../i18n";
import { bindings } from "../input/bindings";
import { HtmlSlot, replayAnimation, setText } from "./dom";
import { artIcon, icon } from "./icons";
import type { HudFrame, HudView } from "./view";

type ShopCue = "open" | "close" | "buy" | "deny";

export interface SupplyShopHost {
  /** Whether the local player is in control of a live operator right now. */
  canOpen(): boolean;
  /** Freezes or releases camera look and equipment use while the wheel is held. */
  setSelecting(selecting: boolean): void;
  /** Queues the purchase for the next simulation input. */
  buy(id: ItemId): void;
  sound(cue: ShopCue): void;
  /** Soft tick when the highlighted item changes. */
  tick(): void;
}

const REASON: Record<SupplyRefusal, string> = {
  unavailable: "暂不可用",
  cooldown: "补给冷却中",
  full: "携带已满",
  coins: "金币不足",
};
/** Mouse travel, in pixels, from the centre to the dead-zone edge and to the rim. */
const DEAD_ZONE = 14;
const REACH = 70;
const HUB_RADIUS = 27;
const CANCEL = "cancel";
type Slot = ItemId | typeof CANCEL;
/** Wheel order, clockwise from the top. The cancel sector sits opposite the first item, at the bottom. */
const SLOTS: readonly Slot[] = (() => {
  const slots: Slot[] = [...SUPPLY_CATALOG];
  slots.splice(Math.ceil(slots.length / 2), 0, CANCEL);
  return slots;
})();

function polar(angle: number, radius: number) {
  return [50 + Math.sin(angle) * radius, 50 - Math.cos(angle) * radius];
}
function sector(start: number, end: number) {
  const steps = Math.ceil((end - start) / 0.08);
  const angles = Array.from({ length: steps + 1 }, (_, i) => start + ((end - start) * i) / steps);
  const points = [...angles.map((a) => polar(a, 49.5)), ...angles.reverse().map((a) => polar(a, HUB_RADIUS))];
  return `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`;
}

/**
 * In-match supply shop, built like the equipment wheel: hold the supply key,
 * slide the mouse onto an item, release to buy it. The match keeps running and
 * the pointer stays locked. Releasing over the cancel sector or the centre, or
 * pressing Esc, buys nothing.
 */
export class SupplyShopView implements HudView {
  private readonly sectors = new Map<Slot, HTMLElement>();
  private readonly hub: HtmlSlot;
  private readonly pointer: HTMLElement;
  private readonly balance: HTMLElement;
  private readonly listeners = new AbortController();
  private frame?: HudFrame;
  private drag?: { x: number; y: number; key: string; hover?: Slot };
  /** Balance when a purchase was sent, to tell a completed trade from a refused one. */
  private pending?: { credits: number; at: number };

  constructor(
    readonly root: HTMLElement,
    private readonly host: SupplyShopHost,
  ) {
    root.hidden = true;
    const slice = (2 * Math.PI) / SLOTS.length;
    root.innerHTML = `<div class="supply-ring" role="list">${SLOTS.map((id, i) => {
      const [x, y] = polar(i * slice, 38.5);
      return `<div class="supply-sector" role="listitem" data-supply="${id}" style="clip-path:${sector((i - 0.5) * slice + 0.014, (i + 0.5) * slice - 0.014)}"><span class="supply-slot" style="left:${x}%;top:${y}%">${id === CANCEL ? icon("close") : artIcon(ITEMS[id])}<b></b><small></small></span></div>`;
    }).join(
      "",
    )}<div class="supply-hub"></div><i class="supply-pointer" aria-hidden="true"></i></div><div class="supply-caption"><span class="supply-balance">${icon("coin")}<b></b></span><span class="supply-hint"></span></div>`;
    for (const el of root.querySelectorAll<HTMLElement>(".supply-sector"))
      this.sectors.set(el.dataset.supply as Slot, el);
    this.hub = new HtmlSlot(root.querySelector(".supply-hub")!);
    this.pointer = root.querySelector(".supply-pointer")!;
    this.balance = root.querySelector(".supply-balance b")!;
    const { signal } = this.listeners;
    // Capture phase, so the held key and Esc do not reach other bindings or pause the match.
    window.addEventListener("keydown", (event) => this.onKeyDown(event), { capture: true, signal });
    window.addEventListener("keyup", (event) => this.onKeyUp(event), { capture: true, signal });
    window.addEventListener("mousemove", (event) => this.move(event.movementX, event.movementY), { signal });
    window.addEventListener("blur", () => this.end(false), { signal });
    document.addEventListener(
      "pointerlockchange",
      () => {
        if (!document.pointerLockElement) this.end(false);
      },
      { signal },
    );
  }

  get isOpen() {
    return this.drag !== undefined;
  }

  update(frame: HudFrame) {
    this.frame = { ...frame };
    const { snapshot, viewer } = frame;
    if (this.pending) {
      if (viewer.credits < this.pending.credits) {
        this.host.sound("buy");
        this.pending = undefined;
      } else if (performance.now() - this.pending.at > 600) this.pending = undefined;
    }
    if (!this.drag) return;
    if (!viewer.alive || snapshot.phase !== "playing") return this.end(false);
    this.paint();
  }

  private paint() {
    const frame = this.frame;
    if (!frame) return;
    const { snapshot, viewer } = frame;
    for (const [id, el] of this.sectors) {
      if (id === CANCEL) {
        setText(el.querySelector("small")!, t("取消"));
        continue;
      }
      const refusal = supplyRefusal(snapshot, viewer, id);
      el.dataset.refusal = refusal ?? "";
      setText(el.querySelector("b")!, String(supplyPrice(viewer, id)));
      setText(el.querySelector("small")!, `${viewer.inventory[id] ?? 0}/${SUPPLY.carryLimit}`);
    }
    setText(this.balance, String(viewer.credits));
    setText(
      this.root.querySelector(".supply-hint")!,
      t("按住 {0}，移动鼠标，松开购买", bindings.label("supply")),
    );
    const id = this.drag?.hover;
    if (id === CANCEL) {
      this.hub.render(`<strong>${t("取消")}</strong><small>${t("松开关闭，不购买")}</small>`);
      return;
    }
    if (!id) {
      const wait = Math.ceil(Math.max(0, (viewer.supplyReadyAt ?? 0) - snapshot.time));
      const note = snapshot.zone?.final
        ? t("火场阶段补给关闭")
        : wait > 0
          ? t("下次补给 {0} 秒", wait)
          : t("滑向物品");
      this.hub.render(`<strong>${t("补给")}</strong><small>${note}</small>`);
      return;
    }
    const refusal = supplyRefusal(snapshot, viewer, id);
    const wait = Math.ceil(Math.max(0, (viewer.supplyReadyAt ?? 0) - snapshot.time));
    const note = !refusal
      ? t("松开购买")
      : refusal === "cooldown"
        ? t("下次补给 {0} 秒", wait)
        : t(REASON[refusal]);
    this.hub.render(
      `<strong>${field(ITEMS[id], "name")}</strong><span class="supply-price">${icon("coin")}${supplyPrice(viewer, id)}</span><small data-refused="${Boolean(refusal)}">${note}</small>`,
    );
  }

  private onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (this.drag && event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.end(false);
      return;
    }
    if (bindings.action(event.code) !== "supply") return;
    if (this.drag) {
      // Auto-repeat of the held key.
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.repeat || !this.host.canOpen() || !this.frame) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.drag = { x: 0, y: 0, key: event.code };
    this.pointer.style.left = this.pointer.style.top = "50%";
    this.root.hidden = false;
    this.host.setSelecting(true);
    this.host.sound("open");
    this.paint();
  }

  private onKeyUp(event: KeyboardEvent) {
    if (this.drag && event.code === this.drag.key) this.end(true);
  }

  private move(dx: number, dy: number) {
    const drag = this.drag;
    if (!drag) return;
    drag.x += dx;
    drag.y += dy;
    const distance = Math.hypot(drag.x, drag.y);
    if (distance > REACH) {
      drag.x *= REACH / distance;
      drag.y *= REACH / distance;
    }
    const reach = Math.min(distance, REACH);
    const radius =
      reach < DEAD_ZONE
        ? (reach * HUB_RADIUS) / DEAD_ZONE
        : HUB_RADIUS + ((reach - DEAD_ZONE) * (46 - HUB_RADIUS)) / (REACH - DEAD_ZONE);
    const angle = Math.atan2(drag.x, -drag.y);
    this.pointer.style.left = `${50 + Math.sin(angle) * radius}%`;
    this.pointer.style.top = `${50 - Math.cos(angle) * radius}%`;
    const count = SLOTS.length;
    const next =
      distance < DEAD_ZONE ? undefined : SLOTS[(Math.round((angle / (2 * Math.PI)) * count) + count) % count];
    if (next === drag.hover) return;
    if (drag.hover) this.sectors.get(drag.hover)?.classList.remove("hovered");
    drag.hover = next;
    if (next) {
      this.sectors.get(next)?.classList.add("hovered");
      this.host.tick();
    }
    this.paint();
  }

  /** Closes the wheel; with `commit`, buys the highlighted item if the shop would sell it. */
  private end(commit: boolean) {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    const id = drag.hover;
    if (id) this.sectors.get(id)?.classList.remove("hovered");
    this.host.setSelecting(false);
    const frame = this.frame;
    if (commit && id && id !== CANCEL && frame && this.host.canOpen()) {
      if (supplyRefusal(frame.snapshot, frame.viewer, id)) {
        this.host.sound("deny");
        // Keep the wheel up for the length of the shake so the refusal is seen.
        replayAnimation(this.root, "refused");
        window.setTimeout(() => {
          if (!this.drag) this.root.hidden = true;
        }, 360);
        return;
      }
      this.pending = { credits: frame.viewer.credits, at: performance.now() };
      this.host.buy(id);
    } else this.host.sound("close");
    this.root.hidden = true;
  }

  dispose() {
    this.listeners.abort();
    if (this.drag) this.host.setSelecting(false);
  }
}
