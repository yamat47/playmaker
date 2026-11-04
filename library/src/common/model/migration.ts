import { isFiniteNumber, isRecord } from "./guards.js";
import { migrateV1ToV2 } from "./migration-v2.js";
import { type PlayData, resolvePlayData } from "./play-data.js";

/**
 * A step that coerces data of an older version into the shape of the next version.
 * resolvePlayData tidies the shape after the steps run, so a step only has to convert the fields
 * whose meaning changes in the next version.
 */
export interface PlayDataMigration {
  /** The version after this step has run. */
  readonly to: number;
  migrate(data: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

/** Ordered by ascending `to`. */
export const PLAY_DATA_MIGRATIONS: readonly PlayDataMigration[] = [
  { to: 2, migrate: migrateV1ToV2 },
];

/**
 * Reads the version declared in the data. Returns 0 when it is not a finite number, so the data
 * runs through every step as the earliest data, which had no version.
 */
export function readDeclaredVersion(raw: unknown): number {
  if (isRecord(raw) && isFiniteNumber(raw.version)) {
    return raw.version;
  }
  return 0;
}

/**
 * Runs only the steps newer than the declared version, in the given order. A non-object value is
 * returned as is without running any step. Data newer than the last step is also returned as is.
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
 * Turns data saved by any version into a PlayData of the current version. Does not throw on
 * broken data. The return value is a new object that shares no references with the input.
 * Players, lines, and waypoints are read only up to MAX_PLAYERS, MAX_LINES, and
 * MAX_WAYPOINTS_PER_LINE.
 */
export function migratePlayData(raw: unknown): PlayData {
  const declared = readDeclaredVersion(raw);
  const migrated = applyPlayDataMigrations(raw, declared, PLAY_DATA_MIGRATIONS);
  // For data of a newer version too, resolvePlayData rewrites version to the current one.
  return resolvePlayData(migrated);
}
