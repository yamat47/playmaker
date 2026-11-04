import type { ThemeTokenName } from "./tokens.js";

/**
 * Players and lines do not get a free color choice; the choice is limited to 4 colors that are
 * easy to tell apart on white grass. The saved color is the concrete color resolved from the
 * theme variable, because the canvas cannot interpret var(). The names shown for the swatches
 * come from the messages of the chosen locale.
 */
export const SWATCH_TOKENS = [
  "swatch1",
  "swatch2",
  "swatch3",
  "swatch4",
] as const satisfies readonly ThemeTokenName[];

export type SwatchToken = (typeof SWATCH_TOKENS)[number];
