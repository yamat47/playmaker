import { type ThemeReader, themeReaderFrom } from "./tokens.js";

/**
 * element で解決したテーマ変数を読む。canvas は var() を解釈できないので、描く前に具体的な色にする。
 * getComputedStyle はスタイルの再計算を起こしうるので、1 回の描画では 1 つの reader を使い回す。
 */
export function createThemeReader(element: Element): ThemeReader {
  const styles = getComputedStyle(element);
  return themeReaderFrom((property) => styles.getPropertyValue(property));
}
