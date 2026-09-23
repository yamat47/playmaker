/** `#rrggbb` の 6 桁の hex か。色の入力（input type="color"）は、この書式の値しか受け付けない。 */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
