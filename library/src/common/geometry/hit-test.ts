import { indexPlayersById, type Line, lineAnchorPoints } from "../model/line.js";
import type { FieldPosition, Player } from "../model/player.js";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { sampleLinePath } from "./bezier.js";
import { segments } from "./polyline.js";

/**
 * target に重なる選手のうち、いちばん上に描いたものを返す。後の要素ほど上に描くので末尾から探す。
 * 四角の選手も外接円で当てる。形ごとに当たりを変えるほどの差が無いため。
 */
export function hitTestPlayer(
  players: readonly Player[],
  target: FieldPosition,
  radiusYards: number = PLAYER_RADIUS_YARDS,
): Player | undefined {
  if (radiusYards <= 0) {
    throw new Error("Playmaker: radiusYards は正の数である必要があります。");
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
 * 線に当たったとみなす距離（ヤード）。線の太さでは細すぎて掴めないので、太さとは別に持つ。
 * 選手の半径より小さくし、選手の近くを押したときに線を掴みにくくしている。
 */
export const LINE_HIT_TOLERANCE_YARDS = 0.6;

export function distanceToSegment(p: FieldPosition, a: FieldPosition, b: FieldPosition): number {
  const abx = b.lateralYard - a.lateralYard;
  const aby = b.downfieldYard - a.downfieldYard;
  const apx = p.lateralYard - a.lateralYard;
  const apy = p.downfieldYard - a.downfieldYard;
  const lenSq = abx * abx + aby * aby;
  // a と b が同じ点なら、a までの距離にする。
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const dx = apx - t * abx;
  const dy = apy - t * aby;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 点が 0 個なら +Infinity。 */
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
 * target に重なる線のうち、いちばん上に描いたものを返す。描くときと同じ折れ線への距離で測るので、
 * 曲線も見えている形のとおりに当たる。起点の選手が無い線は描かれないので、当てない。
 */
export function hitTestLine(
  lines: readonly Line[],
  players: readonly Player[],
  target: FieldPosition,
  toleranceYards: number = LINE_HIT_TOLERANCE_YARDS,
): Line | undefined {
  if (toleranceYards <= 0) {
    throw new Error("Playmaker: toleranceYards は正の数である必要があります。");
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

/** 選択中の線の waypoint と終点のハンドルを掴める半径（ヤード）。 */
export const WAYPOINT_HANDLE_RADIUS_YARDS = 0.9;

export function pointDistance(a: FieldPosition, b: FieldPosition): number {
  return Math.hypot(a.lateralYard - b.lateralYard, a.downfieldYard - b.downfieldYard);
}

/** 線のハンドルに当たったときの、掴んだハンドルとその位置。 */
export type LineHandleHit =
  | { readonly kind: "endpoint"; readonly point: FieldPosition }
  | { readonly kind: "waypoint"; readonly index: number; readonly point: FieldPosition };

/**
 * target に当たる線のハンドルを返す。終点を waypoint より先に当て、先端を動かしたい操作を
 * 最後の waypoint に奪われないようにする。waypoint は後ろほど手前に描くので、末尾から探す。
 */
export function hitLineHandle(
  line: Pick<Line, "waypoints" | "end">,
  target: FieldPosition,
): LineHandleHit | undefined {
  const within = (point: FieldPosition) =>
    pointDistance(target, point) <= WAYPOINT_HANDLE_RADIUS_YARDS;
  if (within(line.end)) {
    return { kind: "endpoint", point: line.end };
  }
  for (const [index, point] of [...line.waypoints.entries()].reverse()) {
    if (within(point)) {
      return { kind: "waypoint", index, point };
    }
  }
  return undefined;
}
