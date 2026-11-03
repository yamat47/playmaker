// 配置は presets/alignments.ts にあり、プレーのプリセットと共有する。ここでは id を外して隊形にする。

import type { Player } from "../model/player.js";
import {
  bunch,
  defense34,
  defense43,
  defense335,
  defense425,
  dime,
  empty,
  iFormation,
  NICKEL_BASE,
  nickel,
  pistol,
  shotgunSpread,
  singlebackAce,
  trips,
} from "../presets/alignments.js";
import { deepFreeze, type TeamSide } from "../presets/shared.js";
import { type Formation, toFormationPlayer } from "./formation.js";

function formation(id: string, name: string, side: TeamSide, players: Player[]): Formation {
  return { id, name, side, players: players.map(toFormationPlayer) };
}

export const FORMATION_PRESETS: readonly Formation[] = /* @__PURE__ */ deepFreeze([
  formation("i-formation", "I-Formation", "offense", iFormation()),
  formation("singleback-ace", "Singleback Ace", "offense", singlebackAce()),
  formation("shotgun-spread", "Shotgun Spread", "offense", shotgunSpread()),
  formation("trips", "Trips", "offense", trips()),
  formation("empty", "Empty", "offense", empty()),
  formation("pistol", "Pistol", "offense", pistol()),
  formation("bunch", "Bunch", "offense", bunch()),
  formation("defense-4-3", "4-3 Over", "defense", defense43()),
  formation("defense-3-4", "3-4", "defense", defense34()),
  formation("defense-nickel", "Nickel", "defense", nickel(NICKEL_BASE)),
  formation("defense-dime", "Dime", "defense", dime()),
  formation("defense-4-2-5", "4-2-5", "defense", defense425()),
  formation("defense-3-3-5", "3-3-5", "defense", defense335()),
]);

export function getFormationPreset(id: string): Formation | undefined {
  return FORMATION_PRESETS.find((f) => f.id === id);
}
