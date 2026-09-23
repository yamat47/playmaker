// 選手の編集操作（PRD 5.4: 追加 / 移動 / 削除 / プロパティ編集）。DOM 非依存。
// 各コマンドは apply 時に逆操作用の状態を自分で捕捉する（redo でも再捕捉され整合する）。

import type { IPlayModel, PlayerRemoval } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import { clonePlayer } from "../model/player.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyPlayerPatch, type PlayerPatch } from "./patch.js";

/** 選手を 1 人追加する。undo は同 id の削除。 */
export class AddPlayerCommand implements ICommand {
  readonly label = "選手の追加";
  private readonly player: Player;

  constructor(player: Player) {
    // 構築後に呼び出し側が元オブジェクトを変えても redo が揺れないよう複製して保持する。
    this.player = clonePlayer(player);
  }

  apply(model: IPlayModel): void {
    model.addPlayer(this.player);
  }

  undo(model: IPlayModel): void {
    // 追加直後の選手に従属線は無い（線は別コマンド＝LIFO で先に巻き戻る）。メメントは捨てる。
    model.removePlayer(this.player.id);
  }
}

/** 選手を 1 人削除する（従属線もカスケード）。undo はメメントから完全復元。 */
export class RemovePlayerCommand implements ICommand {
  readonly label = "選手の削除";
  private readonly playerId: string;
  private removal: PlayerRemoval | undefined;

  constructor(playerId: string) {
    this.playerId = playerId;
  }

  apply(model: IPlayModel): void {
    this.removal = model.removePlayer(this.playerId);
  }

  undo(model: IPlayModel): void {
    model.restorePlayer(requireApplied(this.removal, "RemovePlayerCommand"));
  }
}

/** 選手の位置やプロパティを編集する。undo は編集前の選手へ差し戻す。 */
export class UpdatePlayerCommand implements ICommand {
  readonly label = "選手の編集";
  private readonly playerId: string;
  private readonly patch: PlayerPatch;
  private previous: Player | undefined;

  constructor(playerId: string, patch: PlayerPatch) {
    this.playerId = playerId;
    this.patch = { ...patch };
  }

  apply(model: IPlayModel): void {
    const current = model.findPlayer(this.playerId);
    if (current === undefined) {
      throw new Error(`UpdatePlayerCommand: unknown player id "${this.playerId}"`);
    }
    this.previous = model.updatePlayer(applyPlayerPatch(current, this.patch));
  }

  undo(model: IPlayModel): void {
    model.updatePlayer(requireApplied(this.previous, "UpdatePlayerCommand"));
  }
}
