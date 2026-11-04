import { fieldWindowAspect } from "../geometry/field.js";
import { isFiniteNumber } from "../model/guards.js";
import type { FieldZone } from "../model/play-data.js";

/** PNG width (px) when unspecified. Big enough not to look coarse when pasted into a document. */
export const DEFAULT_EXPORT_WIDTH = 1600;

/**
 * The export width limit (px). Even the tall red zone window stays within about 11 million
 * pixels, so browsers that cap the canvas area at about 16.78 million pixels (Safari on iOS)
 * can still draw it.
 */
export const MAX_EXPORT_WIDTH = 4096;

export interface ImageExportOptions {
  /**
   * The PNG width (px). The height is derived from the aspect ratio of the zone's window.
   * Unspecified, non-finite, or below 1 becomes 1600; a width above 4096 is clamped to 4096.
   */
  width?: number | undefined;
}

export interface ImageExportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Turns an externally given width into integer px. Non-finite values and values below 1 become
 * the default width; a width above the limit is clamped to the limit.
 */
export function resolveImageExportWidth(width: number | undefined): number {
  if (!isFiniteNumber(width) || width < 1) {
    return DEFAULT_EXPORT_WIDTH;
  }
  return Math.min(Math.round(width), MAX_EXPORT_WIDTH);
}

/**
 * The height is derived from the aspect ratio of the zone's window, so the image has no margins.
 * The window's aspect ratio is under 2, so a width of at least 1 rounds to a height of at least 1.
 */
export function resolveImageExportSize(
  zone: FieldZone,
  options: ImageExportOptions = {},
): ImageExportSize {
  const width = resolveImageExportWidth(options.width);
  return { width, height: Math.round(width / fieldWindowAspect(zone)) };
}
