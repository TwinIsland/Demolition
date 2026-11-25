import { ITEMS } from "../core/content";
import type { GameSnapshot, Player, Vec2 } from "../core/types";
import { CueTracker, relativeBearing } from "../feel/cues";
import { field } from "../i18n";
import "./feedback-hud.css";

const DIRECTION_LIFE = 1.3;
const MAX_DIRECTIONS = 4;

/** Restarts a CSS animation on an element that may already be playing it. */
function replay(element: HTMLElement, state: string) {
  element.removeAttribute("data-state");
  void element.offsetWidth;
  element.dataset.state = state;
}

/**
 * Combat feedback drawn over the 3D view: where damage came from, heal and shield flashes,
 * health change numbers, pickup notes and the kill marker. Reads snapshots only.
 */
export class FeedbackHud {
  private tracker = new CueTracker();
  private root = document.createElement("div");
  private edge = document.createElement("div");
  private directions = document.createElement("div");
  private kill = document.createElement("div");
  private pickup = document.createElement("div");
  private numbers = document.createElement("div");
  private live: { element: HTMLElement; source: Vec2; until: number }[] = [];

  constructor(container: HTMLElement) {
    this.root.id = "feel-hud";
    this.root.setAttribute("aria-hidden", "true");
    this.edge.className = "feel-edge";
    this.directions.className = "feel-directions";
    this.kill.className = "feel-kill";
    this.pickup.className = "feel-pickup";
    this.numbers.className = "feel-numbers";
    this.root.append(this.edge, this.directions, this.kill, this.pickup, this.numbers);
    container.append(this.root);
  }

  /** Call once per frame while a match is on screen. `viewYaw` is the camera yaw, `now` is wall time in seconds. */
  update(state: Readonly<GameSnapshot>, self: Readonly<Player>, viewYaw: number, now: number) {
    for (const cue of this.tracker.collect(state, self.id))
      switch (cue.type) {
        case "damage":
          if (cue.source) this.point(cue.source, now, "damage");
          if (cue.amount > 0) this.number(`-${Math.round(cue.amount)}`, "damage");
          break;
        case "blocked":
          if (cue.source) this.point(cue.source, now, "blocked");
          replay(this.edge, "blocked");
          break;
        case "consume":
          if (!cue.heals) break;
          replay(this.edge, "heal");
          if (cue.healed > 0) this.number(`+${Math.round(cue.healed)}`, "heal");
          break;
        case "pickup": {
          const item = ITEMS[cue.item];
          if (!item) break;
          this.pickup.textContent = `+ ${field(item, "name")}`;
          this.pickup.style.setProperty("--feel-accent", item.color);
          replay(this.pickup, "show");
          break;
        }
        case "strike":
          if (cue.killed) replay(this.kill, "show");
          break;
        case "elimination":
          replay(this.kill, "show");
          break;
      }

    let expired = false;
    for (const marker of this.live) {
      if (now >= marker.until) {
        marker.element.remove();
        expired = true;
        continue;
      }
      // Keep pointing at the attacker while the player turns.
      marker.element.style.transform = `rotate(${relativeBearing(self, marker.source, viewYaw).toFixed(3)}rad)`;
    }
    if (expired) this.live = this.live.filter((marker) => now < marker.until);
  }

  /** Removes transient markers, for example when leaving a match. */
  clear() {
    for (const marker of this.live) marker.element.remove();
    this.live = [];
    this.numbers.replaceChildren();
    for (const element of [this.edge, this.kill, this.pickup]) element.removeAttribute("data-state");
  }

  private point(source: Vec2, now: number, kind: "damage" | "blocked") {
    if (this.live.length >= MAX_DIRECTIONS) this.live.shift()!.element.remove();
    const element = document.createElement("i");
    element.dataset.kind = kind;
    this.directions.append(element);
    this.live.push({ element, source: { x: source.x, z: source.z }, until: now + DIRECTION_LIFE });
  }

  private number(text: string, kind: "damage" | "heal") {
    const element = document.createElement("b");
    element.dataset.kind = kind;
    element.textContent = text;
    element.style.setProperty("--feel-drift", `${(Math.random() * 2 - 1) * 26}px`);
    element.addEventListener("animationend", () => element.remove(), { once: true });
    this.numbers.append(element);
    while (this.numbers.childElementCount > 5) this.numbers.firstElementChild!.remove();
  }
}
