import type { LineInterpolation } from "../model/line.js";
import type { FieldPosition } from "../model/player.js";
import { segments } from "./polyline.js";

/** Number of subdivisions per bezier segment. At play diagram sizes, no corners show with this. */
export const DEFAULT_BEZIER_SAMPLES_PER_SEGMENT = 16;

/** Point at t (0 to 1) on the cubic bezier from p0 to p1, bent by the control points c1 and c2. */
export function cubicBezierPoint(
  p0: FieldPosition,
  c1: FieldPosition,
  c2: FieldPosition,
  p1: FieldPosition,
  t: number,
): FieldPosition {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    lateralYard: a * p0.lateralYard + b * c1.lateralYard + c * c2.lateralYard + d * p1.lateralYard,
    downfieldYard:
      a * p0.downfieldYard + b * c1.downfieldYard + c * c2.downfieldYard + d * p1.downfieldYard,
  };
}

/**
 * Control points [c1, c2] of the cubic bezier through the segment p1 to p2, with directions set
 * by the neighbors p0 and p3. The shape matches a uniform Catmull-Rom curve. At an end segment,
 * pass the end point itself for the missing neighbor. Waypoints are not used directly as bezier
 * control points because the curve would then no longer pass through them.
 */
export function catmullRomBezierControls(
  p0: FieldPosition,
  p1: FieldPosition,
  p2: FieldPosition,
  p3: FieldPosition,
): [FieldPosition, FieldPosition] {
  return [
    {
      lateralYard: p1.lateralYard + (p2.lateralYard - p0.lateralYard) / 6,
      downfieldYard: p1.downfieldYard + (p2.downfieldYard - p0.downfieldYard) / 6,
    },
    {
      lateralYard: p2.lateralYard - (p3.lateralYard - p1.lateralYard) / 6,
      downfieldYard: p2.downfieldYard - (p3.downfieldYard - p1.downfieldYard) / 6,
    },
  ];
}

/** Consecutive equal points give a zero direction and break the curve, so they fold into one. */
function dedupeConsecutive(points: readonly FieldPosition[]): FieldPosition[] {
  const out: FieldPosition[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (
      last === undefined ||
      last.lateralYard !== p.lateralYard ||
      last.downfieldYard !== p.downfieldYard
    ) {
      out.push({ lateralYard: p.lateralYard, downfieldYard: p.downfieldYard });
    }
  }
  return out;
}

/**
 * Turns a sequence of control points into the polyline used for drawing and hit testing. With
 * `straight`, or when folding equal points leaves 2 or fewer, the control points are joined as
 * they are. Returns a new array. samplesPerSegment is rounded to at least 1.
 */
export function sampleLinePath(
  points: readonly FieldPosition[],
  interpolation: LineInterpolation,
  samplesPerSegment: number = DEFAULT_BEZIER_SAMPLES_PER_SEGMENT,
): FieldPosition[] {
  const pts = dedupeConsecutive(points);
  if (interpolation === "straight" || pts.length < 3) {
    return pts;
  }
  const steps = Math.max(1, Math.floor(samplesPerSegment));

  const result: FieldPosition[] = pts.slice(0, 1);
  for (const [i, [p1, p2]] of [...segments(pts)].entries()) {
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const [c1, c2] = catmullRomBezierControls(p0, p1, p2, p3);
    // The point at t=0 equals the previous segment's end point, so t is stepped to 1 excluding 0.
    for (let s = 1; s <= steps; s++) {
      result.push(cubicBezierPoint(p1, c1, c2, p2, s / steps));
    }
  }
  return result;
}
