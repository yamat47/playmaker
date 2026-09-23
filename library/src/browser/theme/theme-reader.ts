import { THEME_TOKENS, type ThemeReader, themeReaderFrom } from "./tokens.js";

/**
 * element で解決したテーマ変数を読む。canvas は var() を解釈できないので、描く前に具体的な色にする。
 * 変数は作った時点ですべて読むので、あとでホストが変数を変えても、この reader が返す色は変わらない。
 */
export function createThemeReader(element: Element): ThemeReader {
  const styles = getComputedStyle(element);
  const values = new Map<string, string>();
  for (const { property } of Object.values(THEME_TOKENS)) {
    values.set(property, styles.getPropertyValue(property));
  }
  return themeReaderFrom((property) => values.get(property) ?? "");
}
