import { describe, expect, it } from "vitest";
import { isFormationSide } from "../formations/formation.js";
import { isLineInterpolation, isLineKind } from "../model/line.js";
import { CURRENT_PLAY_DATA_VERSION, resolvePlayData } from "../model/play-data.js";
import { isPlayerShape } from "../model/player.js";
import type { PlayCategory } from "./play-preset.js";
import { getPlayPreset, PLAY_PRESETS } from "./presets.js";

const DEFENSE_COLOR = "#8f4034";
const VALID_CATEGORIES: readonly PlayCategory[] = [
  "run-zone",
  "run-gap",
  "pass-quick",
  "pass-dropback",
  "pass-deep",
  "pa",
  "rpo",
  "coverage",
  "pressure",
];

function inWindow(lateralYard: number, absoluteYard: number): boolean {
  return absoluteYard >= 35 && absoluteYard <= 65 && lateralYard >= 0 && lateralYard <= 53.3;
}

describe("PLAY_PRESETS データ健全性", () => {
  it("攻 10・守 8 の 18 プリセットで id は一意", () => {
    expect(PLAY_PRESETS).toHaveLength(18);
    const ids = PLAY_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PLAY_PRESETS.filter((p) => p.side === "offense")).toHaveLength(10);
    expect(PLAY_PRESETS.filter((p) => p.side === "defense")).toHaveLength(8);
  });

  it("各プリセットのメタ情報と field は妥当", () => {
    for (const preset of PLAY_PRESETS) {
      expect(isFormationSide(preset.side)).toBe(true);
      expect(VALID_CATEGORIES).toContain(preset.category);
      expect(preset.name.trim()).not.toBe("");
      expect(preset.personnel.trim()).not.toBe("");
      expect(preset.summary.trim()).not.toBe("");
      expect(preset.data.version).toBe(CURRENT_PLAY_DATA_VERSION);
      expect(preset.data.field.zone).toBe("middle");
    }
  });

  it("各プリセットは攻守 22 人・id 一意・色付けが攻守で分かれ、全員が窓内に収まる", () => {
    for (const preset of PLAY_PRESETS) {
      const players = preset.data.players;
      expect(players).toHaveLength(22);
      const ids = players.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of players) {
        expect(isPlayerShape(p.shape)).toBe(true);
        expect(inWindow(p.position.lateralYard, p.position.absoluteYard)).toBe(true);
        // 守は赤で塗り、攻は色なし（テーマ既定）。
        expect(p.color === DEFENSE_COLOR || p.color === undefined).toBe(true);
      }
    }
  });

  it("各線は実在選手を起点にし、種別・補間・座標が妥当で、攻守の色分けに従う", () => {
    for (const preset of PLAY_PRESETS) {
      const playerIds = new Set(preset.data.players.map((p) => p.id));
      for (const line of preset.data.lines) {
        expect(playerIds.has(line.startPlayerId)).toBe(true);
        expect(isLineKind(line.kind)).toBe(true);
        expect(isLineInterpolation(line.interpolation)).toBe(true);
        expect(line.color === DEFENSE_COLOR || line.color === undefined).toBe(true);
        for (const point of [...line.waypoints, line.end]) {
          expect(inWindow(point.lateralYard, point.absoluteYard)).toBe(true);
        }
      }
    }
  });

  it("各プリセットの data は resolvePlayData を通過し選手・線を 1 つも落とさない", () => {
    for (const preset of PLAY_PRESETS) {
      const resolved = resolvePlayData(preset.data);
      expect(resolved.players).toHaveLength(preset.data.players.length);
      expect(resolved.lines).toHaveLength(preset.data.lines.length);
    }
  });
});

describe("getPlayPreset", () => {
  it("既知 id は該当プリセット、未知 id は undefined", () => {
    expect(getPlayPreset("play-inside-zone")?.name).toBe("Inside Zone");
    expect(getPlayPreset("play-cover-3")?.side).toBe("defense");
    expect(getPlayPreset("does-not-exist")).toBeUndefined();
  });
});
