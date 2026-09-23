import { describe, expect, it } from "vitest";
import { type KeyStroke, resolveKeyAction } from "./keymap.js";

function stroke(key: string, modifiers: Partial<Omit<KeyStroke, "key">> = {}): KeyStroke {
  return { key, metaKey: false, ctrlKey: false, shiftKey: false, ...modifiers };
}

describe("resolveKeyAction", () => {
  it("Escape は作図やドラッグの取り消しになる", () => {
    expect(resolveKeyAction(stroke("Escape"))).toBe("cancel-interaction");
  });

  it("Enter は作図中の線の確定になる", () => {
    expect(resolveKeyAction(stroke("Enter"))).toBe("commit-line");
  });

  it("Cmd+Z と Ctrl+Z は元に戻す", () => {
    expect(resolveKeyAction(stroke("z", { metaKey: true }))).toBe("undo");
    expect(resolveKeyAction(stroke("z", { ctrlKey: true }))).toBe("undo");
  });

  it("Shift を足した Cmd+Z は、大文字の Z で届いてもやり直す", () => {
    expect(resolveKeyAction(stroke("Z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(resolveKeyAction(stroke("z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
  });

  it("Cmd+Y と Ctrl+Y は、大文字でも小文字でもやり直す", () => {
    expect(resolveKeyAction(stroke("y", { metaKey: true }))).toBe("redo");
    expect(resolveKeyAction(stroke("Y", { ctrlKey: true }))).toBe("redo");
  });

  it("修飾キーのない z と y には何も割り当てない", () => {
    expect(resolveKeyAction(stroke("z"))).toBeNull();
    expect(resolveKeyAction(stroke("Y", { shiftKey: true }))).toBeNull();
  });

  it("割り当てのないキーは、修飾キーがあっても null になる", () => {
    expect(resolveKeyAction(stroke("a"))).toBeNull();
    expect(resolveKeyAction(stroke("s", { metaKey: true }))).toBeNull();
  });
});
