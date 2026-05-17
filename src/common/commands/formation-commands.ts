// フォーメーション読み込みの編集操作（PRD 5.4「フォーメーションテンプレートの読み込み」/ 5.6）。
// DOM 非依存。M4 契約に従い 1 コマンド = onChange 1 回（Model のバッチ API で原子発火）。

import type { IPlayModel } from "../model/play-model.js";
import { clonePlayer, type Player } from "../model/player.js";
import type { ICommand } from "./command.js";

/**
 * 採番済みの選手群をまとめて現在のプレー図へ追加する（隊形の自動配置）。
 * 既存の選手・線は保持し追記する＝攻守プリセットを順に重ねられる（PRD 5.6 の語に沿う）。
 *
 * undo は追加した id 群の一括削除。これらは新規 id で従属線を持たない（線は別コマンド＝
 * 直線履歴の LIFO で先に巻き戻る）ため、カスケードのメメントは AddPlayerCommand と同様に捨てる。
 * redo = apply 再実行で同じ選手（同 id）を再追加する。
 */
export class LoadFormationCommand implements ICommand {
  readonly label = "フォーメーションの読み込み";
  private readonly players: Player[];

  constructor(players: readonly Player[]) {
    // 構築後に呼び出し側が元配列・要素を変えても redo が揺れないよう複製して保持する。
    this.players = players.map(clonePlayer);
  }

  apply(model: IPlayModel): void {
    model.addPlayers(this.players);
  }

  undo(model: IPlayModel): void {
    model.removePlayers(this.players.map((p) => p.id));
  }
}
