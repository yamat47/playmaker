import type { IPlayModel } from "../model/play-model.js";

/**
 * A single editing operation. Redo is expressed by calling apply again.
 * Each command records by itself, on every apply, the prior state that undo needs.
 */
export interface ICommand {
  /** Short English name of the command, such as "Add line"; it appears in error messages. */
  readonly label: string;
  /**
   * Returns true when it changed the Model. When nothing changes, returns false without touching
   * the Model, so that no empty entry is pushed onto the history.
   */
  apply(model: IPlayModel): boolean;
  undo(model: IPlayModel): void;
}

/** Retrieves a value recorded by apply for use in undo. Throws if undo runs before apply. */
export function requireApplied<T>(value: T | undefined, command: ICommand): T {
  /* v8 ignore start -- Only applied commands enter the history, so edits never get here. */
  if (value === undefined) {
    throw new Error(`${command.label}: undone before apply`);
  }
  /* v8 ignore stop */
  return value;
}
