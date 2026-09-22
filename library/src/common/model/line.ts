// 線のデータ表現（PRD 5.3）。DOM 非依存。
// PlayData に合成され商用ソフトの DB に保存される（PRD 5.8）。
// 戦術記法の厳密再現より組み込みやすさ優先（PRD 4.1）: 3 種を構造で区別し、見た目磨きは意図的にスコープ外。

import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseFieldPosition,
} from "./guards.js";
import type { FieldPosition, Player } from "./player.js";

/**
 * 線の種別（3 種・PRD 5.3）。
 * - `route`: レシーバー/ランナーの走路。矢印付き。直線・ベジェ曲線の双方を取れる
 * - `block`: OL 等のブロックアサインメント。太め・矢印なし
 * - `motion`: スナップ前の選手移動。破線
 */
export const LINE_KIND_VALUES = ["route", "block", "motion"] as const;

export type LineKind = (typeof LINE_KIND_VALUES)[number];

/**
 * 線の補間方法（PRD 5.4 のプロパティ）。
 * - `straight`: 制御点を直線で結ぶ
 * - `bezier`: 制御点を滑らかな曲線で通す（route の曲走路）
 * block/motion は実質 straight だが、データとしては保持して往復契約を壊さない。
 */
export const LINE_INTERPOLATION_VALUES = ["straight", "bezier"] as const;

export type LineInterpolation = (typeof LINE_INTERPOLATION_VALUES)[number];

/** 種別未指定時の既定。最も汎用的な走路。 */
export const DEFAULT_LINE_KIND: LineKind = "route";

/** 補間未指定時の既定。直線が最も予測しやすい。 */
export const DEFAULT_LINE_INTERPOLATION: LineInterpolation = "straight";

/**
 * 1 本の線。起点は常に選手（`startPlayerId`）、終点は `end`、その間に
 * 任意個の `waypoints` を持つ（PRD 5.3「起点（選手）と終点、任意個の waypoint」）。
 * 起点を選手に紐付けることで、選手が動けば線も追従する。
 * `color`/`thickness` は任意（未指定はテーマ既定）。
 */
export interface Line {
  id: string;
  kind: LineKind;
  /** 起点となる選手の id。実在しない参照は復元時に除外される。 */
  startPlayerId: string;
  /** 起点と終点の間の中継点（0 個可）。 */
  waypoints: FieldPosition[];
  /** 終点（ヤード空間）。 */
  end: FieldPosition;
  interpolation: LineInterpolation;
  /** CSS カラー文字列（任意）。 */
  color?: string;
  /** 線幅（CSS px。任意・未指定はテーマ既定）。 */
  thickness?: number;
}

export function isLineKind(value: unknown): value is LineKind {
  return isOneOf(value, LINE_KIND_VALUES);
}

export function isLineInterpolation(value: unknown): value is LineInterpolation {
  return isOneOf(value, LINE_INTERPOLATION_VALUES);
}

/** 数でない waypoint は個別に捨てる。 */
function normalizeWaypoints(raw: unknown): FieldPosition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const waypoints: FieldPosition[] = [];
  for (const point of raw) {
    const resolved = parseFieldPosition(point);
    if (resolved !== null) {
      waypoints.push(resolved);
    }
  }
  return waypoints;
}

/**
 * 外部（商用ソフト）から渡る 1 要素を内部で安全な Line へ正規化する。
 * 復元不能（非オブジェクト / 起点選手が実在しない / 終点が数値でない）は null で除外。
 * 種別・補間・id は欠落しても落とさず既定で補完する（PRD 6.6 の古い永続データ耐性）。
 * waypoint は数値でない要素だけを個別に捨て、線自体は保持する。
 * 返り値は常に新規オブジェクトで入力を共有しない（Model 専有のため）。
 */
function normalizeLine(
  raw: unknown,
  index: number,
  validPlayerIds: ReadonlySet<string>,
): Line | null {
  if (!isRecord(raw)) {
    return null;
  }

  // 起点は実在する選手でなければ描画も hit-test もできない＝復元不能として除外。
  if (!isNonEmptyString(raw.startPlayerId) || !validPlayerIds.has(raw.startPlayerId)) {
    return null;
  }
  const end = parseFieldPosition(raw.end);
  if (end === null) {
    return null;
  }

  const line: Line = {
    id: isNonEmptyString(raw.id) ? raw.id : `l${index}`,
    kind: isLineKind(raw.kind) ? raw.kind : DEFAULT_LINE_KIND,
    startPlayerId: raw.startPlayerId,
    waypoints: normalizeWaypoints(raw.waypoints),
    end,
    interpolation: isLineInterpolation(raw.interpolation)
      ? raw.interpolation
      : DEFAULT_LINE_INTERPOLATION,
  };
  // exactOptionalPropertyTypes: 値があるときだけ持たせる。
  if (isNonEmptyString(raw.color)) {
    line.color = raw.color;
  }
  if (isFiniteNumber(raw.thickness) && raw.thickness > 0) {
    line.thickness = raw.thickness;
  }
  return line;
}

/**
 * 外部から渡る lines 配列を内部で安全な Line[] へ正規化する。
 * 配列でない/復元不能な要素は捨て、各要素は新規オブジェクトに複製する。
 * `validPlayerIds` は正規化済み players の id 集合（dangling な起点参照を弾くため）。
 */
export function normalizeLines(raw: unknown, validPlayerIds: ReadonlySet<string>): Line[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const lines: Line[] = [];
  for (const [index, entry] of raw.entries()) {
    const line = normalizeLine(entry, index, validPlayerIds);
    if (line !== null) {
      lines.push(line);
    }
  }
  return lines;
}

/** Line を深く複製する（waypoints / 位置まで共有しない防御的コピー）。 */
export function cloneLine(line: Line): Line {
  const copy: Line = {
    id: line.id,
    kind: line.kind,
    startPlayerId: line.startPlayerId,
    waypoints: line.waypoints.map((p) => ({ ...p })),
    end: { ...line.end },
    interpolation: line.interpolation,
  };
  if (line.color !== undefined) {
    copy.color = line.color;
  }
  if (line.thickness !== undefined) {
    copy.thickness = line.thickness;
  }
  return copy;
}

/**
 * 線の制御点列 [起点選手位置, ...waypoints, 終点] を組み立てる。
 * 起点選手が見つからなければ描画/hit-test 不能として undefined。
 * レンダラ・hit-test はこの 1 関数を通して線の幾何を得る（ロジックを common に集約）。
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

/** Player[] を id 引きの Map に。lineAnchorPoints の前段で共有して使う。 */
export function indexPlayersById(players: readonly Player[]): Map<string, Player> {
  const map = new Map<string, Player>();
  for (const player of players) {
    map.set(player.id, player);
  }
  return map;
}
