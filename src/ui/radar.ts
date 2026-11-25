import { MAPS } from "../core/maps";
import { field } from "../i18n";
import { query, setText } from "./dom";
import { icon } from "./icons";
import { drawMinimap } from "./minimap";
import type { HudFrame, HudView } from "./view";

/** Tactical radar: minimap canvas, link state and map name. Hosts the `#buffs` mount below the map. */
export class RadarView implements HudView {
  private readonly link: HTMLElement;
  private readonly mapName: HTMLElement;
  private readonly canvas: HTMLCanvasElement;

  constructor(readonly root: HTMLElement) {
    root.innerHTML = `<div class="radar-title"><span>${icon("radar")} 战术雷达</span><span id="radar-state">在线</span></div><canvas id="minimap" width="260" height="260" aria-label="2D 战术地图，显示玩家、炸药和道具位置"></canvas><div class="radar-footer"><span id="radar-map">前哨基地</span><span><i></i> 你</span></div><div id="buffs" class="buffs"></div>`;
    this.link = query(root, "#radar-state");
    this.mapName = query(root, "#radar-map");
    this.canvas = query<HTMLCanvasElement>(root, "#minimap");
  }

  update({ snapshot, viewer, landing }: HudFrame) {
    setText(
      this.mapName,
      field(
        MAPS.find((m) => m.id === snapshot.mapId)!,
        "name",
      ),
    );
    drawMinimap(this.canvas, snapshot, viewer, landing);
  }

  dispose() {}
}
