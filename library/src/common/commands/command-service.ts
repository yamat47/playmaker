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
  /** If undo throws, the history stays as is. Does nothing when there is nothing to undo. */
  undo(): void;
  /** If redo throws, the history stays as is. Does nothing when there is nothing to redo. */
  redo(): void;
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

  undo(): void {
    this.history.undo((command) => command.undo(this.model));
  }

  redo(): void {
    this.history.redo((command) => command.apply(this.model));
  }
}
