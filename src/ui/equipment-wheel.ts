import { t, field } from "../i18n";
import { EQUIPMENT_SLOTS, ITEMS } from "../core/content";
import { canEquip } from "../core/equipment";
import type { GameSnapshot, Player } from "../core/types";
import { icon } from "./icons";
import { bindings, equipmentBinding } from "../input/bindings";

function polar(angle: number, radius: number) {
  return [50 + Math.sin(angle)*radius, 50 - Math.cos(angle)*radius];
}
function sector(start: number, end: number) {
  const steps = Math.ceil((end - start) / .08);
  const angles = Array.from({length:steps+1}, (_,i) => start + (end-start)*i/steps);
  const points = [...angles.map(a=>polar(a,49.5)), ...angles.reverse().map(a=>polar(a,21.5))];
  return `polygon(${points.map(([x,y])=>`${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`;
}
const label = (id: string) => id === "bomb" ? t("炸药") : field(ITEMS[id],"name");
const glyph = (id: string) => icon(id === "bomb" ? "bubble" : ITEMS[id].icon);

export class EquipmentWheel {
  private slots = new Map<string,{slot:HTMLElement; count:HTMLElement}>();
  private selected = "";
  private shown = "";
  private drag?:{x:number; y:number; hover?:string};
  private hub: HTMLElement;
  private caption: HTMLElement;
  private pointer = document.createElement("i");
  constructor(private root: HTMLElement) {
    const ring = document.createElement("div");
    ring.className = "gear-ring";
    ring.setAttribute("role","list");
    const angle = 2*Math.PI / EQUIPMENT_SLOTS.length;
    EQUIPMENT_SLOTS.forEach((id,i) => {
      const slot = document.createElement("div");
      slot.setAttribute("role","listitem");
      slot.className = "gear-sector";
      slot.style.clipPath = sector((i-.5)*angle+.012,(i+.5)*angle-.012);
      const [x,y] = polar(i*angle,35);
      slot.innerHTML = `<span class="gear-slot" style="left:${x}%;top:${y}%">${glyph(id)}<small></small></span>`;
      const hint = document.createElement("kbd");
      hint.dataset.keyhint = equipmentBinding(id);
      slot.querySelector(".gear-slot")!.append(hint);
      this.slots.set(id,{slot,count:slot.querySelector("small")!});
      ring.append(slot);
    });
    this.hub = document.createElement("div");
    this.hub.className = "gear-hub";
    this.pointer.className = "gear-pointer";
    this.pointer.setAttribute("aria-hidden","true");
    ring.append(this.hub,this.pointer);
    this.caption = document.createElement("div");
    this.caption.className = "gear-caption";
    root.append(ring,this.caption);
  }
  refreshLanguage() {
    this.shown = "";
    for (const [id,{slot,count}] of this.slots) {
      slot.setAttribute("aria-label",label(id)+" · "+count.textContent);
    }
  }
  beginDrag() {
    this.drag = {x:0,y:0};
    this.pointer.style.left = this.pointer.style.top = "50%";
    this.root.classList.add("drag-select");
  }
  moveDrag(dx:number,dy:number) {
    const drag = this.drag;
    if (!drag) return;
    drag.x+=dx;
    drag.y+=dy;
    const distance=Math.hypot(drag.x,drag.y);
    if (distance>70) { drag.x*=70/distance; drag.y*=70/distance; }
    // The 14-pixel dead zone ends at the inner edge of the visible sectors.
    const radius = distance < 14 ? distance*21.5/14 : 21.5+(Math.min(distance,70)-14)*23/56;
    const angle = Math.atan2(drag.x,-drag.y);
    this.pointer.style.left = (50 + Math.sin(angle)*radius)+"%";
    this.pointer.style.top = (50 - Math.cos(angle)*radius)+"%";
    const turn=angle/(2*Math.PI);
    const count=EQUIPMENT_SLOTS.length;
    const next=distance<14 ? undefined : EQUIPMENT_SLOTS[(Math.round(turn*count)+count)%count];
    if (next === drag.hover) return;
    if (drag.hover) this.slots.get(drag.hover)?.slot.classList.remove("hovered");
    drag.hover=next;
    if (next) this.slots.get(next)?.slot.classList.add("hovered");
    this.showGear(next ?? this.selected);
    return next;
  }
  endDrag() {
    const hover=this.drag?.hover;
    if (hover) this.slots.get(hover)?.slot.classList.remove("hovered");
    this.drag=undefined;
    this.root.classList.remove("drag-select");
    this.showGear(this.selected);
    return hover;
  }
  update(state: Readonly<GameSnapshot>, self: Player) {
    const free = Math.max(0,self.capacity-state.bombs.filter(b=>b.ownerId === self.id).length);
    for (const [id,{slot,count}] of this.slots) {
      const active = id === self.equipped;
      const value = id === "bomb" ? `${free}/${self.capacity}` : ITEMS[id].permanent ? "∞" : String(self.inventory[id] ?? 0);
      slot.classList.toggle("unavailable",!self.alive || !canEquip(self,id));
      if (count.textContent !== value) {
        count.textContent = value;
        slot.setAttribute("aria-label",`${label(id)} · ${value}`);
      }
      slot.classList.toggle("selected",active);
      if (this.selected !== self.equipped) slot.setAttribute("aria-current",String(active));
    }
    this.selected = self.equipped;
    this.showGear(this.drag?.hover ?? self.equipped);
  }
  private showGear(id:string) {
    if (!id || this.shown===id) return;
    this.shown=id;
    this.hub.innerHTML = glyph(id);
    this.caption.replaceChildren(document.createTextNode(label(id)));
    const key = document.createElement("kbd");
    key.dataset.keyhint = "gearWheel";
    key.textContent = bindings.label("gearWheel");
    this.caption.append(key);
  }
}
