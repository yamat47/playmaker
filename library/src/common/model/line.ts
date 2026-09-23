import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseBoundedArray,
} from "./guards.js";
import { type FieldPosition, type Player, parseFieldPosition } from "./player.js";

/**
 * 線の種別。色ではなく終点の記法と線種で見分ける。
 * - `route`: レシーバーやランナーの走路。終点に矢印を描く
 * - `block`: ブロックの割り当て。route と同じ太さで、終点に T 字のバーを描く
 * - `motion`: スナップ前の選手の移動。破線で、終点に矢印を描く
 */
export const LINE_KIND_VALUES = ["route", "block", "motion"] as const;

export type LineKind = (typeof LINE_KIND_VALUES)[number];

/**
 * 線の補間方法。どの種別の線にも効く。
 * - `straight`: 制御点を直線で結ぶ
 * - `bezier`: 制御点をすべて通る滑らかな曲線で結ぶ
 */
export const LINE_INTERPOLATION_VALUES = ["straight", "bezier"] as const;

export type LineInterpolation = (typeof LINE_INTERPOLATION_VALUES)[number];

/** 種別を指定しないときの既定。 */
export const DEFAULT_LINE_KIND: LineKind = "route";

/** 補間を指定しないときの既定。 */
export const DEFAULT_LINE_INTERPOLATION: LineInterpolation = "straight";

/** 太さ未指定時の倍率。種別ごとの既定の太さでそのまま描く。 */
export const DEFAULT_LINE_THICKNESS = 1;

/**
 * 外から受け取る線と、1 本あたりの waypoint の上限。実際のプレー図は線 20 本ほどで、
 * waypoint も数個なので、この上限に届くことは無い。壊れたデータや悪意のあるデータで
 * 描画が止まらないように、超えた分は正規化で捨てる。
 */
export const MAX_LINES = 128;
export const MAX_WAYPOINTS_PER_LINE = 32;

/**
 * 1 本の線。起点は座標ではなく選手の id で持つので、選手を動かすと線の起点も付いてくる。
 * `color` と `thickness` を省くと、テーマの色と種別ごとの既定の太さで描く。
 */
export interface Line {
  readonly id: string;
  readonly kind: LineKind;
  /** 起点となる選手の id。実在しない参照は復元時に除外される。 */
  readonly startPlayerId: string;
  /** 起点と終点の間の中継点（0 個可）。 */
  readonly waypoints: readonly FieldPosition[];
  /** 終点（ヤード空間）。 */
  readonly end: FieldPosition;
  readonly interpolation: LineInterpolation;
  /** CSS の色の文字列。 */
  readonly color?: string;
  /** 種別ごとの既定の太さに対する倍率。省くと DEFAULT_LINE_THICKNESS。 */
  readonly thickness?: number;
}

export function isLineKind(value: unknown): value is LineKind {
  return isOneOf(value, LINE_KIND_VALUES);
}

export function isLineInterpolation(value: unknown): value is LineInterpolation {
  return isOneOf(value, LINE_INTERPOLATION_VALUES);
}

/** 太さの倍率として受け付ける値か。0 以下では線が見えなくなるので受け付けない。 */
export function isLineThickness(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/**
 * 外から受け取った 1 要素を Line に正規化する。オブジェクトでないもの、起点の選手が実在しないもの、
 * 終点が座標でないものは null を返して捨てる。
 * 種別、補間、id が欠けていても捨てずに既定で補う。古い版で保存したデータを読めなくしないため。
 */
function normalizeLine(
  raw: unknown,
  index: number,
  validPlayerIds: ReadonlySet<string>,
): Line | null {
  if (!isRecord(raw)) {
    return null;
  }

  // 起点の選手が無い線は、描くことも掴むこともできないので捨てる。
  if (!isNonEmptyString(raw.startPlayerId) || !validPlayerIds.has(raw.startPlayerId)) {
    return null;
  }
  const end = parseFieldPosition(raw.end);
  if (end === null) {
    return null;
  }

  return {
    id: isNonEmptyString(raw.id) ? raw.id : `l${index}`,
    kind: isLineKind(raw.kind) ? raw.kind : DEFAULT_LINE_KIND,
    startPlayerId: raw.startPlayerId,
    // 数でない waypoint は個別に捨て、線自体は保持する。
    waypoints: parseBoundedArray(raw.waypoints, MAX_WAYPOINTS_PER_LINE, parseFieldPosition),
    end,
    interpolation: isLineInterpolation(raw.interpolation)
      ? raw.interpolation
      : DEFAULT_LINE_INTERPOLATION,
    // exactOptionalPropertyTypes では undefined を入れられないので、値があるときだけキーを置く。
    ...(isNonEmptyString(raw.color) ? { color: raw.color } : {}),
    ...(isLineThickness(raw.thickness) ? { thickness: raw.thickness } : {}),
  };
}

/**
 * 外から受け取った lines を Line[] に正規化する。配列でなければ空配列を返す。
 * `validPlayerIds` には正規化を済ませた選手の id を渡す。そこに無い選手を起点にする線は捨てる。
 * 先頭の MAX_LINES 個より後ろの要素は読まずに捨てる。
 */
export function normalizeLines(raw: unknown, validPlayerIds: ReadonlySet<string>): Line[] {
  return parseBoundedArray(raw, MAX_LINES, (entry, index) =>
    normalizeLine(entry, index, validPlayerIds),
  );
}

/** waypoints と各座標まで複製し、元の線と参照を共有しない。 */
export function cloneLine(line: Line): Line {
  return {
    id: line.id,
    kind: line.kind,
    startPlayerId: line.startPlayerId,
    waypoints: line.waypoints.map((p) => ({ ...p })),
    end: { ...line.end },
    interpolation: line.interpolation,
    ...(line.color === undefined ? {} : { color: line.color }),
    ...(line.thickness === undefined ? {} : { thickness: line.thickness }),
  };
}

/**
 * 線の制御点の列 [起点の選手の位置, ...waypoints, 終点] を組み立てる。
 * 起点の選手が見つからなければ undefined を返す。
 */
export function lineAnchorPoints(
  line: Line,
  playersById: ReadonlyMap<string, Player>,
): FieldPosition[] | undefined {
  const start = playersById.get(line.startPlayerId);
  if (start === undefined) {
    return undefined;
  }
  return [{ ...start.position }, ...line.waypoints.map((p) => ({ ...p })), { ...line.end }];
}

export function indexPlayersById(players: readonly Player[]): Map<string, Player> {
  const map = new Map<string, Player>();
  for (const player of players) {
    map.set(player.id, player);
  }
  return map;
}
