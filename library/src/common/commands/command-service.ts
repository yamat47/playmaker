import type { Event } from "../event/emitter.js";
import type { IPlayModel } from "../model/play-model.js";
import type { ICommand } from "./command.js";
import type { IUndoRedoService } from "./undo-redo-service.js";

/**
 * 編集を実行する唯一の経路。コマンドの適用、取り消し、やり直しをすべてここで行い、
 * 履歴を Model と食い違わせない。
 */
export interface ICommandService {
  /** 履歴が変わるたびに 1 回発火する。Model の変更通知より後に来る。 */
  readonly onDidChangeHistory: Event<void>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** 適用が throw したら、コマンドは履歴に積まない。 */
  execute(command: ICommand): void;
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

  get onDidChangeHistory(): Event<void> {
    return this.history.onDidChange;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  execute(command: ICommand): void {
    command.apply(this.model);
    this.history.push(command);
  }

  undo(): void {
    this.history.undo((command) => command.undo(this.model));
  }

  redo(): void {
    this.history.redo((command) => command.apply(this.model));
  }
}
