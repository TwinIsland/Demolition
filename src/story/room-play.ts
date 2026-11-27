import { openRoom } from "./room";
import type { Hotspot, RoomScene } from "./script";
import type { ScenePlayer, Stage } from "./stage";

/** Plays a walkable room: its opening panel, its intro, free examination, and the way out. */
export function playRoom(stage: Stage, scene: RoomScene): ScenePlayer {
  /** How many times each cycling hotspot has been examined. */
  const visits = new Map<string, number>();
  const current = (hotspot: Hotspot) =>
    hotspot.cycle ? hotspot.cycle[(visits.get(hotspot.id) ?? 0) % hotspot.cycle.length] : hotspot;
  const showPrompt = () => stage.prompt(room.facing && !room.frozen ? current(room.facing).label : undefined);
  const room = openRoom(stage.canvas, scene, showPrompt);
  let over = false;

  const examine = async (hotspot: Hotspot) => {
    const { lines } = current(hotspot);
    visits.set(hotspot.id, (visits.get(hotspot.id) ?? 0) + 1);
    if (!(await stage.talk(lines))) return;
    if (!hotspot.ends) return showPrompt();
    over = true;
    stage.goal();
    stage.root.classList.add("booting");
    if (await stage.talk(scene.outro)) stage.end(scene.checkpoint);
  };
  const begin = async () => {
    if (scene.opening) {
      stage.art(scene.opening.art);
      if (!(await stage.talk(scene.opening.lines))) return;
      stage.art();
    }
    if (!(await stage.talk(scene.intro))) return;
    stage.goal(scene.goal);
    showPrompt();
  };
  void begin();

  return {
    get frozen() {
      return room.frozen;
    },
    set frozen(value) {
      room.frozen = value || over;
    },
    move: (x, y) => room.move(x, y),
    act: () => {
      if (room.facing && !room.frozen) void examine(room.facing);
    },
    dispose: () => room.dispose(),
  };
}
