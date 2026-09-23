import { isFiniteNumber, isRecord } from "./guards.js";
import { MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "./line.js";
import { DEFAULT_FIELD_ZONE, fieldStateForZone, isFieldZone } from "./play-data.js";
import { MAX_PLAYERS } from "./player.js";

/**
 * v1 の線の太さは CSS px だった。プロパティパネルは未指定の線を 2 px と表示していたので、
 * v2 ではその値を倍率 1 とみなして割り戻す。
 */
export const V1_DEFAULT_THICKNESS_PX = 2;

/** 形が崩れた値はそのまま返し、捨てるかどうかは後の正規化に任せる。 */
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
    thickness: isFiniteNumber(raw.thickness)
      ? raw.thickness / V1_DEFAULT_THICKNESS_PX
      : raw.thickness,
  };
}

/**
 * v1 は縦の位置を絶対ヤード（`absoluteYard`）で持っていた。v2 はゾーンの LOS からの距離
 * （`downfieldYard`）で持つので、v1 のゾーンの LOS を引いて、画面上の位置を変えずに移す。
 * 配列は正規化と同じく上限の個数までしか読まない。
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
