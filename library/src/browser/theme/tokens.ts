// 線パレットの 4 色は、既定の線、選手の縁と塗り、パイロンの色から選ぶ。
const GOLD = "#c49a3c";
const CHALK = "#eef2ec";
const NAVY = "#2b4c72";
const ORANGE = "#d06a30";

interface ThemeToken {
  readonly property: `--playmaker-${string}`;
  readonly fallback: string;
}

/**
 * Canvas に描く色のテーマ変数と、ホストが宣言していないときの既定値。
 * ツールバーとパネルの色は CSS だけで決まるので、ここには置かない。
 */
export const THEME_TOKENS = {
  fieldGrass: { property: "--playmaker-field-grass", fallback: "#3f7a46" },
  fieldStripe: { property: "--playmaker-field-stripe", fallback: "#3a7341" },
  fieldOob: { property: "--playmaker-field-oob", fallback: "#284b2f" },
  fieldEndzone: { property: "--playmaker-field-endzone", fallback: "#20503c" },
  fieldLine: { property: "--playmaker-field-line", fallback: "rgba(236, 240, 234, 0.82)" },
  fieldNumber: { property: "--playmaker-field-number", fallback: "rgba(236, 240, 234, 0.72)" },
  fieldGoalLine: { property: "--playmaker-field-goal-line", fallback: "rgba(255, 255, 255, 0.92)" },
  fieldPylon: { property: "--playmaker-field-pylon", fallback: ORANGE },
  fieldGoalpost: { property: "--playmaker-field-goalpost", fallback: "#c2a64a" },
  playerFill: { property: "--playmaker-player-fill", fallback: NAVY },
  playerStroke: { property: "--playmaker-player-stroke", fallback: CHALK },
  playerLabel: { property: "--playmaker-player-label", fallback: "#ffffff" },
  lineRoute: { property: "--playmaker-line-route", fallback: GOLD },
  lineBlock: { property: "--playmaker-line-block", fallback: GOLD },
  lineMotion: { property: "--playmaker-line-motion", fallback: GOLD },
  lineSwatch1: { property: "--playmaker-line-swatch-1", fallback: GOLD },
  lineSwatch2: { property: "--playmaker-line-swatch-2", fallback: CHALK },
  lineSwatch3: { property: "--playmaker-line-swatch-3", fallback: NAVY },
  lineSwatch4: { property: "--playmaker-line-swatch-4", fallback: ORANGE },
  selection: { property: "--playmaker-selection", fallback: "#ff9800" },
  selectionOutline: {
    property: "--playmaker-selection-outline",
    fallback: "rgba(255, 255, 255, 0.9)",
  },
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
