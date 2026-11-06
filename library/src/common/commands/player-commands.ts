import { clampToZoneWindow } from "../geometry/field.js";
import type { Line } from "../model/line.js";
import type { FieldState } from "../model/play-data.js";
import type { IPlayModel, PlayerRemoval, ReplacedElements } from "../model/play-model.js";
import type { FieldPosition, Player } from "../model/player.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyPatch, type Patch, patchChangesAnything } from "./patch.js";

/** The id identifies a player, so a patch never changes it. */
export type PlayerPatch = Patch<Omit<Player, "id">>;

export function applyPlayerPatch(current: Player, patch: PlayerPatch): Player {
  return applyPatch<Player>(current, patch);
}

/** A player at a new position, with the lines that start at it. */
export interface MovedPlayer {
  readonly player: Player;
  readonly lines: readonly Line[];
}

/**
 * The player moved to `to`, and the given lines that start at it moved by the same distance, so a
 * route keeps its shape when a receiver's split changes. Each moved point is kept inside the zone
 * window. Every position is on the grid and so is the distance, so the moved points are too.
 */
export function movePlayerWithLines(
  player: Player,
  to: FieldPosition,
  lines: readonly Line[],
  field: FieldState,
): MovedPlayer {
  const dx = to.lateralYard - player.position.lateralYard;
  const dy = to.downfieldYard - player.position.downfieldYard;
  const shift = (p: FieldPosition): FieldPosition =>
    clampToZoneWindow(
      { lateralYard: p.lateralYard + dx, downfieldYard: p.downfieldYard + dy },
      field,
    );
  return {
    player: { ...player, position: to },
    lines: lines
      .filter((l) => l.startPlayerId === player.id)
      .map((l) => ({ ...l, waypoints: l.waypoints.map(shift), end: shift(l.end) })),
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

/**
 * Moves a player, and with `withLines` also the lines that start at it, as one edit. Undo puts the
 * player and the lines back where they were.
 */
export class MovePlayerCommand implements ICommand {
  readonly label = "Move player";
  private readonly playerId: string;
  private readonly to: FieldPosition;
  private readonly withLines: boolean;
  private replaced: ReplacedElements | undefined;

  constructor(playerId: string, to: FieldPosition, withLines: boolean) {
    this.playerId = playerId;
    this.to = to;
    this.withLines = withLines;
  }

  apply(model: IPlayModel): boolean {
    const { lines, field } = model.getSnapshot();
    const moved = movePlayerWithLines(
      model.getPlayer(this.playerId),
      this.to,
      this.withLines ? lines : [],
      field,
    );
    this.replaced = model.replaceElements([moved.player], moved.lines);
    return true;
  }

  undo(model: IPlayModel): void {
    const { players, lines } = requireApplied(this.replaced, this);
    model.replaceElements(players, lines);
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
