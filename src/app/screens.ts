/** Every screen the app can show. Exactly one is current. */
export type Screen =
  | "loading"
  | "lobby"
  | "graphics"
  | "credits"
  | "story"
  | "room"
  | "shop"
  | "playing"
  | "paused"
  | "help"
  | "replay"
  | "eliminated"
  | "result";

const ALL: readonly Screen[] = [
  "loading",
  "lobby",
  "graphics",
  "credits",
  "story",
  "room",
  "shop",
  "playing",
  "paused",
  "help",
  "replay",
  "eliminated",
  "result",
];

/**
 * Legal moves, keyed by destination. The brand link and the restart buttons are reachable from
 * every screen, so "lobby" and "room" accept any origin.
 */
const ENTERED_FROM: Record<Screen, readonly Screen[]> = {
  loading: ["room"],
  lobby: ALL,
  graphics: ["lobby"],
  credits: ["lobby"],
  story: ["lobby"],
  room: ALL,
  shop: ["loading"],
  playing: ["shop", "playing", "paused", "help", "eliminated"],
  paused: ["playing"],
  help: ALL.filter(
    (screen) =>
      screen !== "shop" &&
      screen !== "room" &&
      screen !== "credits" &&
      screen !== "story" &&
      screen !== "replay",
  ),
  // The killcam plays between the kill and the screen that reports it.
  replay: ["playing"],
  eliminated: ["playing", "replay"],
  result: ["playing", "replay"],
};

export class ScreenMachine {
  private screen: Screen = "loading";

  get current(): Screen {
    return this.screen;
  }

  is(...screens: Screen[]): boolean {
    return screens.includes(this.screen);
  }

  /** Moves to `next`. An undeclared move is a programming error, not a user error. */
  transition(next: Screen) {
    if (!ENTERED_FROM[next].includes(this.screen))
      throw new Error(`Illegal screen transition: ${this.screen} -> ${next}`);
    this.screen = next;
  }
}
