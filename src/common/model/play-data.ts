// 商用ソフトに保存・復元される唯一のデータ表現（PRD 5.8 / 6.6）。
// DOM 非依存。M1 では field のみ確定し、選手/線は M2・M3 で field と同じ要領で足す。

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
 * 選手・線は後続マイルストーンでこの型に追加する。
 */
export interface PlayData {
  version: 1;
  field: FieldState;
}

export function isFieldZone(value: unknown): value is FieldZone {
  return typeof value === "string" && (FIELD_ZONES as readonly string[]).includes(value);
}

/** 既定状態の新規 PlayData。 */
export function createEmptyPlayData(): PlayData {
  return { version: 1, field: { zone: DEFAULT_FIELD_ZONE } };
}

/**
 * 外部（商用ソフト）から渡る initialData を内部で安全に扱える形へ正規化する。
 * 永続化された古い／不完全なデータでも落とさず既定で補完する（PRD 6.6 の契約準備）。
 * 返り値は常に新規オブジェクトで、入力を共有・変更しない（Model 専有のため）。
 * 本格的な version マイグレーションは M8 で確定する。
 */
export function resolvePlayData(data: PlayData | undefined): PlayData {
  const zone = data?.field?.zone;
  return {
    version: 1,
    field: { zone: isFieldZone(zone) ? zone : DEFAULT_FIELD_ZONE },
  };
}
