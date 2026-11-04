import type { FieldState, FieldZone } from "../model/play-data.js";
import type { FieldPosition } from "../model/player.js";

/**
 * Width between the sidelines. The rule says 160 feet (53⅓ yards), but it is rounded to 53 yards
 * so that the center (26.5) lands on a 0.5 yard grid point. The difference from the real
 * dimension is 1 foot, which does not show in the diagram.
 */
export const FIELD_WIDTH_YARDS = 53;

/**
 * Vertical length shown in the middle zone. The red zone windows are deeper than this so that
 * the yard numbers are not cut off at the edge. zoneWindowLength gives the length per window.
 */
export const ZONE_WINDOW_LENGTH_YARDS = 30;

/**
 * Distance (in yards) from the center of the field to the hash marks, per league.
 * The gap between the left and right hashes is 40 feet in the NCAA, 18.5 feet in the NFL, and
 * 53⅓ feet in the NFHS. The values are rounded to grid points (0.5 yard steps) so that players
 * can be placed on the hashes. There is no API for the consumer to pick a league; the diagram
 * is drawn with DEFAULT_FIELD_LEAGUE.
 */
export const HASH_CENTER_OFFSET_YARDS_BY_LEAGUE = {
  ncaa: 6.5,
  nfl: 3,
  nfhs: 9,
} as const;

export type FieldLeague = keyof typeof HASH_CENTER_OFFSET_YARDS_BY_LEAGUE;

/** Fields in Japan are usually lined with the NCAA hash spacing. */
export const DEFAULT_FIELD_LEAGUE: FieldLeague = "ncaa";

/**
 * Depth shown in the red zone windows, from the goal line back. It is wider than the actual red
 * zone (20 yards) so the 20 yard line does not sit on the window edge with its numbers cut off.
 */
export const RED_ZONE_DEPTH_YARDS = 25;

/** Yard line interval. browser draws the lines; shared so grid dots are not placed on them. */
export const YARD_LINE_INTERVAL_YARDS = 5;

/** End zone depth. Absolute yards run from -10 at the own end line to 110 at the opponent's. */
export const END_ZONE_DEPTH_YARDS = 10;

export interface YardWindow {
  /** Absolute yard of the near side of the window (screen bottom, behind the offense). */
  readonly startYard: number;
  /** Absolute yard of the far side of the window (screen top, ahead of the offense). */
  readonly endYard: number;
}

/**
 * Range of absolute yards shown for a zone. Absolute yards put the own goal line at 0 and the
 * opponent's goal line at 100, growing toward the offense direction (screen top). The red zone
 * windows show the end zone as well.
 */
export function fieldZoneWindow(zone: FieldZone): YardWindow {
  switch (zone) {
    case "own-redzone":
      return { startYard: -END_ZONE_DEPTH_YARDS, endYard: RED_ZONE_DEPTH_YARDS };
    case "redzone":
      return { startYard: 100 - RED_ZONE_DEPTH_YARDS, endYard: 100 + END_ZONE_DEPTH_YARDS };
    case "middle": {
      const half = ZONE_WINDOW_LENGTH_YARDS / 2;
      return { startYard: 50 - half, endYard: 50 + half };
    }
  }
}

export function zoneWindowLength(zone: FieldZone): number {
  const { startYard, endYard } = fieldZoneWindow(zone);
  return endYard - startYard;
}

/** Width to vertical length ratio of the zone window. Red zone windows are taller than middle. */
export function fieldWindowAspect(zone: FieldZone): number {
  return FIELD_WIDTH_YARDS / zoneWindowLength(zone);
}

/**
 * Clamps a position into the zone window (between the sidelines laterally, edge to edge
 * vertically). Keeps a drag released off screen or a click in the margin from placing a
 * player or point at an invisible position.
 */
export function clampToZoneWindow(position: FieldPosition, field: FieldState): FieldPosition {
  const { startYard, endYard } = fieldZoneWindow(field.zone);
  return {
    lateralYard: Math.min(Math.max(position.lateralYard, 0), FIELD_WIDTH_YARDS),
    downfieldYard: Math.min(
      Math.max(position.downfieldYard, startYard - field.losYard),
      endYard - field.losYard,
    ),
  };
}

