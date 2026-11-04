import { describe, expect, it } from "vitest";
import { overlappingMarkers } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { FIELD_ZONE_VALUES, fieldStateForZone } from "../model/play-data.js";
import { normalizeFormation } from "./formation.js";
import { FORMATION_PRESETS, getFormationPreset } from "./presets.js";

const OFFENSE_PRESETS = FORMATION_PRESETS.filter((f) => f.side === "offense");
const DEFENSE_PRESETS = FORMATION_PRESETS.filter((f) => f.side === "defense");

describe("FORMATION_PRESETS", () => {
  it("has a distinct id for every preset", () => {
    const ids = FORMATION_PRESETS.map((f) => f.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has presets for both offense and defense", () => {
    expect(OFFENSE_PRESETS).not.toHaveLength(0);
    expect(DEFENSE_PRESETS).not.toHaveLength(0);
  });

  it.each(FORMATION_PRESETS)("$id has a name and places 11 players", (formation) => {
    expect(formation.name.trim()).not.toBe("");
    expect(formation.players).toHaveLength(11);
  });

  it.each(FORMATION_PRESETS)("$id is unchanged when normalized as external data", (formation) => {
    expect(normalizeFormation(formation)).toEqual(formation);
  });

  it.each(FORMATION_PRESETS)("$id leaves player colors to the theme default", (formation) => {
    expect(formation.players.filter((p) => p.color !== undefined)).toEqual([]);
  });

  it.each(FORMATION_PRESETS)("$id labels every player", (formation) => {
    expect(formation.players.filter((p) => p.label === "")).toEqual([]);
  });

  it.each(FORMATION_PRESETS)("$id has no overlapping player markers", (formation) => {
    expect(overlappingMarkers(formation.players)).toEqual([]);
  });

  it.each(FIELD_ZONE_VALUES)(
    "loads every preset's players inside the window in the %s zone",
    (zone) => {
      const field = fieldStateForZone(zone);
      const positions = FORMATION_PRESETS.flatMap((f) => f.players.map((p) => p.position));

      expect(positions.map((position) => clampToZoneWindow(position, field))).toEqual(positions);
    },
  );

  it("is frozen down to nested values so consumers cannot modify it", () => {
    const preset = must(FORMATION_PRESETS[0]);

    expect(Object.isFrozen(preset)).toBe(true);
    expect(Object.isFrozen(preset.players)).toBe(true);
    expect(Object.isFrozen(must(preset.players[0]).position)).toBe(true);
  });
});

describe("getFormationPreset", () => {
  it("returns the preset for a known id", () => {
    expect(getFormationPreset("i-formation")?.name).toBe("I-Formation");
  });

  it("returns undefined for an unknown id", () => {
    expect(getFormationPreset("does-not-exist")).toBeUndefined();
  });
});
