import type { Line } from "../model/line.js";
import { type FieldPosition, PLAYER_RADIUS_YARDS, type Player } from "../model/player.js";
import { sampleLinePath } from "./bezier.js";

function isInsideCircle(point: FieldPosition, center: FieldPosition, radius: number): boolean {
  return (
    Math.hypot(
      point.lateralYard - center.lateralYard,
      point.downfieldYard - center.downfieldYard,
    ) <= radius
  );
}

/**
 * The path cut where it last enters the circle, so that it ends on the circle's edge. Unchanged
 * when no point of the path lies outside the circle.
 */
function clipEndAtCircle(
  path: readonly FieldPosition[],
  center: FieldPosition,
  radius: number,
): readonly FieldPosition[] {
  let i = -1;
  for (const [k, point] of path.entries()) {
    if (!isInsideCircle(point, center, radius)) {
      i = k;
    }
  }
  const a = path[i];
  const b = path[i + 1];
  if (a === undefined || b === undefined) {
    return path;
  }
  // a is outside and b inside, so the segment crosses the edge once: at the smaller root t of
  // |a + t(b - a) - center| = radius.
  const dx = b.lateralYard - a.lateralYard;
  const dy = b.downfieldYard - a.downfieldYard;
  const fx = a.lateralYard - center.lateralYard;
  const fy = a.downfieldYard - center.downfieldYard;
  const qa = dx * dx + dy * dy;
  const qb = fx * dx + fy * dy;
  const qc = fx * fx + fy * fy - radius * radius;
  const t = (-qb - Math.sqrt(qb * qb - qa * qc)) / qa;
  return [
    ...path.slice(0, i + 1),
    { lateralYard: a.lateralYard + dx * t, downfieldYard: a.downfieldYard + dy * t },
  ];
}

function computeDrawnPath(line: Line, players: readonly Player[]): readonly FieldPosition[] {
  const start = players.find((p) => p.id === line.startPlayerId);
  if (start === undefined) {
    return [];
  }
  const path = sampleLinePath([start.position, ...line.waypoints, line.end], line.interpolation);
  // The topmost player under the end, as in the hit test. The start player is left out: a line
  // that comes back to its own player still ends where it was placed.
  for (const player of [...players].reverse()) {
    if (player !== start && isInsideCircle(line.end, player.position, PLAYER_RADIUS_YARDS)) {
      return clipEndAtCircle(path, player.position, PLAYER_RADIUS_YARDS);
    }
  }
  return path;
}

// Rendering, the hit test, and the handles ask for the same paths on every frame. An edit replaces
// the line and the players array instead of changing them, so a path stays valid until either is
// replaced.
const cache = new WeakMap<
  Line,
  { readonly players: readonly Player[]; readonly path: readonly FieldPosition[] }
>();

/**
 * The polyline a line is drawn along, from the center of its start player. A line that ends on
 * another player stops where it enters that player's marker (the circumscribed circle the hit
 * test uses), because lines are drawn under the players and the arrowhead or the block bar would
 * be hidden. The end point itself stays where it was placed. Empty when the start player is not
 * among players. Returns the same array for the same line and players array.
 */
export function drawnLinePath(line: Line, players: readonly Player[]): readonly FieldPosition[] {
  const cached = cache.get(line);
  if (cached?.players === players) {
    return cached.path;
  }
  const path = computeDrawnPath(line, players);
  cache.set(line, { players, path });
  return path;
}

/** Where the drawn line ends: its end point, or the edge of the marker it stops at. */
export function drawnLineEnd(line: Line, players: readonly Player[]): FieldPosition {
  return drawnLinePath(line, players).at(-1) ?? line.end;
}
