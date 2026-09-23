import { describe, expect, it } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import { applyLinePatch, applyPlayerPatch, patchChangesAnything } from "./patch.js";

describe("applyLinePatch", () => {
  it("指定したキーだけを差し替え、ほかのキーは元の値を保つ", () => {
    const current = { ...line("l1"), color: "#abc", thickness: 2 };

    const next = applyLinePatch(current, { kind: "block", thickness: 3 });

    expect(next).toEqual({ ...current, kind: "block", thickness: 3 });
  });

  it("色と太さに null を渡すとキーごと消える", () => {
    const current = { ...line("l1"), color: "#abc", thickness: 2 };

    const next = applyLinePatch(current, { color: null, thickness: null });

    expect(next).toEqual(line("l1"));
    expect("color" in next).toBe(false);
    expect("thickness" in next).toBe(false);
  });

  it("元の線は書き換えない", () => {
    const current = line("l1");

    applyLinePatch(current, { color: "#abc" });

    expect(current).toEqual(line("l1"));
  });
});

describe("applyPlayerPatch", () => {
  it("指定したキーだけを差し替え、ほかのキーは元の値を保つ", () => {
    const current = { ...player("a"), color: "#0f0" };

    const next = applyPlayerPatch(current, { label: "QB" });

    expect(next).toEqual({ ...current, label: "QB" });
  });

  it("色に null を渡すとキーごと消える", () => {
    const next = applyPlayerPatch({ ...player("a"), color: "#0f0" }, { color: null });

    expect(next).toEqual(player("a"));
    expect("color" in next).toBe(false);
  });
});

describe("patchChangesAnything", () => {
  it("今と違う値を 1 つでも含むパッチは変化ありとみなす", () => {
    expect(patchChangesAnything(player("a"), { label: "a", shape: "square" })).toBe(true);
  });

  it("今と同じ値だけのパッチと空のパッチは変化なしとみなす", () => {
    expect(patchChangesAnything(player("a"), { label: "a" })).toBe(false);
    expect(patchChangesAnything(player("a"), {})).toBe(false);
  });

  it("未設定の色を null で消すパッチは変化なし、設定済みの色を消すパッチは変化ありとみなす", () => {
    expect(patchChangesAnything(player("a"), { color: null })).toBe(false);
    expect(patchChangesAnything({ ...player("a"), color: "#0f0" }, { color: null })).toBe(true);
  });

  it("位置は中身が同じでも別の参照なら変化ありとみなす", () => {
    const current = player("a");

    expect(patchChangesAnything(current, { position: { ...current.position } })).toBe(true);
    expect(patchChangesAnything(current, { position: current.position })).toBe(false);
  });
});
