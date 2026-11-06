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

function isSamePoint(a: FieldPosition, b: FieldPosition): boolean {
  return a.lateralYard === b.lateralYard && a.downfieldYard === b.downfieldYard;
}

/** Consecutive equal points give a zero direction and break the curve, so they fold into one. */
function dedupeConsecutive(points: readonly FieldPosition[]): FieldPosition[] {
  const out: FieldPosition[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last === undefined || !isSamePoint(last, p)) {
      out.push({ lateralYard: p.lateralYard, downfieldYard: p.downfieldYard });
    }
  }
  return out;
}

/** One cubic bezier of a curve: from p1 to p2, bent by c1 and c2. */
type CurvePiece = readonly [
  p1: FieldPosition,
  c1: FieldPosition,
  c2: FieldPosition,
  p2: FieldPosition,
];

/**
 * The pieces of the curve drawn through points, one per segment, or none when the points are
 * joined as they are: with `straight`, or with 2 or fewer points. points must have no consecutive
 * equal points.
 */
function curvePieces(
  points: readonly FieldPosition[],
  interpolation: LineInterpolation,
): CurvePiece[] {
  if (interpolation === "straight" || points.length < 3) {
    return [];
  }
  return [...segments(points)].map(([p1, p2], i) => {
    const [c1, c2] = catmullRomBezierControls(points[i - 1] ?? p1, p1, p2, points[i + 2] ?? p2);
    return [p1, c1, c2, p2];
  });
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
  const pieces = curvePieces(pts, interpolation);
  if (pieces.length === 0) {
    return pts;
  }
  const steps = Math.max(1, Math.floor(samplesPerSegment));
  const result: FieldPosition[] = pts.slice(0, 1);
  for (const [p1, c1, c2, p2] of pieces) {
    // The point at t=0 equals the previous piece's end point, so t is stepped to 1 excluding 0.
    for (let s = 1; s <= steps; s++) {
      result.push(cubicBezierPoint(p1, c1, c2, p2, s / steps));
    }
  }
  return result;
}

/**
 * The point halfway along each segment of the drawn path, one per pair of adjacent control points,
 * in order. A waypoint inserted at index i goes between control points i and i + 1, so the i-th
 * midpoint is where it starts. On a curve the point is taken at the middle of the segment's bezier,
 * so it sits on the drawn curve rather than on the chord. A segment between two equal points is
 * folded away in the drawn path, so its midpoint is that point.
 */
export function segmentMidpoints(
  points: readonly FieldPosition[],
  interpolation: LineInterpolation,
): FieldPosition[] {
  const pieces = curvePieces(dedupeConsecutive(points), interpolation);
  // Each segment that is not folded away is the next piece of the drawn curve.
  let next = 0;
  return [...segments(points)].map(([p1, p2]) => {
    if (isSamePoint(p1, p2)) {
      return { lateralYard: p1.lateralYard, downfieldYard: p1.downfieldYard };
    }
    const piece = pieces[next];
    next++;
    return piece === undefined
      ? {
          lateralYard: (p1.lateralYard + p2.lateralYard) / 2,
          downfieldYard: (p1.downfieldYard + p2.downfieldYard) / 2,
        }
      : cubicBezierPoint(...piece, 0.5);
  });
}
