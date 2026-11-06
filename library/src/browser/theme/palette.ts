import type { LineKind } from "../../common/index.js";
import type { ThemeTokenName } from "./tokens.js";

/**
 * Players and lines do not get a free color choice; besides the theme's default color, the
 * choice is limited to 3 colors that are easy to tell apart on white grass. The saved color is
 * the concrete color resolved from the theme variable, because the canvas cannot interpret var().
 * The names shown for the swatches come from the messages of the chosen locale.
 */
export const SWATCH_TOKENS = [
  "swatch2",
  "swatch3",
  "swatch4",
] as const satisfies readonly ThemeTokenName[];

/** The theme color of a line that has no color of its own, per kind. */
export const LINE_COLOR_TOKENS = {
  route: "lineRoute",
  block: "lineBlock",
  motion: "lineMotion",
} as const satisfies Record<LineKind, ThemeTokenName>;

export type SwatchToken = (typeof SWATCH_TOKENS)[number];
