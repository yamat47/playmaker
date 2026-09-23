import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { resolvePlayData } from "../model/play-data.js";
import { DEFENSE_COLOR } from "../presets/shared.js";
import { getPlayPreset, PLAY_PRESETS } from "./presets.js";

describe("PLAY_PRESETS", () => {
  it("id はすべて異なる", () => {
    const ids = PLAY_PRESETS.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("攻守どちらのプリセットもある", () => {
    expect(PLAY_PRESETS.some((p) => p.side === "offense")).toBe(true);
    expect(PLAY_PRESETS.some((p) => p.side === "defense")).toBe(true);
  });

  it.each(PLAY_PRESETS)("$id は名前、パーソネル、説明を持つ", (preset) => {
    expect(preset.name.trim()).not.toBe("");
    expect(preset.personnel.trim()).not.toBe("");
    expect(preset.summary.trim()).not.toBe("");
  });

  it.each(PLAY_PRESETS)("$id は middle ゾーンに攻守 22 人を並べる", (preset) => {
    expect(preset.data.field.zone).toBe("middle");
    expect(preset.data.players).toHaveLength(22);
  });

  it.each(PLAY_PRESETS)("$id は外部データとして正規化しても変わらない", (preset) => {
    expect(resolvePlayData(preset.data)).toEqual(preset.data);
  });

  it.each(PLAY_PRESETS)("$id は選手と線に DEFENSE_COLOR 以外の色を付けない", (preset) => {
    const colors = [...preset.data.players, ...preset.data.lines].map((item) => item.color);

    expect(colors.filter((color) => color !== DEFENSE_COLOR && color !== undefined)).toEqual([]);
  });

  it.each(PLAY_PRESETS)("$id の選手と線の点は、どれも窓に収まる", (preset) => {
    const { field, players, lines } = preset.data;
    const points = [
      ...players.map((p) => p.position),
      ...lines.flatMap((l) => [...l.waypoints, l.end]),
    ];

    expect(points.map((point) => clampToZoneWindow(point, field))).toEqual(points);
  });

  it("入れ子の値まで凍結されていて、利用者が書き換えられない", () => {
    const preset = must(PLAY_PRESETS[0]);

    expect(Object.isFrozen(preset)).toBe(true);
    expect(Object.isFrozen(preset.data.players)).toBe(true);
    expect(Object.isFrozen(must(preset.data.players[0]).position)).toBe(true);
  });
});

describe("getPlayPreset", () => {
  it("既知の id を渡すと、そのプリセットを返す", () => {
    expect(getPlayPreset("play-inside-zone")?.name).toBe("Inside Zone");
  });

  it("無い id を渡すと undefined を返す", () => {
    expect(getPlayPreset("does-not-exist")).toBeUndefined();
  });
});
