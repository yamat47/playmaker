import type { CanvasPoint } from "./field.js";

/** Yields adjacent point pairs in order from the start. Yields nothing for fewer than 2 points. */
export function* segments<T>(points: readonly T[]): Generator<readonly [T, T]> {
  // Box the previous point so "no previous point" stays distinct even when T includes undefined.
  let previous: { readonly point: T } | undefined;
  for (const point of points) {
    if (previous !== undefined) {
      yield [previous.point, point];
    }
    previous = { point };
  }
}

/** Total length as the sum of distances between adjacent points. 0 for fewer than 2 points. */
export function polylineLength(path: readonly CanvasPoint[]): number {
  let total = 0;
  for (const [a, b] of segments(path)) {
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Returns a new polyline that ends at the point reached by walking back distance from the end
 * along the polyline. It does not walk back within the last segment only, because on a finely
 * sampled curve one segment is shorter than distance. maxFraction limits the trimmed length as
 * a fraction of the total length. The default of 1 sets no limit, and a distance at or beyond
 * the total length returns only the start point.
 */
export function trimPolylineEnd(
  path: readonly CanvasPoint[],
  distance: number,
  maxFraction = 1,
): CanvasPoint[] {
  if (path.length < 2 || distance <= 0) {
    return [...path];
  }
  let remaining =
    maxFraction >= 1 ? distance : Math.min(distance, polylineLength(path) * maxFraction);
  if (remaining <= 0) {
    return [...path];
  }

  // The arrowhead is much shorter than the total length and usually stops within a few segments
  // from the end, so walk back without copying the array.
  for (let i = path.length - 1; i > 0; i--) {
    const a = path[i - 1];
    const b = path[i];
    /* v8 ignore start -- i runs from 1 to path.length - 1, so both a and b are inside the range. */
    if (a === undefined || b === undefined) {
      break;
    }
    /* v8 ignore stop */
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    // Cutting on equality would add a point equal to a, leaving a zero-length segment at the end
    // (a round cap would draw a dot).
    if (segLen > remaining) {
      const t = (segLen - remaining) / segLen;
      return [...path.slice(0, i), { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }];
    }
    remaining -= segLen;
  }
  return path.slice(0, 1);
}
