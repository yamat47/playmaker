import { describe, expect, it } from "vitest";
import { overlappingMarkers } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { resolvePlayData } from "../model/play-data.js";
import { getPlayPreset, PLAY_PRESETS } from "./presets.js";

describe("PLAY_PRESETS", () => {
  it("has a distinct id for every preset", () => {
    const ids = PLAY_PRESETS.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has presets for both offense and defense", () => {
    expect(PLAY_PRESETS.some((p) => p.side === "offense")).toBe(true);
    expect(PLAY_PRESETS.some((p) => p.side === "defense")).toBe(true);
  });

  it.each(PLAY_PRESETS)("$id has a name, personnel, and a summary", (preset) => {
    expect(preset.name.trim()).not.toBe("");
    expect(preset.personnel.trim()).not.toBe("");
    expect(preset.summary.trim()).not.toBe("");
  });

  it.each(PLAY_PRESETS)("$id places 22 players of both sides in the middle zone", (preset) => {
    expect(preset.data.field.zone).toBe("middle");
    expect(preset.data.players).toHaveLength(22);
  });

  it.each(PLAY_PRESETS)("$id is unchanged when normalized as external data", (preset) => {
    expect(resolvePlayData(preset.data)).toEqual(preset.data);
  });

  it.each(PLAY_PRESETS)("$id leaves player and line colors to the theme default", (preset) => {
    const colors = [...preset.data.players, ...preset.data.lines].map((item) => item.color);

    expect(colors.filter((color) => color !== undefined)).toEqual([]);
  });

  it.each(PLAY_PRESETS)("$id labels every player", (preset) => {
    expect(preset.data.players.filter((p) => p.label === "")).toEqual([]);
  });

  it.each(PLAY_PRESETS)("$id has no overlapping player markers", (preset) => {
    expect(overlappingMarkers(preset.data.players)).toEqual([]);
  });

  it.each(PLAY_PRESETS)("$id keeps every player and line point inside the window", (preset) => {
    const { field, players, lines } = preset.data;
    const points = [
      ...players.map((p) => p.position),
      ...lines.flatMap((l) => [...l.waypoints, l.end]),
    ];

    expect(points.map((point) => clampToZoneWindow(point, field))).toEqual(points);
  });

  it("is frozen down to nested values so consumers cannot modify it", () => {
    const preset = must(PLAY_PRESETS[0]);

    expect(Object.isFrozen(preset)).toBe(true);
    expect(Object.isFrozen(preset.data.players)).toBe(true);
    expect(Object.isFrozen(must(preset.data.players[0]).position)).toBe(true);
  });
});

describe("getPlayPreset", () => {
  it("returns the preset for a known id", () => {
    expect(getPlayPreset("play-inside-zone")?.name).toBe("Inside Zone");
  });

  it("returns undefined for an unknown id", () => {
    expect(getPlayPreset("does-not-exist")).toBeUndefined();
  });
});
