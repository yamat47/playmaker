import { indexPlayersById, type Line, lineAnchorPoints } from "../model/line.js";
import type { FieldPosition, Player } from "../model/player.js";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { sampleLinePath } from "./bezier.js";
import { segments } from "./polyline.js";

/**
 * Returns the topmost drawn player overlapping target. Later elements are drawn on top, so the
 * search runs from the end. Square players are also hit by their circumscribed circle; the
 * difference is too small to justify a per-shape hit test.
 */
export function hitTestPlayer(
  players: readonly Player[],
  target: FieldPosition,
  radiusYards: number = PLAYER_RADIUS_YARDS,
): Player | undefined {
  if (radiusYards <= 0) {
    throw new Error("Playmaker: radiusYards must be a positive number.");
  }
  const r2 = radiusYards * radiusYards;
  for (const player of [...players].reverse()) {
    const dx = player.position.lateralYard - target.lateralYard;
    const dy = player.position.downfieldYard - target.downfieldYard;
    if (dx * dx + dy * dy <= r2) {
      return player;
    }
  }
  return undefined;
}

/**
 * Distance (in yards) within which a line counts as hit. The line width is too thin to grab, so
 * this is kept separate from it. It is smaller than the player radius, which makes lines harder
 * to grab when pressing near a player.
 */
export const LINE_HIT_TOLERANCE_YARDS = 0.6;

export function distanceToSegment(p: FieldPosition, a: FieldPosition, b: FieldPosition): number {
  const abx = b.lateralYard - a.lateralYard;
  const aby = b.downfieldYard - a.downfieldYard;
  const apx = p.lateralYard - a.lateralYard;
  const apy = p.downfieldYard - a.downfieldYard;
  const lenSq = abx * abx + aby * aby;
  // If a and b are the same point, use the distance to a.
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const dx = apx - t * abx;
  const dy = apy - t * aby;
  return Math.sqrt(dx * dx + dy * dy);
}

/** +Infinity when there are no points. */
function distanceToPolyline(p: FieldPosition, points: readonly FieldPosition[]): number {
  const only = points.length === 1 ? points[0] : undefined;
  if (only !== undefined) {
    return pointDistance(p, only);
  }
  let min = Number.POSITIVE_INFINITY;
  for (const [a, b] of segments(points)) {
    min = Math.min(min, distanceToSegment(p, a, b));
  }
  return min;
}

/**
 * Returns the topmost drawn line overlapping target. The distance is measured to the same
 * polyline used for drawing, so curves are hit exactly as they appear. A line without its start
 * player is not drawn, so it is not hit either.
 */
export function hitTestLine(
  lines: readonly Line[],
  players: readonly Player[],
  target: FieldPosition,
  toleranceYards: number = LINE_HIT_TOLERANCE_YARDS,
): Line | undefined {
  if (toleranceYards <= 0) {
    throw new Error("Playmaker: toleranceYards must be a positive number.");
  }
  const byId = indexPlayersById(players);
  for (const line of [...lines].reverse()) {
    const anchors = lineAnchorPoints(line, byId);
    if (anchors === undefined) {
      continue;
    }
    const polyline = sampleLinePath(anchors, line.interpolation);
    if (distanceToPolyline(target, polyline) <= toleranceYards) {
      return line;
    }
  }
  return undefined;
}

/** Radius (in yards) for grabbing the waypoint and end point handles of the selected line. */
export const WAYPOINT_HANDLE_RADIUS_YARDS = 0.9;

export function pointDistance(a: FieldPosition, b: FieldPosition): number {
  return Math.hypot(a.lateralYard - b.lateralYard, a.downfieldYard - b.downfieldYard);
}

/** The handles shown on the selected line. */
export interface LineHandles {
  readonly waypointHandles: readonly FieldPosition[];
  readonly endpointHandle: FieldPosition;
  /**
   * Halfway along each segment; dragging one inserts a waypoint there, which bends the line.
   * Empty at the waypoint limit.
   */
  readonly insertHandles: readonly FieldPosition[];
}

/** The grabbed handle and its position when a line handle is hit. */
export type LineHandleHit =
  | { readonly kind: "endpoint"; readonly point: FieldPosition }
  | { readonly kind: "waypoint"; readonly index: number; readonly point: FieldPosition }
  | { readonly kind: "insert"; readonly index: number; readonly point: FieldPosition };

/**
 * Returns the line handle hit by target. The end point is tested before the waypoints so that
 * an attempt to move the tip is not stolen by the last waypoint. Later waypoints are drawn in
 * front, so the search runs from the end. Insert handles come last: on a short segment they sit
 * close to the points that bound it, and moving an existing point is the likelier intent.
 */
export function hitLineHandle(
  handles: LineHandles,
  target: FieldPosition,
): LineHandleHit | undefined {
  const within = (point: FieldPosition) =>
    pointDistance(target, point) <= WAYPOINT_HANDLE_RADIUS_YARDS;
  if (within(handles.endpointHandle)) {
    return { kind: "endpoint", point: handles.endpointHandle };
  }
  for (const [index, point] of [...handles.waypointHandles.entries()].reverse()) {
    if (within(point)) {
      return { kind: "waypoint", index, point };
    }
  }
  for (const [index, point] of handles.insertHandles.entries()) {
    if (within(point)) {
      return { kind: "insert", index, point };
    }
  }
  return undefined;
}
