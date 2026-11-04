import { isNonEmptyString, isRecord } from "../model/guards.js";
import type { IIdFactory } from "../model/id-factory.js";
import { clonePlayer, normalizePlayers, type Player } from "../model/player.js";
import { isTeamSide, type TeamSide } from "../presets/shared.js";

/**
 * One player of a formation. It has no `id`; one is assigned on every load. Even when the same
 * formation is loaded twice, ids collide neither with players in the diagram nor with players
 * that Undo brings back.
 */
export type FormationPlayer = Omit<Player, "id">;

/**
 * Loading adds players to the current diagram. Besides the presets, a formation built by the
 * consumer can be passed as well.
 */
export interface Formation {
  readonly id: string;
  readonly name: string;
  /** Does not affect where the players are placed when loaded. */
  readonly side: TeamSide;
  /** At least one player. */
  readonly players: readonly FormationPlayer[];
}

/** Treats optional keys like clonePlayer, so adding a value to Player needs no change here. */
export function toFormationPlayer(player: Player): FormationPlayer {
  const { id: _id, ...template } = clonePlayer(player);
  return template;
}

/**
 * Normalizes an externally received formation into a Formation. Players are normalized by the
 * same rules as players in the diagram; null is returned if not a single player can be placed.
 * Missing id, name, and side are filled with defaults.
 * The return value is a new object that shares no references with the input.
 */
export function normalizeFormation(raw: unknown): Formation | null {
  if (!isRecord(raw)) {
    return null;
  }
  const players = normalizePlayers(raw.players).map(toFormationPlayer);
  if (players.length === 0) {
    return null;
  }
  return {
    id: isNonEmptyString(raw.id) ? raw.id : "formation",
    name: isNonEmptyString(raw.name) ? raw.name : "Formation",
    side: isTeamSide(raw.side) ? raw.side : "offense",
    players,
  };
}

/**
 * Assigns ids to the formation's players to make them Players. An id collides neither with
 * takenIds nor with the other players of the same formation.
 */
export function instantiateFormation(
  formation: Formation,
  ids: IIdFactory,
  takenIds: Iterable<string>,
): Player[] {
  const taken = new Set(takenIds);
  return formation.players.map((template) => {
    const id = ids.next("player", taken);
    taken.add(id);
    return { ...template, id };
  });
}
