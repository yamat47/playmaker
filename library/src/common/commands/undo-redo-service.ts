import { Emitter, type Event } from "../event/emitter.js";
import { Disposable } from "../lifecycle/disposable.js";
import type { ICommand } from "./command.js";

/**
 * 適用済みのコマンドを積む履歴。コマンドを実行するのは ICommandService で、ここは
 * どのコマンドを次に戻すか、やり直すかだけを持つ。新しいコマンドを積むと
 * やり直しの履歴は捨てる（分岐した履歴は持たない）。
 */
export interface IUndoRedoService {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** 積む、戻す、やり直すのいずれかで履歴が変わるたびに発火する。 */
  readonly onDidChange: Event<void>;
  peekUndo(): ICommand | undefined;
  peekRedo(): ICommand | undefined;
  push(command: ICommand): void;
  /** 戻す側の先頭をやり直す側へ移す。空なら何もしない。 */
  markUndone(): void;
  /** やり直す側の先頭を戻す側へ移す。空なら何もしない。 */
  markRedone(): void;
}

export class UndoRedoService extends Disposable implements IUndoRedoService {
  private readonly _onDidChange = this._register(new Emitter<void>());
  readonly onDidChange = this._onDidChange.event;
  private readonly undoStack: ICommand[] = [];
  private readonly redoStack: ICommand[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  peekUndo(): ICommand | undefined {
    return this.undoStack.at(-1);
  }

  peekRedo(): ICommand | undefined {
    return this.redoStack.at(-1);
  }

  push(command: ICommand): void {
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this._onDidChange.fire();
  }

  markUndone(): void {
    this.move(this.undoStack, this.redoStack);
  }

  markRedone(): void {
    this.move(this.redoStack, this.undoStack);
  }

  private move(from: ICommand[], to: ICommand[]): void {
    const command = from.pop();
    if (command === undefined) {
      return;
    }
    to.push(command);
    this._onDidChange.fire();
  }
}
