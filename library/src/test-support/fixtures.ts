import { pointDistance } from "../common/geometry/hit-test.js";
import type { Line } from "../common/model/line.js";
import {
  CURRENT_PLAY_DATA_VERSION,
  fieldStateForZone,
  type PlayData,
} from "../common/model/play-data.js";
import { type FieldPosition, PLAYER_RADIUS_YARDS, type Player } from "../common/model/player.js";

/** Pairs of players whose markers overlap (center distance below the diameter). */
export function overlappingMarkers(
  players: readonly Pick<Player, "position">[],
): [FieldPosition, FieldPosition][] {
  return players.flatMap(({ position: a }, i) =>
    players
      .slice(i + 1)
      .filter(({ position: b }) => pointDistance(a, b) < PLAYER_RADIUS_YARDS * 2)
      .map(({ position: b }): [FieldPosition, FieldPosition] => [a, b]),
  );
}

export function positionOf(data: Pick<PlayData, "players">, id: string): FieldPosition | undefined {
  return data.players.find((p) => p.id === id)?.position;
}

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

/** A diagram in the middle zone. Without arguments it equals the default loaded for broken data. */
export function playData(players: readonly Player[] = [], lines: readonly Line[] = []): PlayData {
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: fieldStateForZone("middle"),
    players,
    lines,
  };
}

/** Players a (10, 0) and b (20, 0), and a line l from a through (15, 2) ending at (25, 5). */
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

/** count players in one row 10 yards behind the LOS. */
export function manyPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => player(`m-${i}`, 1 + (i % 50), -10));
}
