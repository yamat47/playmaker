import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { FIELD_ZONE_VALUES, fieldStateForZone } from "../model/play-data.js";
import { DEFENSE_COLOR } from "../presets/shared.js";
import { normalizeFormation } from "./formation.js";
import { FORMATION_PRESETS, getFormationPreset } from "./presets.js";

const OFFENSE_PRESETS = FORMATION_PRESETS.filter((f) => f.side === "offense");
const DEFENSE_PRESETS = FORMATION_PRESETS.filter((f) => f.side === "defense");

describe("FORMATION_PRESETS", () => {
  it("id はすべて異なる", () => {
    const ids = FORMATION_PRESETS.map((f) => f.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("攻守どちらのプリセットもある", () => {
    expect(OFFENSE_PRESETS).not.toHaveLength(0);
    expect(DEFENSE_PRESETS).not.toHaveLength(0);
  });

  it.each(FORMATION_PRESETS)("$id は名前を持ち、11 人を並べる", (formation) => {
    expect(formation.name.trim()).not.toBe("");
    expect(formation.players).toHaveLength(11);
  });

  it.each(FORMATION_PRESETS)("$id は外部データとして正規化しても変わらない", (formation) => {
    expect(normalizeFormation(formation)).toEqual(formation);
  });

  it.each(OFFENSE_PRESETS)("オフェンスの $id は選手に色を付けない", (formation) => {
    expect(formation.players.map((p) => p.color)).toEqual(formation.players.map(() => undefined));
  });

  it.each(DEFENSE_PRESETS)("ディフェンスの $id は選手を DEFENSE_COLOR で塗る", (formation) => {
    expect(formation.players.map((p) => p.color)).toEqual(
      formation.players.map(() => DEFENSE_COLOR),
    );
  });

  it.each(FIELD_ZONE_VALUES)(
    "%s ゾーンで読み込んでも、どのプリセットの選手も窓に収まる",
    (zone) => {
      const field = fieldStateForZone(zone);
      const positions = FORMATION_PRESETS.flatMap((f) => f.players.map((p) => p.position));

      expect(positions.map((position) => clampToZoneWindow(position, field))).toEqual(positions);
    },
  );

  it("入れ子の値まで凍結されていて、利用者が書き換えられない", () => {
    const preset = must(FORMATION_PRESETS[0]);

    expect(Object.isFrozen(preset)).toBe(true);
    expect(Object.isFrozen(preset.players)).toBe(true);
    expect(Object.isFrozen(must(preset.players[0]).position)).toBe(true);
  });
});

describe("getFormationPreset", () => {
  it("既知の id を渡すと、そのプリセットを返す", () => {
    expect(getFormationPreset("i-formation")?.name).toBe("I-Formation");
  });

  it("無い id を渡すと undefined を返す", () => {
    expect(getFormationPreset("does-not-exist")).toBeUndefined();
  });
});
