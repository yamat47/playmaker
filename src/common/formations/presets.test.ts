import { describe, expect, it } from "vitest";
import { isPlayerShape } from "../model/player.js";
import { isFormationSide, normalizeFormation } from "./formation.js";
import { FORMATION_PRESETS, getFormationPreset } from "./presets.js";

describe("FORMATION_PRESETS データ健全性", () => {
  it("攻 2・守 2 の 4 プリセットで id は一意", () => {
    expect(FORMATION_PRESETS).toHaveLength(4);
    const ids = FORMATION_PRESETS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FORMATION_PRESETS.filter((f) => f.side === "offense")).toHaveLength(2);
    expect(FORMATION_PRESETS.filter((f) => f.side === "defense")).toHaveLength(2);
  });

  it("各プリセットは 11 人・side/shape/位置が妥当・攻守で色付けが分かれる", () => {
    for (const formation of FORMATION_PRESETS) {
      expect(isFormationSide(formation.side)).toBe(true);
      expect(formation.name.trim()).not.toBe("");
      expect(formation.players).toHaveLength(11);
      for (const p of formation.players) {
        expect(isPlayerShape(p.shape)).toBe(true);
        expect(Number.isFinite(p.position.lateralYard)).toBe(true);
        expect(Number.isFinite(p.position.absoluteYard)).toBe(true);
        // 守は赤で塗り、攻は色なし（テーマ既定）。
        if (formation.side === "defense") {
          expect(p.color).toBe("#b23a30");
        } else {
          expect(p.color).toBeUndefined();
        }
      }
    }
  });

  it("各プリセットは公開境界の normalizeFormation を通過し選手数を保つ", () => {
    for (const formation of FORMATION_PRESETS) {
      const normalized = normalizeFormation(formation);
      expect(normalized).not.toBeNull();
      expect(normalized?.players).toHaveLength(formation.players.length);
    }
  });
});

describe("getFormationPreset", () => {
  it("既知 id は該当プリセット、未知 id は undefined", () => {
    expect(getFormationPreset("i-formation")?.name).toBe("I フォーメーション");
    expect(getFormationPreset("defense-nickel")?.side).toBe("defense");
    expect(getFormationPreset("does-not-exist")).toBeUndefined();
  });
});
