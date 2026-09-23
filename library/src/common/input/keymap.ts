/** キー操作で呼ぶ編集。 */
export type KeyAction = "cancel-interaction" | "commit-line" | "undo" | "redo";

/** KeyboardEvent のうち、割り当てを決めるのに読む値。 */
export interface KeyStroke {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
}

/**
 * キーに割り当てた編集を返す。割り当てのないキーは null。
 * Mac の Cmd と、ほかの OS の Ctrl を同じ修飾キーとして扱う。
 * Shift を押すと key が大文字で届くので、z と y は大文字も同じキーとみなす。
 */
export function resolveKeyAction(stroke: KeyStroke): KeyAction | null {
  const mod = stroke.metaKey || stroke.ctrlKey;
  if (stroke.key === "Escape") {
    return "cancel-interaction";
  }
  if (stroke.key === "Enter") {
    return "commit-line";
  }
  if (mod && (stroke.key === "z" || stroke.key === "Z")) {
    return stroke.shiftKey ? "redo" : "undo";
  }
  if (mod && (stroke.key === "y" || stroke.key === "Y")) {
    return "redo";
  }
  return null;
}
