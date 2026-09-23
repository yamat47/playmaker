// 名称は英語で、説明は日本語で書く。フィールド上の表記を英語に揃えるため。

import type { PlayData } from "../model/play-data.js";
import type { TeamSide } from "../presets/shared.js";

/** プレーの種類。色は持たず、一覧でどう見せるかは使う側が決める。 */
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

/** 線まで描き込んだプレー図に、一覧に出すための情報を添えたもの。 */
export interface PlayPreset {
  readonly id: string;
  readonly name: string;
  readonly side: TeamSide;
  readonly category: PlayCategory;
  /** パーソネルか隊形の短い注記（例: "11 pers"、"Nickel"）。 */
  readonly personnel: string;
  /** コンセプトの 1 行の説明。 */
  readonly summary: string;
  /** そのまま setPlayData に渡せる。 */
  readonly data: PlayData;
}
