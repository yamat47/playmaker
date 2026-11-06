// The Material Design palette. The reasoning behind the colors is in "Theme" in docs/design.md.
const WHITE = "#ffffff";
const BLACK = "#212121";
const RED = "#d32f2f";
const BLUE = "#1976d2";
const GREEN = "#388e3c";
const ORANGE = "#ff9800";
const GREY_100 = "#f5f5f5";
const GREY_200 = "#eeeeee";
const GREY_400 = "#bdbdbd";
const GREY_500 = "#9e9e9e";
const GREY_700 = "#616161";

interface ThemeToken {
  readonly property: `--playmaker-${string}`;
  readonly fallback: string;
}

/**
 * The theme variables for the colors drawn on the canvas, with defaults for when the host does not
 * declare them. The toolbar and panel colors are decided by CSS alone, so they are not listed here.
 */
export const THEME_TOKENS = {
  fieldGrass: { property: "--playmaker-field-grass", fallback: WHITE },
  fieldOob: { property: "--playmaker-field-oob", fallback: GREY_200 },
  fieldEndzone: { property: "--playmaker-field-endzone", fallback: GREY_100 },
  fieldLine: { property: "--playmaker-field-line", fallback: GREY_500 },
  fieldNumber: { property: "--playmaker-field-number", fallback: GREY_400 },
  fieldGoalLine: { property: "--playmaker-field-goal-line", fallback: GREY_700 },
  fieldPylon: { property: "--playmaker-field-pylon", fallback: GREY_500 },
  fieldGoalpost: { property: "--playmaker-field-goalpost", fallback: GREY_500 },
  fieldGrid: { property: "--playmaker-field-grid", fallback: "rgba(0, 0, 0, 0.1)" },
  /**
   * The color of a player that omits its color. It is the outline and label of an outline player,
   * and the fill of a solid player.
   */
  playerColor: { property: "--playmaker-player-color", fallback: BLACK },
  /** The label color of a solid player. The label of an outline player uses the player's color. */
  playerLabel: { property: "--playmaker-player-label", fallback: WHITE },
  lineRoute: { property: "--playmaker-line-route", fallback: BLACK },
  lineBlock: { property: "--playmaker-line-block", fallback: BLACK },
  lineMotion: { property: "--playmaker-line-motion", fallback: BLACK },
  /**
   * The three colors the panel offers for players and lines besides the default color. The
   * numbering starts at 2 because the first swatch is the theme's default color.
   */
  swatch2: { property: "--playmaker-swatch-2", fallback: RED },
  swatch3: { property: "--playmaker-swatch-3", fallback: BLUE },
  swatch4: { property: "--playmaker-swatch-4", fallback: GREEN },
  selection: { property: "--playmaker-selection", fallback: ORANGE },
  selectionOutline: { property: "--playmaker-selection-outline", fallback: WHITE },
} as const satisfies Record<string, ThemeToken>;

export type ThemeTokenName = keyof typeof THEME_TOKENS;

export type ThemeReader = (token: ThemeTokenName) => string;

/**
 * Builds a ThemeReader from a function that reads a variable's value. A token whose value is empty
 * or whitespace only draws with the default.
 */
export function themeReaderFrom(readProperty: (property: string) => string): ThemeReader {
  return (token) => {
    const { property, fallback } = THEME_TOKENS[token];
    const value = readProperty(property).trim();
    return value === "" ? fallback : value;
  };
}
