import type { ICommand } from "./command.js";

/**
 * 適用済みコマンドの履歴。Model を持たず、コマンドを実行するのは呼び出し側の役目。
 * 履歴は分岐させない。新しいコマンドを積むと redo の履歴は捨てる。
 */
export interface IUndoRedoService {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** 実行を済ませたコマンドを積む。 */
  push(command: ICommand): void;
  /**
   * 最後に積んだコマンドを revert に渡し、revert が戻ったら redo の側へ移す。
   * revert が throw したら履歴は動かさない。戻す対象が無ければ何もしない。
   */
  undo(revert: (command: ICommand) => void): void;
  /** undo の逆向き。reapply が throw したら履歴は動かさない。 */
  redo(reapply: (command: ICommand) => void): void;
}

export class UndoRedoService implements IUndoRedoService {
  private readonly undoStack: ICommand[] = [];
  private readonly redoStack: ICommand[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(command: ICommand): void {
    this.undoStack.push(command);
    this.redoStack.length = 0;
  }

  undo(revert: (command: ICommand) => void): void {
    this.move(this.undoStack, this.redoStack, revert);
  }

  redo(reapply: (command: ICommand) => void): void {
    this.move(this.redoStack, this.undoStack, reapply);
  }

  // 実行が成功してから積み替える。先に取り出すと、実行が throw したときにコマンドが履歴から消える。
  private move(from: ICommand[], to: ICommand[], run: (command: ICommand) => void): void {
    const command = from.at(-1);
    if (command === undefined) {
      return;
    }
    run(command);
    from.pop();
    to.push(command);
  }
}
