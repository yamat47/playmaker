// Yard numbers and player labels are fixed to the bundled font, and the theme cannot replace it.
// ctx.font cannot interpret CSS var(), so the value is built from these constants, not a variable.
// The name is specific to the library so it does not collide with the fonts of the host page.
export const FIELD_FONT_NAME = "Playmaker Saira";
export const FIELD_FONT_WEIGHT = 700;
export const FIELD_FONT_FAMILY = `"${FIELD_FONT_NAME}", sans-serif`;

/** The ctx.font value that draws with the bundled font at sizePx. */
export function fieldFont(sizePx: number): string {
  return `${FIELD_FONT_WEIGHT} ${sizePx}px ${FIELD_FONT_FAMILY}`;
}
