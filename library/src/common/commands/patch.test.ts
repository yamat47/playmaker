import { describe, expect, it } from "vitest";
import { line } from "../../test-support/fixtures.js";
import type { Line } from "../model/line.js";
import { patchChangesAnything } from "./patch.js";

describe("patchChangesAnything", () => {
  it("今と違う値を指定したキーが 1 つでもあれば true", () => {
    expect(patchChangesAnything(line("l1"), { kind: "route", interpolation: "bezier" })).toBe(true);
  });

  it("指定したキーがすべて今の値と同じなら false", () => {
    expect(patchChangesAnything(line("l1"), { kind: "route" })).toBe(false);
  });

  it("値のないキーに null を指定しても、既定のままなので false", () => {
    expect(patchChangesAnything(line("l1"), { color: null })).toBe(false);
  });

  it("値のあるキーに null を指定すると、既定に戻るので true", () => {
    const current: Line = { ...line("l1"), color: "#abc" };

    expect(patchChangesAnything(current, { color: null })).toBe(true);
  });
});
