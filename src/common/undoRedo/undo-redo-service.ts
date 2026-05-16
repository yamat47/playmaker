// Undo/Redo を単一機構に統一する（コマンドパターンの遷移管理）。DOM 非依存。
// 適用済みコマンドのスタックを持ち、undo は逆操作、redo は再適用を Model へ走らせる。

import type { ICommand } from "../commands/command.js";
import type { IPlayModel } from "../model/play-model.js";

/**
 * Undo/Redo の遷移を司る IF。UI（M5）は canUndo/canRedo でボタン活性を決め、
 * undo/redo を呼ぶ。新規コマンド push で redo スタックは破棄される（分岐履歴は持たない）。
 */
export interface IUndoRedoService {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** 適用済みコマンドを undo スタックに積む（適用自体は CommandService が済ませている）。 */
  push(command: ICommand): void;
  undo(): void;
  redo(): void;
  clear(): void;
}

export class UndoRedoService implements IUndoRedoService {
  private readonly undoStack: ICommand[] = [];
  private readonly redoStack: ICommand[] = [];

  // Model は手動コンストラクタ注入（重い DI 機構は持たない）。
  constructor(private readonly model: IPlayModel) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(command: ICommand): void {
    this.undoStack.push(command);
    // 新たな編集が走ったら redo 履歴は無効（直線履歴）。
    this.redoStack.length = 0;
  }

  undo(): void {
    // pop が undefined＝空スタック。単一分岐で「空なら何もしない」を表現する。
    const command = this.undoStack.pop();
    if (command === undefined) {
      return;
    }
    command.undo(this.model);
    this.redoStack.push(command);
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (command === undefined) {
      return;
    }
    command.apply(this.model);
    this.undoStack.push(command);
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
