import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseBoundedArray,
} from "./guards.js";

/**
 * 選手マーカーの形状。種類が多いと図が散らかるので、丸と四角の 2 種だけにする。
 * どちらも外接円を当たり判定にできるので、hit-test は形状で分けない。
 */
export const PLAYER_SHAPE_VALUES = ["circle", "square"] as const;

export type PlayerShape = (typeof PLAYER_SHAPE_VALUES)[number];

/** 形状を指定しないときの既定。 */
export const DEFAULT_PLAYER_SHAPE: PlayerShape = "circle";

/**
 * 外部から受け取る選手の上限。実際のプレー図は 22 人ほどなので実用は妨げず、
 * 壊れたデータや悪意のあるデータで描画が止まらないように、超えた分は正規化で捨てる。
 */
export const MAX_PLAYERS = 64;

/**
 * 選手マーカーの半径（ヤード）。描く大きさと当たり判定の半径に同じ値を使う。
 * フィールドは縦横を同じ縮尺で描くので、ヤードでの円がそのまま画面上の円になる。
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

/** 1 人の選手。`color` は CSS の色の文字列で、省くとテーマの色で描く。 */
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
 * 外から受け取った 1 要素を Player に正規化する。位置が座標でないものは null を返して捨てる。
 * 形状、ラベル、色が欠けていても捨てずに既定で補う。古い版で保存したデータを読めなくしないため。
 * 返り値は新しいオブジェクトで、入力と参照を共有しない。
 */
function normalizePlayer(raw: unknown, index: number): Player | null {
  if (!isRecord(raw)) {
    return null;
  }
  const position = parseFieldPosition(raw.position);
  if (position === null) {
    return null;
  }

  // id が無ければ配列の中の位置から決まる id を振り、同じデータを何度読んでも同じ id になるようにする。
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
 * 外から受け取った players を Player[] に正規化する。配列でなければ空配列を返す。
 * 先頭の MAX_PLAYERS 個より後ろの要素は読まずに捨てる。
 */
export function normalizePlayers(raw: unknown): Player[] {
  return parseBoundedArray(raw, MAX_PLAYERS, normalizePlayer);
}

/** 位置まで複製し、元の選手と参照を共有しない。 */
export function clonePlayer(player: Player): Player {
  return {
    id: player.id,
    position: { ...player.position },
    shape: player.shape,
    label: player.label,
    ...(player.color === undefined ? {} : { color: player.color }),
  };
}
