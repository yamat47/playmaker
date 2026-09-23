import type { Line } from "../common/model/line.js";
import {
  CURRENT_PLAY_DATA_VERSION,
  fieldStateForZone,
  type PlayData,
} from "../common/model/play-data.js";
import type { Player } from "../common/model/player.js";

export function player(id: string, lateralYard = 5, downfieldYard = 50): Player {
  return { id, position: { lateralYard, downfieldYard }, shape: "circle", label: id };
}

export function line(id: string, startPlayerId = "a"): Line {
  return {
    id,
    kind: "route",
    startPlayerId,
    waypoints: [],
    end: { lateralYard: 5, downfieldYard: 60 },
    interpolation: "straight",
  };
}

/** 中央のゾーンに置いた図。引数を省くと、壊れたデータを読んだときの既定の図と同じになる。 */
export function playData(players: readonly Player[] = [], lines: readonly Line[] = []): PlayData {
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: fieldStateForZone("middle"),
    players,
    lines,
  };
}
