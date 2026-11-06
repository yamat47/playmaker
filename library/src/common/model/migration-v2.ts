import { isFiniteNumber, isRecord } from "./guards.js";
import { MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "./line.js";
import { DEFAULT_FIELD_ZONE, fieldStateForZone, isFieldZone } from "./play-data.js";
import { MAX_PLAYERS } from "./player.js";

/** A malformed value is returned as is; whether to drop it is left to the later normalization. */
function toV2Position(raw: unknown, losYard: number): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  const { absoluteYard, ...rest } = raw;
  if (!isFiniteNumber(absoluteYard)) {
    return raw;
  }
  return { ...rest, downfieldYard: absoluteYard - losYard };
}

function toV2Player(raw: unknown, losYard: number): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  return { ...raw, position: toV2Position(raw.position, losYard) };
}

function toV2Line(raw: unknown, losYard: number): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  return {
    ...raw,
    waypoints: Array.isArray(raw.waypoints)
      ? raw.waypoints.slice(0, MAX_WAYPOINTS_PER_LINE).map((p) => toV2Position(p, losYard))
      : raw.waypoints,
    end: toV2Position(raw.end, losYard),
  };
}

/**
 * v1 held the vertical position as an absolute yard (`absoluteYard`). v2 holds it as the distance
 * from the zone's LOS (`downfieldYard`), so the LOS of the v1 zone is subtracted to carry the
 * position over without moving it on screen. Arrays are read only up to the limits, as in
 * normalization.
 */
export function migrateV1ToV2(data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const zone =
    isRecord(data.field) && isFieldZone(data.field.zone) ? data.field.zone : DEFAULT_FIELD_ZONE;
  const field = fieldStateForZone(zone);
  const { losYard } = field;
  return {
    ...data,
    field,
    players: Array.isArray(data.players)
      ? data.players.slice(0, MAX_PLAYERS).map((p) => toV2Player(p, losYard))
      : data.players,
    lines: Array.isArray(data.lines)
      ? data.lines.slice(0, MAX_LINES).map((l) => toV2Line(l, losYard))
      : data.lines,
  };
}
