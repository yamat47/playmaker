// 選手のデータ表現（PRD 5.2）。DOM 非依存。
// PlayData に合成され商用ソフトの DB に保存される（PRD 5.8）。
// 戦術的厳密性より組み込みやすさ優先（PRD 4.1）: 形状は描画しやすい 6 種の幾何図形に絞る。

/**
 * 選手マーカーの形状（6 種・PRD 5.2）。
 * いずれも凸図形で「外接円 = ヒット領域」が成立し、レンダラ/hit-test を一様に保てる。
 */
export type PlayerShape = "circle" | "square" | "triangle" | "diamond" | "pentagon" | "hexagon";

/** 形状未指定時の既定。最も汎用的な丸。 */
export const DEFAULT_PLAYER_SHAPE: PlayerShape = "circle";

const PLAYER_SHAPES: readonly PlayerShape[] = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
];

/**
 * 選手マーカーの半径（ヤード）。レンダラの描画サイズと hit-test の当たり半径が
 * 必ず一致するよう common に置き両層で共有する。フィールドは縦横等倍スケールのため、
 * ヤード空間の円形当たり判定がそのまま画面上の円になる。
 */
export const PLAYER_RADIUS_YARDS = 0.93;

/**
 * フィールド上の論理位置（ヤード空間）。geometry の語彙に揃える。
 * - lateralYard: 0 = 左サイドライン … FIELD_WIDTH_YARDS = 右サイドライン
 * - absoluteYard: -10..110（0/100 = 各ゴールライン、50 = センター）
 */
export interface FieldPosition {
  lateralYard: number;
  absoluteYard: number;
}

/**
 * 1 人の選手。`id` は選択/編集コマンドの安定識別子。
 * `color` は CSS カラー文字列（任意・未指定はテーマ既定）。
 */
export interface Player {
  id: string;
  position: FieldPosition;
  shape: PlayerShape;
  label: string;
  color?: string;
}

export function isPlayerShape(value: unknown): value is PlayerShape {
  return typeof value === "string" && (PLAYER_SHAPES as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * 外部（商用ソフト）から渡る 1 要素を内部で安全な Player へ正規化する。
 * 位置が無い/数値でないものは復元不能として null（呼び出し側で除外）。
 * 形状・ラベル・色は欠落しても落とさず既定で補完する（PRD 6.6 の古い永続データ耐性）。
 * 返り値は常に新規オブジェクトで入力を共有しない（Model 専有のため）。
 */
function normalizePlayer(raw: unknown, index: number): Player | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const position = source.position;
  if (typeof position !== "object" || position === null) {
    return null;
  }
  const { lateralYard, absoluteYard } = position as Record<string, unknown>;
  if (!isFiniteNumber(lateralYard) || !isFiniteNumber(absoluteYard)) {
    return null;
  }

  // id が無い/空なら index 由来の決定的な id を割り当てる（再正規化でも安定）。
  const id = isNonEmptyString(source.id) ? source.id : `p${index}`;
  const player: Player = {
    id,
    position: { lateralYard, absoluteYard },
    shape: isPlayerShape(source.shape) ? source.shape : DEFAULT_PLAYER_SHAPE,
    label: typeof source.label === "string" ? source.label : "",
  };
  // exactOptionalPropertyTypes: color は値があるときだけ持たせる。
  if (isNonEmptyString(source.color)) {
    player.color = source.color;
  }
  return player;
}

/**
 * 外部から渡る players 配列を内部で安全な Player[] へ正規化する。
 * 配列でない/復元不能な要素は捨て、各要素は新規オブジェクトに複製する。
 */
export function normalizePlayers(raw: unknown): Player[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const players: Player[] = [];
  raw.forEach((entry, index) => {
    const player = normalizePlayer(entry, index);
    if (player !== null) {
      players.push(player);
    }
  });
  return players;
}

/** Player を深く複製する（配列・位置まで共有しない防御的コピー）。 */
export function clonePlayer(player: Player): Player {
  const copy: Player = {
    id: player.id,
    position: { ...player.position },
    shape: player.shape,
    label: player.label,
  };
  if (player.color !== undefined) {
    copy.color = player.color;
  }
  return copy;
}
