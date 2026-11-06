import { describe, expect, it } from "vitest";
import { type KeyStroke, resolveKeyAction } from "./keymap.js";

function stroke(key: string, modifiers: Partial<Omit<KeyStroke, "key">> = {}): KeyStroke {
  return { key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

describe("resolveKeyAction", () => {
  it("Escape steps back", () => {
    expect(resolveKeyAction(stroke("Escape"))).toBe("step-back");
  });

  it("Enter commits the line being drawn", () => {
    expect(resolveKeyAction(stroke("Enter"))).toBe("commit-line");
  });

  it("Delete and Backspace delete the selection", () => {
    expect(resolveKeyAction(stroke("Delete"))).toBe("delete-selection");
    expect(resolveKeyAction(stroke("Backspace"))).toBe("delete-selection");
  });

  it("Cmd+Z and Ctrl+Z undo", () => {
    expect(resolveKeyAction(stroke("z", { metaKey: true }))).toBe("undo");
    expect(resolveKeyAction(stroke("z", { ctrlKey: true }))).toBe("undo");
  });

  it("Cmd+Z with Shift redoes even when the key arrives as uppercase Z", () => {
    expect(resolveKeyAction(stroke("Z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(resolveKeyAction(stroke("z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
  });

  it("Cmd+Y and Ctrl+Y redo in either letter case", () => {
    expect(resolveKeyAction(stroke("y", { metaKey: true }))).toBe("redo");
    expect(resolveKeyAction(stroke("Y", { ctrlKey: true }))).toBe("redo");
  });

  it("a character typed without Cmd or Ctrl starts typing a label", () => {
    expect(resolveKeyAction(stroke("q"))).toBe("type-label");
    expect(resolveKeyAction(stroke("Q", { shiftKey: true }))).toBe("type-label");
    expect(resolveKeyAction(stroke("1"))).toBe("type-label");
  });

  it("a character typed with AltGr, which Windows reports as Ctrl and Alt, starts typing a label", () => {
    expect(resolveKeyAction(stroke("Ł", { ctrlKey: true, altKey: true }))).toBe("type-label");
  });

  it("Space and named keys such as arrows are not bound", () => {
    expect(resolveKeyAction(stroke(" "))).toBeNull();
    expect(resolveKeyAction(stroke("ArrowLeft"))).toBeNull();
  });

  it("a character with Cmd or Ctrl other than z and y is not bound", () => {
    expect(resolveKeyAction(stroke("s", { metaKey: true }))).toBeNull();
    expect(resolveKeyAction(stroke("a", { ctrlKey: true }))).toBeNull();
  });
});
