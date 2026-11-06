import { clampToZoneWindow } from "../geometry/field.js";
import type { PlayData } from "../model/play-data.js";
import type { IPlayModel, PlayerRemoval } from "../model/play-model.js";
import type { FieldPosition, Player } from "../model/player.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyPatch, type Patch, patchChangesAnything } from "./patch.js";

/** The id identifies a player, so a patch never changes it. */
export type PlayerPatch = Patch<Omit<Player, "id">>;

function applyPlayerPatch(current: Player, patch: PlayerPatch): Player {
  return applyPatch<Player>(current, patch);
}

/** A player's move from where it stands to `to`, with the lines that start at it or alone. */
export interface PlayerMove {
  readonly playerId: string;
  /** Where the player stands before the move. */
  readonly from: FieldPosition;
  readonly to: FieldPosition;
  readonly withLines: boolean;
}

/**
 * The diagram after the move. The lines that start at the player move by the same distance, so a
 * route keeps its shape when a receiver's split changes, and each moved point is kept inside the
 * zone window. Every position is on the grid and so is the distance, so the moved points are too.
 */
export function movePlayer<T extends Pick<PlayData, "field" | "players" | "lines">>(
  data: T,
  move: PlayerMove,
): T {
  const dx = move.to.lateralYard - move.from.lateralYard;
  const dy = move.to.downfieldYard - move.from.downfieldYard;
  const shift = (p: FieldPosition): FieldPosition =>
    clampToZoneWindow(
      { lateralYard: p.lateralYard + dx, downfieldYard: p.downfieldYard + dy },
      data.field,
    );
  return {
    ...data,
    players: data.players.map((p) => (p.id === move.playerId ? { ...p, position: move.to } : p)),
    lines: move.withLines
      ? data.lines.map((l) =>
          l.startPlayerId === move.playerId
            ? { ...l, waypoints: l.waypoints.map(shift), end: shift(l.end) }
            : l,
        )
      : data.lines,
  };
}

export class AddPlayerCommand implements ICommand {
  readonly label = "Add player";
  private readonly player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  apply(model: IPlayModel): boolean {
    model.addPlayer(this.player);
    return true;
  }

  undo(model: IPlayModel): void {
    // Lines starting from the added player come from later commands, so they are already undone.
    // The dependent lines recorded by the removal are therefore empty and are dropped.
    model.removePlayer(this.player.id);
  }
}

/**
 * Also removes the lines that start from the player. Undo puts the player and the lines back at
 * their original positions in the order.
 */
export class RemovePlayerCommand implements ICommand {
  readonly label = "Delete player";
  private readonly playerId: string;
  private removal: PlayerRemoval | undefined;

  constructor(playerId: string) {
    this.playerId = playerId;
  }

  apply(model: IPlayModel): boolean {
    this.removal = model.removePlayer(this.playerId);
    return true;
  }

  undo(model: IPlayModel): void {
    model.restorePlayer(requireApplied(this.removal, this));
  }
}

/** Moves a player and its lines as one edit. Undo puts back the diagram as it was. */
export class MovePlayerCommand implements ICommand {
  readonly label = "Move player";
  private readonly move: PlayerMove;
  private previous: PlayData | undefined;

  constructor(move: PlayerMove) {
    this.move = move;
  }

  apply(model: IPlayModel): boolean {
    this.previous = model.replaceAll(movePlayer(model.getSnapshot(), this.move));
    return true;
  }

  // Edits are undone in reverse order, so the diagram now is the one this move produced, and
  // putting back the whole previous diagram undoes exactly this move.
  undo(model: IPlayModel): void {
    model.replaceAll(requireApplied(this.previous, this));
  }
}

/** Edits the position, label, shape, color, and fill together. */
export class UpdatePlayerCommand implements ICommand {
  readonly label = "Update player";
  private readonly playerId: string;
  private readonly patch: PlayerPatch;
  private previous: Player | undefined;

  constructor(playerId: string, patch: PlayerPatch) {
    this.playerId = playerId;
    this.patch = { ...patch };
  }

  apply(model: IPlayModel): boolean {
    const current = model.getPlayer(this.playerId);
    if (!patchChangesAnything(current, this.patch)) {
      return false;
    }
    this.previous = model.updatePlayer(applyPlayerPatch(current, this.patch));
    return true;
  }

  undo(model: IPlayModel): void {
    model.updatePlayer(requireApplied(this.previous, this));
  }
}
