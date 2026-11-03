import type { ThemeTokenName } from "./tokens.js";

export interface ColorOption {
  readonly label: string;
  readonly token: ThemeTokenName;
}

/**
 * 選手と線の色は自由に選ばせず、白い芝の上で見分けやすい 4 色に絞る。
 * 保存する color は、テーマ変数を解決した具体的な色にする。canvas は var() を解釈できないため。
 */
export const COLOR_PALETTE: readonly ColorOption[] = [
  { label: "黒", token: "swatch1" },
  { label: "赤", token: "swatch2" },
  { label: "青", token: "swatch3" },
  { label: "緑", token: "swatch4" },
];
