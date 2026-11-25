import type { GameSnapshot, Player } from "../core/types";
import type { BattleFireLayer } from "../ui/battle-effects";

/** What the HUD layers and ambience should show for one frame of a running match. */
export interface BattlePresentation {
  /** Whole seconds shown on the dimension-collapse banner; 0 hides it. */
  collapseSeconds: number;
  /** True while the collapse is still counting in. */
  collapsePending: boolean;
  /** Countdown for the collapse warning sound: seconds while pending, 0 once active, undefined when idle. */
  collapseWarning?: number;
  /** Whole seconds until the terrain reset, 0 once it has happened, undefined when none is scheduled. */
  resetSeconds?: number;
  resetId?: number;
  fireLayer: BattleFireLayer;
  /** The viewer's health from 0 to 1; 1 whenever the wounded veil should stay off. */
  healthFraction: number;
}

/** Derives the presentation from the snapshot. `inBattle` is false in menus and outside the playing phase. */
export function battlePresentation(
  state: Readonly<GameSnapshot>,
  viewer: Player,
  inBattle: boolean,
): BattlePresentation {
  const collapse = inBattle ? state.arenaView : undefined;
  const collapsePending = !!collapse && state.time < collapse.startsAt;
  const remaining = collapse ? (collapsePending ? collapse.startsAt : collapse.endsAt) - state.time : 0;
  // Rounded through float32 so a countdown that lands on a whole second does not show one extra.
  const collapseSeconds = Math.ceil(Math.fround(remaining));

  const reset = inBattle ? state.terrainReset : undefined;
  const resetSeconds = reset
    ? reset.completedAt === undefined
      ? Math.max(1, Math.ceil(reset.at - state.time))
      : 0
    : undefined;
  const fireLayer: BattleFireLayer = reset
    ? resetSeconds === 0
      ? "eruption"
      : "warning"
    : inBattle && viewer.alive && viewer.offers.length
      ? "offer"
      : "";

  return {
    collapseSeconds,
    collapsePending,
    collapseWarning: collapse ? (collapsePending ? collapseSeconds : 0) : undefined,
    resetSeconds,
    resetId: reset?.id,
    fireLayer,
    healthFraction: inBattle && viewer.alive ? viewer.hp / viewer.maxHp : 1,
  };
}
