import type { ThemeTokenName } from "./tokens.js";

export interface LineColorOption {
  readonly label: string;
  readonly token: ThemeTokenName;
}

/**
 * 線の色は自由に選ばせず、芝の上で見分けやすい 4 色に絞る。
 * 保存する Line.color は、テーマ変数を解決した具体的な色にする。canvas は var() を解釈できないため。
 */
export const LINE_COLOR_PALETTE: readonly LineColorOption[] = [
  { label: "金", token: "lineSwatch1" },
  { label: "白", token: "lineSwatch2" },
  { label: "紺", token: "lineSwatch3" },
  { label: "橙", token: "lineSwatch4" },
];
