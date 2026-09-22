// PlayData の version 検出 → 旧→現行マイグレーション段適用 → 構造正規化を
// 1 本の公開境界 funnel にまとめる（PRD 6.6 データバージョニング）。
//
// 永続化・復元は商用ソフトの責務（PRD 5.8）。ここへ復元されてくる blob は
// 現行版 / 旧版・版なし / 未来版（新しい lib で保存→古い lib で復元）/ 破損 JSON の
// いずれもありうる。よって「決して投げず、常に現行スキーマへ寄せる」公開境界の
// 防御作法を resolvePlayData / normalizeFormation / resolveImageExportSize と揃え、
// inbound 経路（PlayModel 構築・Playmaker.setPlayData）の唯一の入口にする。

import { type PlayData, resolvePlayData } from "./play-data.js";

/**
 * 旧版 blob を 1 つ上の版の形へ寄せる段。構造の最終正規化は resolvePlayData が
 * 担うので、各段は「次版で意味が変わる項目だけ」を変換すればよい。
 */
export interface PlayDataMigration {
  /** この段を適用すると version はこの値になる（段は `to` 昇順に適用）。 */
  readonly to: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

/**
 * 旧→現行のマイグレーション段（`to` 昇順）。v1 が最初の版なので現状は空。
 *
 * スキーマを v2 へ進めるとき:
 *   1. play-data.ts の CURRENT_PLAY_DATA_VERSION を 2 にする
 *   2. ここへ `{ to: 2, migrate }` を足す（v1 blob を v2 の形へ寄せる）
 *   3. その段の単体テストを書く
 * エンジン applyPlayDataMigrations は段を注入して全分岐を単体テスト済みなので、
 * 段を足しても funnel 自体の経路は緑のまま拡張できる（PRD 6.6 の契約点）。
 */
export const PLAY_DATA_MIGRATIONS: readonly PlayDataMigration[] = [];

/**
 * blob から宣言バージョンを取り出す。数値（有限）でなければ「版の宣言なし」とみなし
 * 0 を返す＝最初期の未バージョン化データ扱いで現行へ引き上げる対象になる。
 */
export function readDeclaredVersion(raw: unknown): number {
  if (typeof raw === "object" && raw !== null) {
    const value = (raw as { version?: unknown }).version;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

/**
 * 宣言版より新しい段だけを `to` 昇順に適用する純粋エンジン。段は引数注入なので
 * UI/レジストリ無しで全分岐を単体テストできる（VSCode 流のフェイク注入）。
 * オブジェクトでない blob は段適用せず素通し（構造正規化が既定補完する）。
 * 宣言版が最終段以上なら適用段が無く blob はそのまま＝未来版の前方互換。
 */
export function applyPlayDataMigrations(
  raw: unknown,
  declaredVersion: number,
  steps: readonly PlayDataMigration[],
): unknown {
  if (typeof raw !== "object" || raw === null) {
    return raw;
  }
  let acc = raw as Record<string, unknown>;
  for (const step of steps) {
    if (step.to > declaredVersion) {
      acc = step.migrate(acc);
    }
  }
  return acc;
}

/**
 * 永続化された任意の blob を現行スキーマの PlayData にする唯一の公開境界 funnel。
 * 版検出 → 旧→現行の段適用 → 構造正規化（resolvePlayData）。決して投げず、
 * version は常に CURRENT_PLAY_DATA_VERSION に確定し、内部状態と切り離した新規
 * オブジェクトを返す（受け手が書き換えても波及しない＝PRD 5.8 の往復契約）。
 */
export function migratePlayData(raw: unknown): PlayData {
  const declared = readDeclaredVersion(raw);
  const migrated = applyPlayDataMigrations(raw, declared, PLAY_DATA_MIGRATIONS);
  // resolvePlayData は CURRENT を刻むので、未来版も含め version は現行に確定する。
  return resolvePlayData(migrated as PlayData | undefined);
}
