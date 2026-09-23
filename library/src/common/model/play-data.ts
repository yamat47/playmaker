// 商用ソフトに保存・復元される唯一のデータ表現（PRD 5.8 / 6.6）。
// DOM 非依存。field / players / lines を持つ。

import { isOneOf, isRecord } from "./guards.js";
import { cloneLine, type Line, normalizeLines } from "./line.js";
import { clonePlayer, normalizePlayers, type Player } from "./player.js";

/**
 * フィールドのどの 30 ヤード窓を映すか（PRD 5.1）。
 * - `middle`: 中央（センター付近）
 * - `redzone`: 相手レッドゾーン（相手ゴール側）
 * - `own-redzone`: 自陣レッドゾーン（自ゴール側）
 */
export const FIELD_ZONE_VALUES = ["own-redzone", "middle", "redzone"] as const;

export type FieldZone = (typeof FIELD_ZONE_VALUES)[number];

/** ゾーン未指定時の既定。中央が最も汎用的な初期表示。 */
export const DEFAULT_FIELD_ZONE: FieldZone = "middle";

/** ゾーンの表示名。 */
export const FIELD_ZONE_LABELS = {
  "own-redzone": "自陣RZ",
  middle: "中央",
  redzone: "相手RZ",
} as const satisfies Record<FieldZone, string>;

/**
 * ゾーンごとの LOS の絶対ヤード（0 = 自ゴール、100 = 相手ゴール）。
 * 窓の中にバックフィールドとダウンフィールドの両方が収まる位置に置く。
 * - `middle`: センター
 * - `redzone`: 相手 15 ヤード
 * - `own-redzone`: 自陣 10 ヤード
 */
export const LOS_YARD_BY_ZONE = {
  "own-redzone": 10,
  middle: 50,
  redzone: 85,
} as const satisfies Record<FieldZone, number>;

export interface FieldState {
  readonly zone: FieldZone;
  /**
   * LOS の絶対ヤード。今はゾーンから決まり、読み込んだデータの値は使わない。
   * 保存するデータから選手の絶対位置を復元できるよう、値としては持たせる。
   */
  readonly losYard: number;
}

/**
 * 現在の PlayData スキーマ版。スキーマを変えるたびに +1 し、`migratePlayData` の
 * 段（`PLAY_DATA_MIGRATIONS`）に旧→新の変換を 1 つ足す。version の真実源はここ 1 か所。
 */
export const CURRENT_PLAY_DATA_VERSION = 2 as const;

/**
 * プレー図データ。`version` でスキーマ進化に備え、復元時は `migratePlayData` が
 * 旧版・版なし・未来版いずれも現行へ寄せる（PRD 6.6 の往復契約）。
 */
export interface PlayData {
  readonly version: typeof CURRENT_PLAY_DATA_VERSION;
  readonly field: FieldState;
  /** 配置済みの選手（描画順 = 配列順。後の要素ほど上に重なる）。 */
  readonly players: readonly Player[];
  /** 描画する線（描画順 = 配列順。選手の下に敷く＝起点が選手で隠れない）。 */
  readonly lines: readonly Line[];
}

export function isFieldZone(value: unknown): value is FieldZone {
  return isOneOf(value, FIELD_ZONE_VALUES);
}

export function fieldStateForZone(zone: FieldZone): FieldState {
  return { zone, losYard: LOS_YARD_BY_ZONE[zone] };
}

/** 既定状態の新規 PlayData（選手・線なし）。 */
export function createEmptyPlayData(): PlayData {
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: fieldStateForZone(DEFAULT_FIELD_ZONE),
    players: [],
    lines: [],
  };
}

/**
 * PlayData を深く複製する（field / 各 player / 各 line まで共有しない）。
 * Model が外へ渡すスナップショット（onChange 通知・getData）を入力と切り離すための一手。
 * 商用ソフトが受け取ったデータを書き換えても内部状態に波及しない（PRD 5.8 の往復契約準備）。
 */
export function clonePlayData(data: PlayData): PlayData {
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: { ...data.field },
    players: data.players.map(clonePlayer),
    lines: data.lines.map(cloneLine),
  };
}

/**
 * blob を現行スキーマの構造へ正規化する（version 検出・段適用は `migratePlayData`）。
 * 永続化された古い／不完全なデータでも落とさず既定で補完する。返り値は常に新規
 * オブジェクトで入力を共有・変更しない（Model 専有）。version マイグレーション段を
 * 通した後の最終正規化として `migratePlayData` から呼ばれる（PRD 6.6 の往復契約）。
 */
export function resolvePlayData(data: unknown): PlayData {
  const source: Record<string, unknown> = isRecord(data) ? data : {};
  const zone = isRecord(source.field) ? source.field.zone : undefined;
  // 線の起点参照を弾けるよう、先に選手を確定してから id 集合を渡す。
  // 重複した選手 id は後ろの方を振り直すので、その id を指す線は先頭の選手に付く。
  const players = makeIdsUnique(normalizePlayers(source.players));
  const validPlayerIds = new Set(players.map((p) => p.id));
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: fieldStateForZone(isFieldZone(zone) ? zone : DEFAULT_FIELD_ZONE),
    players,
    lines: makeIdsUnique(normalizeLines(source.lines, validPlayerIds)),
  };
}

/**
 * 2 回目以降に現れた id を `${id}-2` のような未使用の id へ振り直す（先頭はそのまま）。
 * 同じ id が 2 つあると、hit-test は末尾を返すのに更新は先頭に当たり、別の要素が編集される。
 * 振り直した id は、入力に明示された他の id とも衝突させない。
 */
function makeIdsUnique<T extends { readonly id: string }>(items: readonly T[]): T[] {
  const taken = new Set(items.map((item) => item.id));
  const seen = new Set<string>();
  return items.map((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return item;
    }
    let n = 2;
    while (taken.has(`${item.id}-${n}`)) {
      n += 1;
    }
    const id = `${item.id}-${n}`;
    taken.add(id);
    seen.add(id);
    return { ...item, id };
  });
}
