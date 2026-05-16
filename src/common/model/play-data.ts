// 商用ソフトに保存・復元される唯一のデータ表現（PRD 5.8 / 6.6）。
// DOM 非依存。M1 で field、M2 で players、M3 で lines を確定。

import { type Line, normalizeLines } from "./line.js";
import { normalizePlayers, type Player } from "./player.js";

/**
 * フィールドのどの 30 ヤード窓を映すか（PRD 5.1）。
 * - `middle`: 中央（センター付近）
 * - `redzone`: 相手レッドゾーン（相手ゴール側）
 * - `own-redzone`: 自陣レッドゾーン（自ゴール側）
 */
export type FieldZone = "middle" | "redzone" | "own-redzone";

/** ゾーン未指定時の既定。中央が最も汎用的な初期表示。 */
export const DEFAULT_FIELD_ZONE: FieldZone = "middle";

const FIELD_ZONES: readonly FieldZone[] = ["middle", "redzone", "own-redzone"];

export interface FieldState {
  zone: FieldZone;
}

/**
 * プレー図データ。`version` でスキーマ進化に備える（マイグレーション機構は M8）。
 */
export interface PlayData {
  version: 1;
  field: FieldState;
  /** 配置済みの選手（描画順 = 配列順。後の要素ほど上に重なる）。 */
  players: Player[];
  /** 描画する線（描画順 = 配列順。選手の下に敷く＝起点が選手で隠れない）。 */
  lines: Line[];
}

export function isFieldZone(value: unknown): value is FieldZone {
  return typeof value === "string" && (FIELD_ZONES as readonly string[]).includes(value);
}

/** 既定状態の新規 PlayData（選手・線なし）。 */
export function createEmptyPlayData(): PlayData {
  return { version: 1, field: { zone: DEFAULT_FIELD_ZONE }, players: [], lines: [] };
}

/**
 * 外部（商用ソフト）から渡る initialData を内部で安全に扱える形へ正規化する。
 * 永続化された古い／不完全なデータでも落とさず既定で補完する（PRD 6.6 の契約準備）。
 * 返り値は常に新規オブジェクトで、入力を共有・変更しない（Model 専有のため）。
 * 本格的な version マイグレーションは M8 で確定する。
 */
export function resolvePlayData(data: PlayData | undefined): PlayData {
  const zone = data?.field?.zone;
  // 線の起点参照を弾けるよう、先に選手を確定してから id 集合を渡す。
  const players = normalizePlayers(data?.players);
  const validPlayerIds = new Set(players.map((p) => p.id));
  return {
    version: 1,
    field: { zone: isFieldZone(zone) ? zone : DEFAULT_FIELD_ZONE },
    players,
    lines: normalizeLines(data?.lines, validPlayerIds),
  };
}
