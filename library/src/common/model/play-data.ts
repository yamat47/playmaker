import { isOneOf, isRecord } from "./guards.js";
import { cloneLine, type Line, normalizeLines } from "./line.js";
import { clonePlayer, normalizePlayers, type Player } from "./player.js";

/**
 * フィールドのどの範囲を映すか。
 * - `middle`: センター付近
 * - `redzone`: 相手のゴール側
 * - `own-redzone`: 自陣のゴール側
 */
export const FIELD_ZONE_VALUES = ["own-redzone", "middle", "redzone"] as const;

export type FieldZone = (typeof FIELD_ZONE_VALUES)[number];

/** ゾーンを指定しないときの既定。LOS の位置を選ばない図が多いので中央にする。 */
export const DEFAULT_FIELD_ZONE: FieldZone = "middle";

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
 * 今の PlayData のスキーマの版。スキーマを変えるときは 1 上げ、`PLAY_DATA_MIGRATIONS` に
 * 1 つ前の版から変換する段を足す。
 */
export const CURRENT_PLAY_DATA_VERSION = 2 as const;

/**
 * プレー図のデータ。保存したものを `restorePlayData` に渡すと、古い版や版の無いもの、
 * 新しい版のものも今の版に寄せて読む。
 */
export interface PlayData {
  readonly version: typeof CURRENT_PLAY_DATA_VERSION;
  readonly field: FieldState;
  /** 後の要素ほど上に重ねて描く。 */
  readonly players: readonly Player[];
  /** 後の要素ほど上に重ねて描く。 */
  readonly lines: readonly Line[];
}

/**
 * 型付きで組み立てて読み込む図。LOS の位置は読み込むときにゾーンから決め直すので、
 * `field.losYard` は省略できる。
 */
export interface PlayDataInput extends Omit<PlayData, "field"> {
  readonly field: Omit<FieldState, "losYard"> & { readonly losYard?: number | undefined };
}

export function isFieldZone(value: unknown): value is FieldZone {
  return isOneOf(value, FIELD_ZONE_VALUES);
}

export function fieldStateForZone(zone: FieldZone): FieldState {
  return { zone, losYard: LOS_YARD_BY_ZONE[zone] };
}

/** field、選手、線まで複製し、元のデータと参照を共有しない。 */
export function clonePlayData(data: PlayData): PlayData {
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: { ...data.field },
    players: data.players.map(clonePlayer),
    lines: data.lines.map(cloneLine),
  };
}

/**
 * 今の版の形をしている値を PlayData に正規化する。版を見て変換する段は通さないので、
 * 古い版のデータは `migratePlayData` に渡す。
 * 欠けた項目は既定で補い、読めない要素は捨てる。返り値は新しいオブジェクトで、入力と参照を共有しない。
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
 * 振り直した id は、入力にあるほかの id とも重ねない。
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
