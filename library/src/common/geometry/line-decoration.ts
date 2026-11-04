import type { CanvasPoint } from "./field.js";
import { trimPolylineEnd } from "./polyline.js";

// Trimming stops at this fraction of the total length so a line shorter than the arrowhead does not
// vanish (the arrowhead covers the rest).
const ARROW_TRIM_MAX_FRACTION = 0.9;

interface LineEnd {
  readonly tip: CanvasPoint;
  /** Unit vector pointing toward the end point. */
  readonly ux: number;
  readonly uy: number;
}

/**
 * The end point and the direction toward it. The tail of a curve can hold several points at the
 * end coordinates, so the direction comes from the nearest point whose coordinates differ from
 * the end. undefined when all points share the same coordinates.
 */
function lineEnd(path: readonly CanvasPoint[]): LineEnd | undefined {
  const tip = path.at(-1);
  if (tip === undefined) {
    return undefined;
  }
  // Called per line every frame, so search from the end side without copying the array.
  for (let i = path.length - 2; i >= 0; i--) {
    const from = path[i];
    if (from !== undefined && (from.x !== tip.x || from.y !== tip.y)) {
      const dx = tip.x - from.x;
      const dy = tip.y - from.y;
      const length = Math.hypot(dx, dy);
      return { tip, ux: dx / length, uy: dy / length };
    }
  }
  return undefined;
}

/** The line cut at the arrowhead base. One shorter than the arrowhead keeps 10% of its length. */
export function trimForArrowHead(path: readonly CanvasPoint[], arrowLength: number): CanvasPoint[] {
  return trimPolylineEnd(path, arrowLength, ARROW_TRIM_MAX_FRACTION);
}

/**
 * Vertices of the arrowhead triangle (tip, both base corners) with the end point as the tip,
 * pointed along the travel direction. undefined for a line whose direction cannot be determined.
 */
export function arrowHeadVertices(
  path: readonly CanvasPoint[],
  arrowLength: number,
  halfWidth: number,
): readonly [CanvasPoint, CanvasPoint, CanvasPoint] | undefined {
  const end = lineEnd(path);
  if (end === undefined) {
    return undefined;
  }
  const { tip, ux, uy } = end;
  const baseX = tip.x - arrowLength * ux;
  const baseY = tip.y - arrowLength * uy;
  return [
    tip,
    { x: baseX - halfWidth * uy, y: baseY + halfWidth * ux },
    { x: baseX + halfWidth * uy, y: baseY - halfWidth * ux },
  ];
}

/**
 * Both ends of the T bar centered on the end point and perpendicular to the travel direction.
 * undefined for a line whose direction cannot be determined.
 */
export function blockCapEndpoints(
  path: readonly CanvasPoint[],
  capLength: number,
): readonly [CanvasPoint, CanvasPoint] | undefined {
  const end = lineEnd(path);
  if (end === undefined) {
    return undefined;
  }
  const { tip, ux, uy } = end;
  const half = capLength / 2;
  return [
    { x: tip.x + half * uy, y: tip.y - half * ux },
    { x: tip.x - half * uy, y: tip.y + half * ux },
  ];
}
