import type { IPlayModel } from "../model/play-model.js";
import type { ICommand } from "./command.js";
import type { IUndoRedoService } from "./undo-redo-service.js";

/**
 * 編集はすべてここを通す。コマンドの適用、取り消し、やり直しを 1 か所で行い、
 * 履歴と Model を食い違わせない。
 */
export interface ICommandService {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /**
   * コマンドを適用し、Model を変えたら履歴に積んで true を返す。何も変えなかったときは
   * 積まずに false を返す。適用が throw したときも積まない。
   */
  execute(command: ICommand): boolean;
  /** 取り消しが throw したら、履歴は動かさない。戻す対象が無ければ何もしない。 */
  undo(): void;
  /** やり直しが throw したら、履歴は動かさない。やり直す対象が無ければ何もしない。 */
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
