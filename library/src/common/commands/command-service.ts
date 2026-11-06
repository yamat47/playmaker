import type { IPlayModel } from "../model/play-model.js";
import type { ICommand } from "./command.js";
import type { IUndoRedoService } from "./undo-redo-service.js";

/**
 * Every edit goes through here. Applying, undoing, and redoing commands happen in one place
 * so the history and the Model never disagree.
 */
export interface ICommandService {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /**
   * Applies the command. When it changes the Model, pushes it onto the history and returns true.
   * When nothing changed, returns false without pushing. Also does not push when apply throws.
   */
  execute(command: ICommand): boolean;
  /**
   * Undoes the last edit and returns it. If undo throws, the history stays as is. Does nothing
   * and returns undefined when there is nothing to undo.
   */
  undo(): ICommand | undefined;
  /**
   * Applies the last undone edit again and returns it. If redo throws, the history stays as is.
   * Does nothing and returns undefined when there is nothing to redo.
   */
  redo(): ICommand | undefined;
}

export class CommandService implements ICommandService {
  private readonly model: IPlayModel;
  private readonly history: IUndoRedoService;

  constructor(model: IPlayModel, history: IUndoRedoService) {
    this.model = model;
    this.history = history;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  execute(command: ICommand): boolean {
    const changed = command.apply(this.model);
    if (changed) {
      this.history.push(command);
    }
    return changed;
  }

  undo(): ICommand | undefined {
    let undone: ICommand | undefined;
    this.history.undo((command) => {
      command.undo(this.model);
      undone = command;
    });
    return undone;
  }

  redo(): ICommand | undefined {
    let redone: ICommand | undefined;
    this.history.redo((command) => {
      command.apply(this.model);
      redone = command;
    });
    return redone;
  }
}
