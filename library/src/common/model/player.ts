// 選手のデータ表現（PRD 5.2）。DOM 非依存。
// PlayData に合成され商用ソフトの DB に保存される（PRD 5.8）。
// 戦術的厳密性より組み込みやすさ優先（PRD 4.1）: 形状は描画しやすい 6 種の幾何図形に絞る。

import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseBoundedArray,
} from "./guards.js";

/**
 * 選手マーカーの形状（6 種・PRD 5.2）。
 * いずれも凸図形で「外接円 = ヒット領域」が成立し、レンダラ/hit-test を一様に保てる。
 */
export const PLAYER_SHAPE_VALUES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
] as const;

export type PlayerShape = (typeof PLAYER_SHAPE_VALUES)[number];

/** 形状未指定時の既定。最も汎用的な丸。 */
export const DEFAULT_PLAYER_SHAPE: PlayerShape = "circle";

/**
 * 外部から受け取る選手の上限。実際のプレー図は 22 人ほどなので実用は妨げず、
 * 壊れたデータや悪意のあるデータで描画が止まらないように、超えた分は正規化で捨てる。
 */
export const MAX_PLAYERS = 64;

/**
 * 選手マーカーの半径（ヤード）。レンダラの描画サイズと hit-test の当たり半径が
 * 必ず一致するよう common に置き両層で共有する。フィールドは縦横等倍スケールのため、
 * ヤード空間の円形当たり判定がそのまま画面上の円になる。
 */
export const PLAYER_RADIUS_YARDS = 0.93;

/**
 * フィールド上の位置（ヤード）。縦は LOS（`field.losYard`）からの距離で持つので、
 * ゾーンを切り替えて LOS が動いても、図は形を保ったまま一緒に動く。
 * - lateralYard: 0 = 左サイドライン … FIELD_WIDTH_YARDS = 右サイドライン
 * - downfieldYard: 0 = LOS。正が攻撃方向（画面の上）、負がバックフィールド
 */
export interface FieldPosition {
  readonly lateralYard: number;
  readonly downfieldYard: number;
}

/**
 * 1 人の選手。`id` は選択/編集コマンドの安定識別子。
 * `color` は CSS カラー文字列（任意・未指定はテーマ既定）。
 */
export interface Player {
  readonly id: string;
  readonly position: FieldPosition;
  readonly shape: PlayerShape;
  readonly label: string;
  readonly color?: string;
}

export function isPlayerShape(value: unknown): value is PlayerShape {
  return isOneOf(value, PLAYER_SHAPE_VALUES);
}

/** 座標が有限な数でなければ復元できないので null を返す。返す位置は入力と共有しない。 */
export function parseFieldPosition(raw: unknown): FieldPosition | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { lateralYard, downfieldYard } = raw;
  if (!isFiniteNumber(lateralYard) || !isFiniteNumber(downfieldYard)) {
    return null;
  }
  return { lateralYard, downfieldYard };
}

/**
 * 外部（商用ソフト）から渡る 1 要素を内部で安全な Player へ正規化する。
 * 位置が無い/数値でないものは復元不能として null（呼び出し側で除外）。
 * 形状・ラベル・色は欠落しても落とさず既定で補完する（PRD 6.6 の古い永続データ耐性）。
 * 返り値は常に新規オブジェクトで入力を共有しない（Model 専有のため）。
 */
function normalizePlayer(raw: unknown, index: number): Player | null {
  if (!isRecord(raw)) {
    return null;
  }
  const position = parseFieldPosition(raw.position);
  if (position === null) {
    return null;
  }

  // id が無い/空なら index 由来の決定的な id を割り当てる（再正規化でも安定）。
  const id = isNonEmptyString(raw.id) ? raw.id : `p${index}`;
  return {
    id,
    position,
    shape: isPlayerShape(raw.shape) ? raw.shape : DEFAULT_PLAYER_SHAPE,
    label: typeof raw.label === "string" ? raw.label : "",
    // exactOptionalPropertyTypes では undefined を入れられないので、色があるときだけキーを置く。
    ...(isNonEmptyString(raw.color) ? { color: raw.color } : {}),
  };
}

/**
 * 外部から渡る players 配列を内部で安全な Player[] へ正規化する。
 * 配列でない/復元不能な要素は捨て、各要素は新規オブジェクトに複製する。
 * 先頭の MAX_PLAYERS 個より後ろの要素は読まずに捨てる。
 */
export function normalizePlayers(raw: unknown): Player[] {
  return parseBoundedArray(raw, MAX_PLAYERS, normalizePlayer);
}

/** Player を深く複製する（配列・位置まで共有しない防御的コピー）。 */
export function clonePlayer(player: Player): Player {
  return {
    id: player.id,
    position: { ...player.position },
    shape: player.shape,
    label: player.label,
    ...(player.color === undefined ? {} : { color: player.color }),
  };
}
