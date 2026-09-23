import type { Event } from "../event/emitter.js";
import type { IPlayModel } from "../model/play-model.js";
import type { ICommand } from "./command.js";
import type { IUndoRedoService } from "./undo-redo-service.js";

/**
 * 編集を実行する唯一の窓口。実行、戻す、やり直すのどれも、コマンドを Model へ
 * 当ててから履歴を動かす。コマンドが throw したときは履歴を動かさないので、
 * 履歴と Model の状態が食い違わない。
 */
export interface ICommandService {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** 履歴が変わるたびに発火する。 */
  readonly onDidChangeHistory: Event<void>;
  execute(command: ICommand): void;
  /** 戻す履歴がなければ何もしない。 */
  undo(): void;
  /** やり直す履歴がなければ何もしない。 */
  redo(): void;
}

export class CommandService implements ICommandService {
  private readonly model: IPlayModel;
  private readonly history: IUndoRedoService;
  readonly onDidChangeHistory: Event<void>;

  constructor(model: IPlayModel, history: IUndoRedoService) {
    this.model = model;
    this.history = history;
    this.onDidChangeHistory = history.onDidChange;
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
    const command = this.history.peekUndo();
    if (command === undefined) {
      return;
    }
    command.undo(this.model);
    this.history.markUndone();
  }

  redo(): void {
    const command = this.history.peekRedo();
    if (command === undefined) {
      return;
    }
    command.apply(this.model);
    this.history.markRedone();
  }
}
