// 選手のヒットテスト（PRD 5.2 / 5.4 編集の土台）。DOM 非依存の純計算。
// マーカーは凸図形でも当たり領域は外接円で近似する（戦術的厳密性より組み込み優先・PRD 4.1）。
// フィールドは縦横等倍スケールのため、ヤード空間の円判定が画面上の円と一致する。

import type { FieldPosition, Player } from "../model/player.js";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";

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
