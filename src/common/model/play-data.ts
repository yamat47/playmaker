// 商用ソフトに保存・復元される唯一のデータ表現（PRD 5.8 / 6.6）。
// DOM 非依存。M1 で field、M2 で players、M3 で lines を確定。

import { cloneLine, type Line, normalizeLines } from "./line.js";
import { clonePlayer, normalizePlayers, type Player } from "./player.js";

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
 * 現在の PlayData スキーマ版。スキーマを変えるたびに +1 し、`migratePlayData` の
 * 段（`PLAY_DATA_MIGRATIONS`）に旧→新の変換を 1 つ足す。version の真実源はここ 1 か所。
 */
export const CURRENT_PLAY_DATA_VERSION = 1 as const;

/**
 * プレー図データ。`version` でスキーマ進化に備え、復元時は `migratePlayData` が
 * 旧版・版なし・未来版いずれも現行へ寄せる（PRD 6.6 の往復契約）。
 */
export interface PlayData {
  version: typeof CURRENT_PLAY_DATA_VERSION;
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
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: DEFAULT_FIELD_ZONE },
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
export function resolvePlayData(data: PlayData | undefined): PlayData {
  const zone = data?.field?.zone;
  // 線の起点参照を弾けるよう、先に選手を確定してから id 集合を渡す。
  const players = normalizePlayers(data?.players);
  const validPlayerIds = new Set(players.map((p) => p.id));
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: isFieldZone(zone) ? zone : DEFAULT_FIELD_ZONE },
    players,
    lines: normalizeLines(data?.lines, validPlayerIds),
  };
}
