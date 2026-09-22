// プレー図プリセットのデータ表現。Formation（配置のみ・線なし）と異なり、
// ルート/ブロック/モーションの線を含む完成したプレー図（PlayData）に、一覧・分類用の
// メタ情報を添えたもの。`data` はそのまま `setPlayData` へ渡して読み込める。
// 名称は現代アメフトの英語表記、説明は日本語（フィールド表記＝英語というプロダクト方針）。

import type { FormationSide } from "../formations/formation.js";
import type { PlayData } from "../model/play-data.js";

/**
 * プレーのタイプ分類。一覧をコールシート風の色タグで束ねるための意味情報で、
 * 実際の配色は demo（UI 層）がこの値に対応づける（common に配色を持ち込まない）。
 */
export type PlayCategory =
  | "run-zone"
  | "run-gap"
  | "pass-quick"
  | "pass-dropback"
  | "pass-deep"
  | "pa"
  | "rpo"
  | "coverage"
  | "pressure";

/** プレー図プリセット。`data` は setPlayData で復元できる完成プレー図。 */
export interface PlayPreset {
  /** 安定識別子（UI の選択値）。 */
  id: string;
  /** 表示名（英語のフットボール用語）。 */
  name: string;
  /** 攻守（一覧の UI グルーピング用）。 */
  side: FormationSide;
  /** タイプ分類（コールシート色タグ）。 */
  category: PlayCategory;
  /** パーソネル/隊形の短い注記（例: "11 pers" / "Nickel"）。 */
  personnel: string;
  /** コンセプトの一行説明（日本語・UI 用）。 */
  summary: string;
  /** そのまま setPlayData へ渡せるプレー図データ。 */
  data: PlayData;
}
