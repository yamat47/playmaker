// 線のデータ表現（PRD 5.3）。DOM 非依存。
// PlayData に合成され商用ソフトの DB に保存される（PRD 5.8）。
// 戦術記法の厳密再現より組み込みやすさ優先（PRD 4.1）: 3 種を構造で区別し、見た目磨きは M9。

import type { FieldPosition, Player } from "./player.js";

/**
 * 線の種別（3 種・PRD 5.3）。
 * - `route`: レシーバー/ランナーの走路。矢印付き。直線・ベジェ曲線の双方を取れる
 * - `block`: OL 等のブロックアサインメント。太め・矢印なし
 * - `motion`: スナップ前の選手移動。破線
 */
export type LineKind = "route" | "block" | "motion";

/**
 * 線の補間方法（PRD 5.4 のプロパティ）。
 * - `straight`: 制御点を直線で結ぶ
 * - `bezier`: 制御点を滑らかな曲線で通す（route の曲走路）
 * block/motion は実質 straight だが、データとしては保持して往復契約を壊さない。
 */
export type LineInterpolation = "straight" | "bezier";

/** 種別未指定時の既定。最も汎用的な走路。 */
export const DEFAULT_LINE_KIND: LineKind = "route";

/** 補間未指定時の既定。直線が最も予測しやすい。 */
export const DEFAULT_LINE_INTERPOLATION: LineInterpolation = "straight";

const LINE_KINDS: readonly LineKind[] = ["route", "block", "motion"];
const LINE_INTERPOLATIONS: readonly LineInterpolation[] = ["straight", "bezier"];

/**
 * 1 本の線。起点は常に選手（`startPlayerId`）、終点は `end`、その間に
 * 任意個の `waypoints` を持つ（PRD 5.3「起点（選手）と終点、任意個の waypoint」）。
 * 起点を選手に紐付けることで、選手が動けば線も追従する（M5 以降の編集で活きる）。
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
  return typeof value === "string" && (LINE_KINDS as readonly string[]).includes(value);
}

export function isLineInterpolation(value: unknown): value is LineInterpolation {
  return typeof value === "string" && (LINE_INTERPOLATIONS as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** 任意値を有限な FieldPosition へ。数値でなければ復元不能として null。 */
function toFieldPosition(raw: unknown): FieldPosition | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const { lateralYard, absoluteYard } = raw as Record<string, unknown>;
  if (!isFiniteNumber(lateralYard) || !isFiniteNumber(absoluteYard)) {
    return null;
  }
  return { lateralYard, absoluteYard };
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
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const source = raw as Record<string, unknown>;

  // 起点は実在する選手でなければ描画も hit-test もできない＝復元不能として除外。
  if (!isNonEmptyString(source.startPlayerId) || !validPlayerIds.has(source.startPlayerId)) {
    return null;
  }
  const end = toFieldPosition(source.end);
  if (end === null) {
    return null;
  }

  const waypoints: FieldPosition[] = Array.isArray(source.waypoints)
    ? source.waypoints.reduce<FieldPosition[]>((acc, point) => {
        const resolved = toFieldPosition(point);
        if (resolved !== null) {
          acc.push(resolved);
        }
        return acc;
      }, [])
    : [];

  const line: Line = {
    id: isNonEmptyString(source.id) ? source.id : `l${index}`,
    kind: isLineKind(source.kind) ? source.kind : DEFAULT_LINE_KIND,
    startPlayerId: source.startPlayerId,
    waypoints,
    end,
    interpolation: isLineInterpolation(source.interpolation)
      ? source.interpolation
      : DEFAULT_LINE_INTERPOLATION,
  };
  // exactOptionalPropertyTypes: 値があるときだけ持たせる。
  if (isNonEmptyString(source.color)) {
    line.color = source.color;
  }
  if (isFiniteNumber(source.thickness) && source.thickness > 0) {
    line.thickness = source.thickness;
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
  raw.forEach((entry, index) => {
    const line = normalizeLine(entry, index, validPlayerIds);
    if (line !== null) {
      lines.push(line);
    }
  });
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
