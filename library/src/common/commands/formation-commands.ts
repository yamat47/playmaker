import type { IPlayModel } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import type { ICommand } from "./command.js";

/**
 * 採番済みの選手をまとめて追加する。既にある選手と線は残すので、攻撃と守備の隊形を順に重ねられる。
 * Model への変更は 1 回にまとめ、通知も 1 回だけにする。
 */
export class LoadFormationCommand implements ICommand {
  readonly label = "フォーメーションの読み込み";
  private readonly players: readonly Player[];

  constructor(players: readonly Player[]) {
    this.players = players;
  }

  apply(model: IPlayModel): void {
    model.addPlayers(this.players);
  }

  undo(model: IPlayModel): void {
    // 追加した選手を起点にした線は、それより後のコマンドなので先に取り消されている。
    model.removePlayers(this.players.map((p) => p.id));
  }
}
