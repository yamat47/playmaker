import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { FIELD_ZONE_VALUES, fieldStateForZone } from "../model/play-data.js";
import { isPlayerShape } from "../model/player.js";
import { isTeamSide } from "../presets/shared.js";
import { normalizeFormation } from "./formation.js";
import { FORMATION_PRESETS, getFormationPreset } from "./presets.js";

describe("FORMATION_PRESETS データ健全性", () => {
  it("攻 7・守 6 の 13 プリセットで id は一意", () => {
    expect(FORMATION_PRESETS).toHaveLength(13);
    const ids = FORMATION_PRESETS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FORMATION_PRESETS.filter((f) => f.side === "offense")).toHaveLength(7);
    expect(FORMATION_PRESETS.filter((f) => f.side === "defense")).toHaveLength(6);
  });

  it("各プリセットは 11 人・side/shape/位置が妥当・攻守で色付けが分かれる", () => {
    for (const formation of FORMATION_PRESETS) {
      expect(isTeamSide(formation.side)).toBe(true);
      expect(formation.name.trim()).not.toBe("");
      expect(formation.players).toHaveLength(11);
      for (const p of formation.players) {
        expect(isPlayerShape(p.shape)).toBe(true);
        expect(Number.isFinite(p.position.lateralYard)).toBe(true);
        expect(Number.isFinite(p.position.downfieldYard)).toBe(true);
        // 守は赤で塗り、攻は色なし（テーマ既定）。
        if (formation.side === "defense") {
          expect(p.color).toBe("#8f4034");
        } else {
          expect(p.color).toBeUndefined();
        }
      }
    }
  });

  it.each(FIELD_ZONE_VALUES)("%s ゾーンでもプリセットの選手が窓に収まる", (zone) => {
    const field = fieldStateForZone(zone);

    for (const formation of FORMATION_PRESETS) {
      for (const p of formation.players) {
        expect(clampToZoneWindow(p.position, field)).toEqual(p.position);
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
    expect(getFormationPreset("i-formation")?.name).toBe("I-Formation");
    expect(getFormationPreset("defense-nickel")?.side).toBe("defense");
    expect(getFormationPreset("does-not-exist")).toBeUndefined();
  });
});

describe("FORMATION_PRESETS の共有", () => {
  it("入れ子の値まで凍結されていて、利用者が書き換えられない", () => {
    const preset = must(FORMATION_PRESETS[0]);

    expect(Object.isFrozen(preset)).toBe(true);
    expect(Object.isFrozen(preset.players)).toBe(true);
    expect(Object.isFrozen(must(preset.players[0]).position)).toBe(true);
  });
});
