// Sizes are not fixed in px; they are ratios of the field width W and the px per yard U.
// The field's white lines, hashes, and numbers follow the ratios of the real dimensions.
// Players and play lines are drawn larger than real for legibility, as ratios of marker diameter D.

import { PLAYER_RADIUS_YARDS } from "../model/player.js";

// Keep at least 1 px so lines do not vanish when drawn small.
const MIN_LINE_PX = 1;
// The real line width of 4 inches divided by the field width of 160 feet.
const YARD_LINE_WIDTH_PER_W = 0.0021;
// The real hash length of 24 inches.
const HASH_TICK_LENGTH_PER_U = 0.375;
// Real numbers are 6 feet (2 yards) tall, but slightly larger keeps them readable when drawn small.
const NUMBER_HEIGHT_PER_U = 2.4;
const NUMBER_MIN_PX = 10;
// The midfield yard line is slightly thicker than the other yard lines to serve as a landmark.
const MIDFIELD_LINE_WIDTH_PER_YARD_LINE = 1.5;
// End zone corner pylons: 4 inches square for real, drawn a bit larger to stay visible when small.
const PYLON_SIZE_PER_U = 0.45;
const PYLON_MIN_PX = 3;
// Goalposts are drawn as seen from directly above: only the crossbar and the two uprights extending
// into the field. The crossbar half is half of the real 18.5 feet.
const GOALPOST_CROSSBAR_HALF_PER_U = 1.85;
const GOALPOST_UPRIGHT_LENGTH_PER_U = 1.2;
const GOALPOST_STROKE_PER_D = 0.2;
const GOALPOST_STROKE_MIN_PX = 2;

// Large enough for a two-character label to fit inside the marker.
const MARKER_LABEL_PER_D = 0.5;
const MARKER_LABEL_MIN_PX = 8;
const ROUTE_WIDTH_PER_D = 0.11;
const ROUTE_WIDTH_MIN_PX = 1.5;
const BLOCK_CAP_LENGTH_PER_D = 0.4;
// The arrowhead base is about 4 times the line width, so it reads as an arrow rather than a barb
// at the end of the line. The tip angle is about 37 degrees.
const ARROW_LENGTH_PER_D = 0.72;
const ARROW_HALF_WIDTH_PER_D = 0.24;
const MOTION_DASH_ON_PER_U = 1.1;
const MOTION_DASH_OFF_PER_U = 0.7;
// The grid dots laid out while editing. They only need to be a guide, so they are thinner than the
// hashes, with a minimum size that keeps them from vanishing.
const GRID_DOT_RADIUS_PER_U = 0.08;
const GRID_DOT_RADIUS_MIN_PX = 0.75;

/** Dimensions used for drawing (px). */
export interface FieldMetrics {
  readonly yardLineWidth: number;
  /** Width of the goal lines and of the window's outer frame, including the sidelines. */
  readonly goalLineWidth: number;
  /** Width of the midfield (50 yard) yard line. */
  readonly midfieldLineWidth: number;
  readonly hashTickLength: number;
  readonly numberHeight: number;
  /** Side length of the pylons placed at the end zone corners. */
  readonly pylonSize: number;
  readonly goalpostCrossbarHalfLength: number;
  readonly goalpostUprightLength: number;
  readonly goalpostStroke: number;
  /** Player marker diameter D. Player and play line dimensions are ratios of this value. */
  readonly tokenDiameter: number;
  readonly markerStroke: number;
  readonly markerLabelFont: number;
  readonly routeWidth: number;
  readonly blockWidth: number;
  readonly blockCapLength: number;
  readonly arrowLength: number;
  readonly arrowHalfWidth: number;
  /** The motion dash pattern as [drawn length, gap length]. */
  readonly motionDash: readonly [number, number];
  /** Radius of the grid dots laid out while editing. */
  readonly gridDotRadius: number;
}

/** Does not return NaN even for a viewport of size 0. */
export function computeFieldMetrics(fieldPixelWidth: number, unitPx: number): FieldMetrics {
  const w = Math.max(0, fieldPixelWidth);
  const u = Math.max(0, unitPx);
  const yardLineWidth = Math.max(MIN_LINE_PX, YARD_LINE_WIDTH_PER_W * w);
  const d = 2 * PLAYER_RADIUS_YARDS * u;
  const routeWidth = Math.max(ROUTE_WIDTH_MIN_PX, ROUTE_WIDTH_PER_D * d);
  return {
    yardLineWidth,
    goalLineWidth: 2 * yardLineWidth,
    midfieldLineWidth: MIDFIELD_LINE_WIDTH_PER_YARD_LINE * yardLineWidth,
    hashTickLength: HASH_TICK_LENGTH_PER_U * u,
    numberHeight: Math.max(NUMBER_MIN_PX, NUMBER_HEIGHT_PER_U * u),
    pylonSize: Math.max(PYLON_MIN_PX, PYLON_SIZE_PER_U * u),
    goalpostCrossbarHalfLength: GOALPOST_CROSSBAR_HALF_PER_U * u,
    goalpostUprightLength: GOALPOST_UPRIGHT_LENGTH_PER_U * u,
    goalpostStroke: Math.max(GOALPOST_STROKE_MIN_PX, GOALPOST_STROKE_PER_D * d),
    tokenDiameter: d,
    // For an outline-only player the outline is the whole look, so it uses the play line width.
    markerStroke: routeWidth,
    markerLabelFont: Math.max(MARKER_LABEL_MIN_PX, MARKER_LABEL_PER_D * d),
    routeWidth,
    blockWidth: routeWidth,
    blockCapLength: BLOCK_CAP_LENGTH_PER_D * d,
    arrowLength: ARROW_LENGTH_PER_D * d,
    arrowHalfWidth: ARROW_HALF_WIDTH_PER_D * d,
    motionDash: [MOTION_DASH_ON_PER_U * u, MOTION_DASH_OFF_PER_U * u],
    gridDotRadius: Math.max(GRID_DOT_RADIUS_MIN_PX, GRID_DOT_RADIUS_PER_U * u),
  };
}
