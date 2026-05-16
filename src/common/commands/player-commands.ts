// 選手の編集操作（PRD 5.4: 追加 / 移動 / 削除 / プロパティ編集）。DOM 非依存。
// 各コマンドは apply 時に逆操作用の状態を自分で捕捉する（redo でも再捕捉され整合する）。

import type { IPlayModel, PlayerRemoval } from "../model/play-model.js";
import type { FieldPosition, Player, PlayerShape } from "../model/player.js";
import { clonePlayer } from "../model/player.js";
import type { ICommand } from "./command.js";

/** プロパティ編集で差し替え可能な項目（ラベル・形状・色）。指定キーのみ上書きする。 */
export interface PlayerPatch {
  label?: string;
  shape?: PlayerShape;
  color?: string;
}

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
  private removal: PlayerRemoval | undefined;

  constructor(private readonly playerId: string) {}

  apply(model: IPlayModel): void {
    this.removal = model.removePlayer(this.playerId);
  }

  undo(model: IPlayModel): void {
    if (this.removal === undefined) {
      throw new Error("RemovePlayerCommand.undo: apply 未実行");
    }
    model.restorePlayer(this.removal);
  }
}

/** 選手を移動する（位置のみ変更）。undo は移動前の選手へ差し戻す。 */
export class MovePlayerCommand implements ICommand {
  readonly label = "選手の移動";
  private readonly to: FieldPosition;
  private previous: Player | undefined;

  constructor(
    private readonly playerId: string,
    to: FieldPosition,
  ) {
    this.to = { ...to };
  }

  apply(model: IPlayModel): void {
    const current = model.findPlayer(this.playerId);
    if (current === undefined) {
      throw new Error(`MovePlayerCommand: unknown player id "${this.playerId}"`);
    }
    this.previous = model.updatePlayer({ ...current, position: { ...this.to } });
  }

  undo(model: IPlayModel): void {
    if (this.previous === undefined) {
      throw new Error("MovePlayerCommand.undo: apply 未実行");
    }
    model.updatePlayer(this.previous);
  }
}

/** 選手のプロパティ（ラベル・形状・色）を編集する。undo は編集前へ差し戻す。 */
export class UpdatePlayerCommand implements ICommand {
  readonly label = "選手プロパティの編集";
  private readonly patch: PlayerPatch;
  private previous: Player | undefined;

  constructor(
    private readonly playerId: string,
    patch: PlayerPatch,
  ) {
    this.patch = { ...patch };
  }

  apply(model: IPlayModel): void {
    const current = model.findPlayer(this.playerId);
    if (current === undefined) {
      throw new Error(`UpdatePlayerCommand: unknown player id "${this.playerId}"`);
    }
    const next = clonePlayer(current);
    // 指定キーのみ上書き（未指定は現状維持）。色のクリアは M5/後続で扱う。
    if (this.patch.label !== undefined) {
      next.label = this.patch.label;
    }
    if (this.patch.shape !== undefined) {
      next.shape = this.patch.shape;
    }
    if (this.patch.color !== undefined) {
      next.color = this.patch.color;
    }
    this.previous = model.updatePlayer(next);
  }

  undo(model: IPlayModel): void {
    if (this.previous === undefined) {
      throw new Error("UpdatePlayerCommand.undo: apply 未実行");
    }
    model.updatePlayer(this.previous);
  }
}
