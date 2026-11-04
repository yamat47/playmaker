import type { ICommand } from "./command.js";

/**
 * The history of applied commands. It holds no Model; running the commands is the caller's job.
 * The history never branches. Pushing a new command drops the redo history.
 */
export interface IUndoRedoService {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Pushes a command that has already been run. */
  push(command: ICommand): void;
  /**
   * Passes the last pushed command to revert and moves it to the redo side once revert returns.
   * If revert throws, the history stays as is. Does nothing when there is nothing to undo.
   */
  undo(revert: (command: ICommand) => void): void;
  /** The reverse of undo. If reapply throws, the history stays as is. */
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

  // Move only after the run succeeds. Popping first would lose the command if the run throws.
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
