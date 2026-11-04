// The source font is Saira Condensed Bold (SIL OFL 1.1, library/assets/fonts/OFL.txt).
// Rebuild it with make font.
import fontUrl from "../../assets/playmaker-saira-subset.woff2";
import { FIELD_FONT_NAME, FIELD_FONT_WEIGHT } from "./field-font.js";

let loaded: Promise<void> | undefined;

/**
 * Registers the bundled font in document.fonts and resolves once it has loaded. However many times
 * it is called, the font is registered only once. Declared through CSS @font-face, the font would
 * stay invisible until the host loads the CSS, and numbers and labels drawn in the meantime would
 * use the fallback font. A load failure still draws with the fallback font, so it never rejects.
 */
export function loadFieldFont(): Promise<void> {
  loaded ??= registerFieldFont();
  return loaded;
}

async function registerFieldFont(): Promise<void> {
  try {
    const face = new FontFace(FIELD_FONT_NAME, `url("${fontUrl}")`, {
      weight: String(FIELD_FONT_WEIGHT),
    });
    document.fonts.add(face);
    await face.load();
  } catch {
    // Keep drawing with the fallback font.
  }
}
