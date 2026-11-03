// Material Design のパレット。配色の考え方は docs/design.md の「テーマ」にある。
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
 * Canvas に描く色のテーマ変数と、ホストが宣言していないときの既定値。
 * ツールバーとパネルの色は CSS だけで決まるので、ここには置かない。
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
  playerFill: { property: "--playmaker-player-fill", fallback: BLACK },
  playerStroke: { property: "--playmaker-player-stroke", fallback: WHITE },
  playerLabel: { property: "--playmaker-player-label", fallback: WHITE },
  lineRoute: { property: "--playmaker-line-route", fallback: BLACK },
  lineBlock: { property: "--playmaker-line-block", fallback: BLACK },
  lineMotion: { property: "--playmaker-line-motion", fallback: BLACK },
  lineSwatch1: { property: "--playmaker-line-swatch-1", fallback: BLACK },
  lineSwatch2: { property: "--playmaker-line-swatch-2", fallback: RED },
  lineSwatch3: { property: "--playmaker-line-swatch-3", fallback: BLUE },
  lineSwatch4: { property: "--playmaker-line-swatch-4", fallback: GREEN },
  selection: { property: "--playmaker-selection", fallback: ORANGE },
  selectionOutline: { property: "--playmaker-selection-outline", fallback: WHITE },
} as const satisfies Record<string, ThemeToken>;

export type ThemeTokenName = keyof typeof THEME_TOKENS;

export type ThemeReader = (token: ThemeTokenName) => string;

/** 変数の値を読む関数から ThemeReader を作る。値が空か空白だけのトークンは、既定値で描く。 */
export function themeReaderFrom(readProperty: (property: string) => string): ThemeReader {
  return (token) => {
    const { property, fallback } = THEME_TOKENS[token];
    const value = readProperty(property).trim();
    return value === "" ? fallback : value;
  };
}
