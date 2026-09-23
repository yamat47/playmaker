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

/** a (10, 0) と b (20, 0) の 2 人と、a から (15, 2) を通って (25, 5) で終わる線 l の図。 */
export function twoPlayersWithRoute(): PlayData {
  return playData(
    [player("a", 10, 0), player("b", 20, 0)],
    [
      {
        ...line("l"),
        waypoints: [{ lateralYard: 15, downfieldYard: 2 }],
        end: { lateralYard: 25, downfieldYard: 5 },
      },
    ],
  );
}

/** LOS の 10 ヤード後ろに横一列に並べた count 人。 */
export function manyPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => player(`m-${i}`, 1 + (i % 50), -10));
}
