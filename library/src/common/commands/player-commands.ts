import type { IPlayModel, PlayerRemoval } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyPatch, type Patch, patchChangesAnything } from "./patch.js";

/** The id identifies a player, so a patch never changes it. */
export type PlayerPatch = Patch<Omit<Player, "id">>;

export function applyPlayerPatch(current: Player, patch: PlayerPatch): Player {
  return applyPatch<Player>(current, patch);
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
