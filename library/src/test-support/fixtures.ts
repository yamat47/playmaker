import type { Line } from "../common/model/line.js";
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
