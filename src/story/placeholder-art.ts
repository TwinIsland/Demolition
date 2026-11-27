import { CELL } from "./script";

/**
 * Stand-in pixel art, drawn in code so the story runs before its painted assets exist. A room
 * with a `background` painting skips the tiles; the character sheet is replaced by frames
 * rendered from Zero's skin.
 */

type Rect = readonly [color: string, x: number, y: number, w: number, h: number];

function paint(width: number, height: number, draw: (put: (...rect: Rect) => void) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  draw((color, x, y, w, h) => {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  });
  return canvas;
}

const INK = "#0b0a14",
  WALL = "#2a2440",
  WALL_DARK = "#1d1930",
  FLOOR = "#3a2f4a",
  FLOOR_LINE = "#2f263d",
  WOOD = "#5a4152",
  WOOD_LIGHT = "#74566a",
  CLOTH = "#3d3a6b",
  CLOTH_LIGHT = "#55518f",
  PALE = "#d9d4e8",
  WARM = "#e8b45a",
  RED = "#b8475c";

const wall = (put: (...rect: Rect) => void) => {
  put(WALL, 0, 0, CELL, CELL);
  put(WALL_DARK, 0, 13, CELL, 3);
};

/** One 16 x 16 tile per layout symbol. "." is the floor that lies under everything. */
const TILES: Record<string, (put: (...rect: Rect) => void) => void> = {
  ".": (put) => {
    put(FLOOR, 0, 0, CELL, CELL);
    put(FLOOR_LINE, 0, 7, CELL, 1);
    put(FLOOR_LINE, 0, 15, CELL, 1);
    put(FLOOR_LINE, 5, 0, 1, 7);
    put(FLOOR_LINE, 12, 8, 1, 7);
  },
  "#": wall,
  W: (put) => {
    wall(put);
    put(CLOTH, 0, 2, CELL, 11);
    for (let x = 1; x < CELL; x += 4) put(CLOTH_LIGHT, x, 2, 1, 11);
    put(WARM, 15, 3, 1, 9);
  },
  P: (put) => {
    wall(put);
    put(PALE, 3, 2, 10, 10);
    put(RED, 4, 3, 8, 4);
    put(INK, 6, 8, 4, 3);
  },
  M: (put) => {
    wall(put);
    put(WOOD_LIGHT, 3, 1, 10, 13);
    put("#8fa3c4", 4, 2, 8, 11);
    put(PALE, 5, 3, 1, 5);
  },
  B: (put) => {
    put(CLOTH, 0, 0, CELL, CELL);
    put(CLOTH_LIGHT, 0, 0, CELL, 2);
    put(CLOTH_LIGHT, 3, 6, 9, 1);
  },
  b: (put) => {
    put(WOOD, 0, 0, CELL, 5);
    put(INK, 0, 5, CELL, 7);
    put(FLOOR, 0, 12, CELL, 4);
    put(WOOD, 1, 5, 2, 7);
  },
  D: (put) => {
    put(WOOD, 0, 0, CELL, CELL);
    put(WOOD_LIGHT, 0, 0, CELL, 3);
    put(INK, 0, 14, CELL, 2);
  },
  N: (put) => {
    TILES.D(put);
    for (const x of [2, 7, 11]) {
      put(PALE, x, 5, 4, 5);
      put(RED, x, 6, 4, 1);
    }
  },
  R: (put) => {
    put(WOOD, 1, 3, 14, 12);
    put(WOOD_LIGHT, 1, 3, 14, 2);
    put(PALE, 5, 6, 6, 5);
    put("#a9a3bf", 7, 8, 2, 1);
  },
  "=": (put) => {
    wall(put);
    put(WOOD, 0, 0, CELL, 14);
    put(WOOD_LIGHT, 2, 2, 12, 10);
    put(WARM, 0, 14, CELL, 2);
  },
};

export const tileArt = (symbol: string) => paint(CELL, CELL, TILES[symbol] ?? TILES["#"]);

/** Facing rows of the character sheet, top to bottom; each row holds two walk frames. */
export const FACINGS = ["down", "up", "left", "right"] as const;
export type Facing = (typeof FACINGS)[number];

/** Zero: black hoodie, a fringe over one eye, bandages on the right arm. */
export function zeroSheet() {
  return paint(CELL * 2, CELL * FACINGS.length, (put) => {
    FACINGS.forEach((facing, row) => {
      for (let frame = 0; frame < 2; frame++) {
        const x = frame * CELL,
          y = row * CELL,
          step = frame ? 1 : 0;
        // Hair and head.
        put(INK, x + 4, y + 1, 8, 7);
        if (facing !== "up") {
          const face = facing === "left" ? 4 : facing === "right" ? 7 : 5;
          put(PALE, x + face, y + 4, facing === "down" ? 6 : 5, 4);
          put(INK, x + face, y + 4, 3, 2);
          put(RED, x + (facing === "left" ? 5 : face + 4), y + 5, 1, 1);
        }
        // Hoodie, then the arms: the right one is bandaged.
        put("#17151f", x + 4, y + 8, 8, 5);
        const rightArm = facing === "up" || facing === "right" ? 11 : 4;
        if (facing !== "left") put(PALE, x + rightArm, y + 9, 1, 3 + step);
        // Legs swap with the walk frame.
        put(INK, x + 5, y + 13, 2, 3 - step);
        put(INK, x + 9, y + 13, 2, 2 + step);
      }
    });
  });
}

/** Head-and-shoulders portrait for the dialogue box. */
export function zeroPortrait() {
  return paint(24, 24, (put) => {
    put("#17151f", 0, 0, 24, 24);
    put(PALE, 6, 6, 12, 12);
    put(INK, 4, 2, 16, 7);
    put(INK, 4, 9, 8, 5);
    put(INK, 14, 11, 2, 2);
    put(RED, 15, 11, 1, 1);
    put("#a9a3bf", 10, 16, 5, 1);
    put("#17151f", 2, 19, 20, 5);
    put(INK, 10, 19, 4, 5);
  });
}
