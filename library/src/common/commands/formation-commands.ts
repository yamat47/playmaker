import type { IPlayModel } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import type { ICommand } from "./command.js";

/**
 * Adds a batch of players that already have ids assigned. Existing players and lines are kept,
 * so an offense formation and a defense formation can be layered one after the other.
 * The change to the Model is made in one go, so only one notification is sent.
 */
export class LoadFormationCommand implements ICommand {
  readonly label = "Load formation";
  private readonly players: readonly Player[];

  constructor(players: readonly Player[]) {
    this.players = players;
  }

  apply(model: IPlayModel): boolean {
    model.addPlayers(this.players);
    return true;
  }

  undo(model: IPlayModel): void {
    // Lines starting from the added players come from later commands, so they are already undone.
    model.removePlayers(this.players.map((p) => p.id));
  }
}
