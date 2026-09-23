import { isFiniteNumber, isRecord } from "./guards.js";
import { migrateV1ToV2 } from "./migration-v2.js";
import { type PlayData, resolvePlayData } from "./play-data.js";

/**
 * 古い版のデータを 1 つ上の版の形へ寄せる段。段を通したあとで resolvePlayData が形を整えるので、
 * 段は次の版で意味が変わる項目だけを変換すればよい。
 */
export interface PlayDataMigration {
  /** この段を通したあとの版。 */
  readonly to: number;
  migrate(data: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

/** `to` の小さい順に並べる。 */
export const PLAY_DATA_MIGRATIONS: readonly PlayDataMigration[] = [
  { to: 2, migrate: migrateV1ToV2 },
];

/**
 * データに書かれた版を読む。有限の数でなければ 0 を返し、版を持たなかった最初期のデータとして
 * すべての段を通す。
 */
export function readDeclaredVersion(raw: unknown): number {
  if (isRecord(raw) && isFiniteNumber(raw.version)) {
    return raw.version;
  }
  return 0;
}

/**
 * 書かれた版より新しい段だけを、渡した順に通す。オブジェクトでない値は段を通さずにそのまま返す。
 * 最後の段より新しい版のデータも、段を通さずにそのまま返す。
 */
export function applyPlayDataMigrations(
  raw: unknown,
  declaredVersion: number,
  steps: readonly PlayDataMigration[],
): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  let acc = raw;
  for (const step of steps) {
    if (step.to > declaredVersion) {
      acc = step.migrate(acc);
    }
  }
  return acc;
}

/**
 * どの版で保存したデータでも、今の版の PlayData にする。壊れたデータを渡しても投げない。
 * 返り値は新しいオブジェクトで、入力と参照を共有しない。
 * 選手、線、waypoint は MAX_PLAYERS、MAX_LINES、MAX_WAYPOINTS_PER_LINE の個数までしか読まない。
 */
export function migratePlayData(raw: unknown): PlayData {
  const declared = readDeclaredVersion(raw);
  const migrated = applyPlayDataMigrations(raw, declared, PLAY_DATA_MIGRATIONS);
  // 新しい版のデータも、resolvePlayData が version を今の版に書き換える。
  return resolvePlayData(migrated);
}
