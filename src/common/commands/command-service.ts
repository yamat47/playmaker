// 編集操作の単一入口（コマンドパターンの実行係）。DOM 非依存。
// コマンドを Model へ適用し、Undo 履歴へ積む。これだけが「編集を実行する」経路。

import type { IPlayModel } from "../model/play-model.js";
import type { IUndoRedoService } from "../undoRedo/undo-redo-service.js";
import type { ICommand } from "./command.js";

/**
 * 編集はすべてこの IF を通す。UI の input ハンドラはコマンドを組み立て execute するだけ。
 * 適用と履歴登録を 1 か所に束ね、Model 直接書き換えを禁じる（Model–View 分離の徹底）。
 */
export interface ICommandService {
  execute(command: ICommand): void;
}

export class CommandService implements ICommandService {
  // Model / UndoRedo は手動コンストラクタ注入（重い DI 機構は持たない）。
  constructor(
    private readonly model: IPlayModel,
    private readonly undoRedo: IUndoRedoService,
  ) {}

  execute(command: ICommand): void {
    command.apply(this.model);
    this.undoRedo.push(command);
  }
}
