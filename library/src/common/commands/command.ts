import type { IPlayModel } from "../model/play-model.js";

/**
 * 編集操作 1 つ。redo は apply をもう一度呼んで表す。
 * 取り消しに要る直前の状態は、apply のたびに各コマンドが自分で控える。
 */
export interface ICommand {
  /** 履歴の表示に使う日本語のラベル。 */
  readonly label: string;
  apply(model: IPlayModel): void;
  undo(model: IPlayModel): void;
}

/** apply で控えた値を undo で取り出す。apply より前に undo されたら throw する。 */
export function requireApplied<T>(value: T | undefined, command: ICommand): T {
  if (value === undefined) {
    throw new Error(`${command.label}: apply より前に undo された`);
  }
  return value;
}
