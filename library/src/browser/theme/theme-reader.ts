import { THEME_TOKENS, type ThemeReader } from "./tokens.js";

/**
 * element で解決したテーマ変数を読む。canvas は var() を解釈できないので、描く前に具体的な色にする。
 * getComputedStyle はスタイルの再計算を起こしうるので、1 回の描画では 1 つの reader を使い回す。
 */
export function createThemeReader(element: Element): ThemeReader {
  const styles = getComputedStyle(element);
  return (token) => {
    const { property, fallback } = THEME_TOKENS[token];
    const value = styles.getPropertyValue(property).trim();
    return value === "" ? fallback : value;
  };
}
