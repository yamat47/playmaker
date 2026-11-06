/** Edits invoked by keyboard input. */
export type KeyAction =
  | "step-back"
  | "commit-line"
  | "delete-selection"
  | "type-label"
  | "undo"
  | "redo";

/** The values of a KeyboardEvent that are read to resolve the binding. */
export interface KeyStroke {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

/**
 * Returns the edit bound to the key. Null for a key with no binding.
 * Cmd on Mac and Ctrl on other operating systems are treated as the same modifier.
 * With Shift held, key arrives in uppercase, so uppercase z and y count as the same keys.
 * Both Delete and Backspace delete, because a Mac keyboard labels Backspace as delete.
 * Any other character typed without Cmd or Ctrl starts typing a label, as typing does on a
 * selected shape in most drawing tools. Space is left out: on a focused button it presses it.
 * Windows reports AltGr as Ctrl and Alt together, and AltGr types characters such as @ or Ł, so
 * Ctrl with Alt is not taken as the modifier.
 */
export function resolveKeyAction(stroke: KeyStroke): KeyAction | null {
  const mod = stroke.metaKey || (stroke.ctrlKey && !stroke.altKey);
  const key = stroke.key.toLowerCase();
  if (stroke.key === "Escape") {
    return "step-back";
  }
  if (stroke.key === "Enter") {
    return "commit-line";
  }
  if (stroke.key === "Delete" || stroke.key === "Backspace") {
    return "delete-selection";
  }
  if (mod && key === "z") {
    return stroke.shiftKey ? "redo" : "undo";
  }
  if (mod && key === "y") {
    return "redo";
  }
  if (!mod && stroke.key.length === 1 && stroke.key !== " ") {
    return "type-label";
  }
  return null;
}
