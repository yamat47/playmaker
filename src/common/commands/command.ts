// すべての編集操作を表す最小 IF（コマンドパターン）。DOM 非依存。
// apply で適用、undo で逆操作。redo は apply の再実行で表現する。
// 逆操作に必要な直前状態は apply 実行時に各コマンドが自分で捕捉する（redo でも再捕捉され整合）。

import type { IPlayModel } from "../model/play-model.js";

export interface ICommand {
  /** デバッグ・将来の履歴 UI 用のラベル（日本語）。 */
  readonly label: string;
  apply(model: IPlayModel): void;
  undo(model: IPlayModel): void;
}
