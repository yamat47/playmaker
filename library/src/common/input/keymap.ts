/** Edits invoked by keyboard input. */
export type KeyAction = "step-back" | "commit-line" | "delete-selection" | "undo" | "redo";

/** The values of a KeyboardEvent that are read to resolve the binding. */
export interface KeyStroke {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
}

/**
 * Returns the edit bound to the key. Null for a key with no binding.
 * Cmd on Mac and Ctrl on other operating systems are treated as the same modifier.
 * With Shift held, key arrives in uppercase, so uppercase z and y count as the same keys.
 * Both Delete and Backspace delete, because a Mac keyboard labels Backspace as delete.
 */
export function resolveKeyAction(stroke: KeyStroke): KeyAction | null {
  const mod = stroke.metaKey || stroke.ctrlKey;
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
  return null;
}
