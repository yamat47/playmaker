// 選手・線のヒットテスト（PRD 5.2 / 5.3 / 5.4 編集の土台）。DOM 非依存の純計算。
// マーカーは凸図形でも当たり領域は外接円で近似する（戦術的厳密性より組み込み優先・PRD 4.1）。
// 線はレンダラと同じサンプル後ポリラインへの距離で判定し、見た目と当たりを一致させる。
// フィールドは縦横等倍スケールのため、ヤード空間の円判定が画面上の円と一致する。

import { indexPlayersById, type Line, lineAnchorPoints } from "../model/line.js";
import type { FieldPosition, Player } from "../model/player.js";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { sampleLinePath } from "./bezier.js";
import { segments } from "./polyline.js";

/**
 * target（ヤード空間。画面 px は FieldGeometry.fromCanvas で変換）に最も手前で
 * 重なる選手を返す。描画順 = 配列順で後の要素ほど上に重なるため、末尾から走査する。
 * 当たり半径はマーカー半径と同一既定（描画と一致）。見つからなければ undefined。
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
 * 線の当たり許容半径（ヤード）。線は面積を持たないため、見た目の太さと無関係に
 * 「掴みやすさ」として持つ。選手半径よりやや細めに既定する（誤クリック抑制）。
 */
export const LINE_HIT_TOLERANCE_YARDS = 0.6;

/** 点 p から線分 a–b への最短距離（ヤード空間）。退化（a=b）は点距離。 */
export function distanceToSegment(p: FieldPosition, a: FieldPosition, b: FieldPosition): number {
  const abx = b.lateralYard - a.lateralYard;
  const aby = b.downfieldYard - a.downfieldYard;
  const apx = p.lateralYard - a.lateralYard;
  const apy = p.downfieldYard - a.downfieldYard;
  const lenSq = abx * abx + aby * aby;
  // 射影パラメタ t を [0,1] に丸めて線分内に収める。退化時は t=0（= 点 a）。
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const dx = apx - t * abx;
  const dy = apy - t * aby;
  return Math.sqrt(dx * dx + dy * dy);
}

/** ポリライン（連続する線分列）への最短距離。点が 1 個ならその点距離、0 個なら +Infinity。 */
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
 * target（ヤード空間）に最も手前で重なる線を返す。レンダラと同じサンプル後
 * ポリライン（bezier は曲線、straight は直線）への距離で判定するため、見えている
 * 線とクリック判定が一致する。描画順 = 配列順で後の要素ほど上＝末尾から走査。
 * 起点選手が存在しない線は描画されないので hit 対象からも外す。
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

/** 2 点間の距離（ヤード）。 */
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
