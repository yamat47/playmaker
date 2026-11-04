import { isOneOf, isRecord } from "./guards.js";
import { cloneLine, type Line, normalizeLines } from "./line.js";
import { clonePlayer, normalizePlayers, type Player } from "./player.js";

/**
 * Which part of the field is shown.
 * - `middle`: around midfield
 * - `redzone`: the opponent's goal side
 * - `own-redzone`: the own goal side
 */
export const FIELD_ZONE_VALUES = ["own-redzone", "middle", "redzone"] as const;

export type FieldZone = (typeof FIELD_ZONE_VALUES)[number];

/** Default when no zone is given. Many diagrams do not depend on where the LOS is, so middle. */
export const DEFAULT_FIELD_ZONE: FieldZone = "middle";

/** English names of the zones. The `en` dictionary uses them; other locales carry their own. */
export const FIELD_ZONE_LABELS = {
  "own-redzone": "Own red zone",
  middle: "Midfield",
  redzone: "Red zone",
} as const satisfies Record<FieldZone, string>;

/**
 * Absolute yard of the LOS per zone (0 = own goal, 100 = opponent's goal).
 * Placed so that both the backfield and the downfield fit inside the window.
 * - `middle`: midfield
 * - `redzone`: the opponent's 15 yard line
 * - `own-redzone`: the own 10 yard line
 */
export const LOS_YARD_BY_ZONE = {
  "own-redzone": 10,
  middle: 50,
  redzone: 85,
} as const satisfies Record<FieldZone, number>;

export interface FieldState {
  readonly zone: FieldZone;
  /**
   * Absolute yard of the LOS. For now it is derived from the zone, and the loaded value is not
   * used. It is kept as a value so the absolute player positions can be recovered from saved data.
   */
  readonly losYard: number;
}

/**
 * Current version of the PlayData schema. When the schema changes, raise it by 1 and add a step
 * to `PLAY_DATA_MIGRATIONS` that converts from the previous version.
 */
export const CURRENT_PLAY_DATA_VERSION = 2 as const;

/**
 * Data of a play diagram. Passing saved data to `restorePlayData` loads it coerced to the
 * current version, whether it is an older version, has no version, or is a newer version.
 */
export interface PlayData {
  readonly version: typeof CURRENT_PLAY_DATA_VERSION;
  readonly field: FieldState;
  /** Later elements are drawn on top. */
  readonly players: readonly Player[];
  /** Later elements are drawn on top. */
  readonly lines: readonly Line[];
}

/**
 * A diagram built with types and loaded. The LOS position is derived again from the zone on
 * load, so `field.losYard` can be omitted.
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

/** Copies down to the field, players, and lines, sharing no references with the original data. */
export function clonePlayData(data: PlayData): PlayData {
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: { ...data.field },
    players: data.players.map(clonePlayer),
    lines: data.lines.map(cloneLine),
  };
}

/**
 * Normalizes a value shaped like the current version into a PlayData. It does not run the
 * version-based migration steps, so pass data of an older version to `migratePlayData`.
 * Missing fields are filled with defaults and unreadable entries are dropped. The return value
 * is a new object that shares no references with the input.
 */
export function resolvePlayData(data: unknown): PlayData {
  const source: Record<string, unknown> = isRecord(data) ? data : {};
  const zone = isRecord(source.field) ? source.field.zone : undefined;
  // Settle the players first and pass their id set, so lines with bad start references can be
  // rejected. Of duplicate player ids the later ones are renumbered, so a line pointing at that
  // id attaches to the first player.
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
 * Renumbers the second and later occurrences of an id to an unused id such as `${id}-2` (the
 * first keeps its id). With two equal ids, the hit test returns the last while an update hits
 * the first, so a different element gets edited. A renumbered id does not collide with any
 * other id in the input either.
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
