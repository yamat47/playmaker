import { normalizeCssColor } from "./css-color.js";
import { THEME_TOKENS, type ThemeReader, themeReaderFrom } from "./tokens.js";

/**
 * Reads the theme variables as resolved on element. canvas cannot interpret var(), so the colors
 * are made concrete before drawing. Every variable is read at creation, so if the host changes one
 * later, the colors this reader returns stay the same. Colors come back in a normalized notation,
 * and a value that is not a color is treated as undeclared and falls back to the default color.
 */
export function createThemeReader(element: Element): ThemeReader {
  const styles = getComputedStyle(element);
  const values = new Map<string, string>();
  for (const { property } of Object.values(THEME_TOKENS)) {
    values.set(property, normalizeCssColor(styles.getPropertyValue(property).trim()) ?? "");
  }
  return themeReaderFrom((property) => values.get(property) ?? "");
}
