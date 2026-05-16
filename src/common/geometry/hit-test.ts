// 選手・線のヒットテスト（PRD 5.2 / 5.3 / 5.4 編集の土台）。DOM 非依存の純計算。
// マーカーは凸図形でも当たり領域は外接円で近似する（戦術的厳密性より組み込み優先・PRD 4.1）。
// 線はレンダラと同じサンプル後ポリラインへの距離で判定し、見た目と当たりを一致させる。
// フィールドは縦横等倍スケールのため、ヤード空間の円判定が画面上の円と一致する。

import { indexPlayersById, type Line, lineAnchorPoints } from "../model/line.js";
import type { FieldPosition, Player } from "../model/player.js";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { sampleLinePath } from "./bezier.js";

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
  for (let i = players.length - 1; i >= 0; i--) {
    const player = players[i];
    if (player === undefined) {
      continue;
    }
    const dx = player.position.lateralYard - target.lateralYard;
    const dy = player.position.absoluteYard - target.absoluteYard;
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
  const aby = b.absoluteYard - a.absoluteYard;
  const apx = p.lateralYard - a.lateralYard;
  const apy = p.absoluteYard - a.absoluteYard;
  const lenSq = abx * abx + aby * aby;
  // 射影パラメタ t を [0,1] に丸めて線分内に収める。退化時は t=0（= 点 a）。
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const dx = apx - t * abx;
  const dy = apy - t * aby;
  return Math.sqrt(dx * dx + dy * dy);
}

/** ポリライン（連続する線分列）への最短距離。点が 1 個ならその点距離。 */
function distanceToPolyline(p: FieldPosition, points: readonly FieldPosition[]): number {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (points.length === 1) {
    const only = points[0] as FieldPosition;
    return distanceToSegment(p, only, only);
  }
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(p, points[i] as FieldPosition, points[i + 1] as FieldPosition);
    if (d < min) {
      min = d;
    }
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
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
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
