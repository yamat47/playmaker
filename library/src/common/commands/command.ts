import type { IPlayModel } from "../model/play-model.js";

/**
 * 編集操作 1 つ。redo は apply をもう一度呼んで表す。
 * 取り消しに要る直前の状態は、apply のたびに各コマンドが自分で控える。
 */
export interface ICommand {
  /** 履歴の表示に使う日本語のラベル。 */
  readonly label: string;
  /**
   * Model を変えたら true を返す。何も変えないときは Model に触れずに false を返し、
   * 履歴に空の段を積ませない。
   */
  apply(model: IPlayModel): boolean;
  undo(model: IPlayModel): void;
}

/** apply で控えた値を undo で取り出す。apply より前に undo されたら throw する。 */
export function requireApplied<T>(value: T | undefined, command: ICommand): T {
  /* v8 ignore start -- 履歴は apply が済んだコマンドしか積まないので、編集の操作からは届かない。 */
  if (value === undefined) {
    throw new Error(`${command.label}: apply より前に undo された`);
  }
  /* v8 ignore stop */
  return value;
}
