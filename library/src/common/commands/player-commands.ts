import type { IPlayModel, PlayerRemoval } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyPatch, type Patch, patchChangesAnything } from "./patch.js";

/** id は選手を見分ける鍵なので、パッチでは変えない。 */
export type PlayerPatch = Patch<Omit<Player, "id">>;

export function applyPlayerPatch(current: Player, patch: PlayerPatch): Player {
  return applyPatch<Player>(current, patch);
}

export class AddPlayerCommand implements ICommand {
  readonly label = "選手の追加";
  private readonly player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  apply(model: IPlayModel): boolean {
    model.addPlayer(this.player);
    return true;
  }

  undo(model: IPlayModel): void {
    // 追加した直後の選手を起点にした線は、それより後のコマンドなので先に取り消されている。
    // 削除で控える従属線は空なので捨てる。
    model.removePlayer(this.player.id);
  }
}

/** 起点がその選手の線も一緒に消す。undo は選手と線を元の並びの位置へ戻す。 */
export class RemovePlayerCommand implements ICommand {
  readonly label = "選手の削除";
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

/** 位置、ラベル、形状、色をまとめて編集する。 */
export class UpdatePlayerCommand implements ICommand {
  readonly label = "選手の編集";
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
