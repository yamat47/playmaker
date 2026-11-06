import { type FieldPosition, PLAYER_RADIUS_YARDS, type Player } from "../model/player.js";
import { GRID_STEP_YARDS, snapToGrid } from "./grid.js";
import { hitTestPlayer, pointDistance } from "./hit-test.js";

/**
 * Where a line point placed on a player belongs: the grid point nearest the edge of that player's
 * marker, just outside it, on the side `from` comes from. Lines are drawn under the players, so a
 * line ending at a player's center would hide its arrowhead or block bar under the marker.
 * Returns `point` unchanged when it is on none of `players`, or when `from` is that player's
 * center and there is no side to stop on.
 */
export function stopShortOfPlayer(
  point: FieldPosition,
  from: FieldPosition,
  players: readonly Player[],
): FieldPosition {
  const target = hitTestPlayer(players, point);
  if (target === undefined) {
    return point;
  }
  const center = target.position;
  const dx = from.lateralYard - center.lateralYard;
  const dy = from.downfieldYard - center.downfieldYard;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return point;
  }
  const along = (distance: number): FieldPosition =>
    snapToGrid({
      lateralYard: center.lateralYard + (dx / length) * distance,
      downfieldYard: center.downfieldYard + (dy / length) * distance,
    });
  // Rounding to the grid can pull the point back inside the marker, so step outward until the
  // rounded point clears it. Rounding moves a point at most 0.36 yards, so this takes two steps
  // at most.
  let distance = PLAYER_RADIUS_YARDS;
  let candidate = along(distance);
  while (pointDistance(candidate, center) <= PLAYER_RADIUS_YARDS) {
    distance += GRID_STEP_YARDS;
    candidate = along(distance);
  }
  return candidate;
}
