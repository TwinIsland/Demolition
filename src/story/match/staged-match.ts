import { registerSkin } from "../../render/minecraft-skins";
import { STORY_SKINS } from "../assets";
import type { ScenePlayer, Stage, StoryMatchOptions } from "../stage";
import { createDirector, type Director } from "./director";

for (const [id, texture] of Object.entries(STORY_SKINS)) registerSkin(id, texture);

/**
 * Plays a scene on the real game: opens the match under the stage, then hands a director to
 * `script`, which is the scene. The world stands still during a conversation that holds the
 * scene, and under a dialog laid over the story.
 */
export function playStagedMatch(
  stage: Stage,
  options: StoryMatchOptions,
  script: (director: Director) => Promise<unknown>,
): ScenePlayer {
  let frozen = true,
    paused = false,
    locked = false,
    disposed = false,
    session: ReturnType<typeof createDirector> | undefined;
  const sync = () => {
    const match = session?.director.match;
    if (!match) return;
    match.paused = frozen || paused;
    match.control = !frozen && !paused && !locked;
  };
  stage.root.classList.add("veiled");
  void stage.host.match.open(options).then((match) => {
    if (disposed) return;
    session = createDirector(stage, match, (on) => {
      locked = on;
      sync();
    });
    match.onFrame = (state, dt) => session?.tick(state, dt);
    // Nothing has talked yet, so nothing will release the scene: it starts running here.
    frozen = false;
    sync();
    void script(session.director);
  });
  return {
    get frozen() {
      return frozen;
    },
    set frozen(value) {
      frozen = value;
      sync();
    },
    get paused() {
      return paused;
    },
    set paused(value) {
      paused = value;
      sync();
    },
    move: () => {},
    act: () => {},
    dispose() {
      disposed = true;
      session?.close();
      stage.host.match.close();
    },
  };
}