/**
 * Number painted on the field (1..50) for an absolute yard. Counted from both goals (...40, 50,
 * 40...). Returns null for the goal lines and the end zones, where no number is painted.
 */
export function displayYardNumber(absoluteYard: number): number | null {
  if (absoluteYard <= 0 || absoluteYard >= 100) {
    return null;
  }
  return 50 - Math.abs(50 - absoluteYard);
}

/** Returns the absolute yards inside the zone window that are multiples of stepYards, ascending. */
export function yardLinesInWindow(zone: FieldZone, stepYards: number): number[] {
  if (stepYards <= 0) {
    throw new Error("Playmaker: stepYards must be a positive number.");
  }
  const { startYard, endYard } = fieldZoneWindow(zone);
  const lines: number[] = [];
  // A non-integer stepYards accumulates error over repeated additions, so a little slack
  // keeps the line at the far edge of the window from being dropped.
  const first = Math.ceil(startYard / stepYards) * stepYards;
  for (let y = first; y <= endYard + 1e-9; y += stepYards) {
    lines.push(y);
  }
  return lines;
}

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Fits the zone window into the center of the viewport, keeping its aspect ratio, and converts
 * between yards and Canvas px. Field lines and numbers use absolute yards; players and lines
 * use positions relative to the LOS (FieldPosition).
 */
export class FieldGeometry {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly zone: FieldZone;
  /** Absolute yard of the LOS. The downfieldYard of a FieldPosition is the distance from here. */
  readonly losYard: number;
  readonly yardWindow: YardWindow;
  /** Pixels per yard. The same value vertically and horizontally. */
  readonly scale: number;
  readonly fieldPixelWidth: number;
  readonly fieldPixelHeight: number;
  /** Canvas coordinates of the field's top left; the margin left by the aspect ratio mismatch. */
  readonly offsetX: number;
  readonly offsetY: number;

  constructor(viewportWidth: number, viewportHeight: number, field: FieldState) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.zone = field.zone;
    this.losYard = field.losYard;
    this.yardWindow = fieldZoneWindow(field.zone);
    const windowLength = this.yardWindow.endYard - this.yardWindow.startYard;
    const w = Math.max(0, viewportWidth);
    const h = Math.max(0, viewportHeight);
    this.scale = Math.min(w / FIELD_WIDTH_YARDS, h / windowLength);
    this.fieldPixelWidth = FIELD_WIDTH_YARDS * this.scale;
    this.fieldPixelHeight = windowLength * this.scale;
    this.offsetX = (w - this.fieldPixelWidth) / 2;
    this.offsetY = (h - this.fieldPixelHeight) / 2;
  }

  xForLateralYard(lateralYard: number): number {
    return this.offsetX + lateralYard * this.scale;
  }

  yForAbsoluteYard(absoluteYard: number): number {
    return this.offsetY + (this.yardWindow.endYard - absoluteYard) * this.scale;
  }

  toCanvas(position: FieldPosition): CanvasPoint {
    return {
      x: this.xForLateralYard(position.lateralYard),
      y: this.yForAbsoluteYard(this.losYard + position.downfieldYard),
    };
  }

  // With a size 0 viewport, scale is 0 and cannot divide; return the field's top left, not NaN.
  lateralYardForX(x: number): number {
    return this.scale > 0 ? (x - this.offsetX) / this.scale : 0;
  }

  absoluteYardForY(y: number): number {
    return this.scale > 0
      ? this.yardWindow.endYard - (y - this.offsetY) / this.scale
      : this.yardWindow.endYard;
  }

  fromCanvas(point: CanvasPoint): FieldPosition {
    return {
      lateralYard: this.lateralYardForX(point.x),
      downfieldYard: this.absoluteYardForY(point.y) - this.losYard,
    };
  }

  /** Inclusive of both edges. */
  containsYard(absoluteYard: number): boolean {
    return absoluteYard >= this.yardWindow.startYard && absoluteYard <= this.yardWindow.endYard;
  }
}
