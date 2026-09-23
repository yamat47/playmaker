import { normalizeCssColor } from "./css-color.js";
import { THEME_TOKENS, type ThemeReader, themeReaderFrom } from "./tokens.js";

/**
 * element で解決したテーマ変数を読む。canvas は var() を解釈できないので、描く前に具体的な色にする。
 * 変数は作った時点ですべて読むので、あとでホストが変数を変えても、この reader が返す色は変わらない。
 * 色は書き方をそろえて返し、色として読めない値は、宣言されていないものとして既定の色にする。
 */
export function createThemeReader(element: Element): ThemeReader {
  const styles = getComputedStyle(element);
  const values = new Map<string, string>();
  for (const { property } of Object.values(THEME_TOKENS)) {
    values.set(property, normalizeCssColor(styles.getPropertyValue(property).trim()) ?? "");
  }
  return themeReaderFrom((property) => values.get(property) ?? "");
}
