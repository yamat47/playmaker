import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { computeFieldMetrics } from "./metrics.js";

describe("computeFieldMetrics", () => {
  it("doubles only the yard, midfield, and goal line widths when the field width doubles", () => {
    const base = computeFieldMetrics(580, 10.875);

    expect(computeFieldMetrics(1160, 10.875)).toEqual({
      ...base,
      yardLineWidth: 2 * base.yardLineWidth,
      midfieldLineWidth: 2 * base.midfieldLineWidth,
      goalLineWidth: 2 * base.goalLineWidth,
    });
  });

  it("doubles every size except the yard line widths when only the px per yard doubles", () => {
    const base = computeFieldMetrics(580, 10.875);
    const { yardLineWidth, midfieldLineWidth, goalLineWidth, ...byYard } = base;
    const scaled = Object.fromEntries(
      Object.entries(byYard).map(([key, value]) => [
        key,
        typeof value === "number" ? value * 2 : value.map((v) => v * 2),
      ]),
    );

    expect(computeFieldMetrics(580, 21.75)).toEqual({
      yardLineWidth,
      midfieldLineWidth,
      goalLineWidth,
      ...scaled,
    });
  });

  it("sets the player marker diameter to twice the hit test radius in px", () => {
    expect(computeFieldMetrics(580, 10.875).tokenDiameter).toBeCloseTo(
      2 * PLAYER_RADIUS_YARDS * 10.875,
    );
  });

  it("draws the goal line twice as thick as a regular yard line", () => {
    const m = computeFieldMetrics(580, 10.875);

    expect(m.goalLineWidth).toBeCloseTo(2 * m.yardLineWidth);
  });

  it("draws a block line as thick as a route line", () => {
    const m = computeFieldMetrics(580, 10.875);

    expect(m.blockWidth).toBe(m.routeWidth);
  });

  it("clamps every size to its minimum on a tiny field", () => {
    const m = computeFieldMetrics(100, 1.875);

    expect(m.yardLineWidth).toBe(1);
    expect(m.numberHeight).toBe(10);
    expect(m.routeWidth).toBe(1.5);
    expect(m.blockWidth).toBe(1.5);
    expect(m.pylonSize).toBe(3);
    expect(m.goalpostStroke).toBe(2);
  });

  it("clamps to the minimums without producing NaN for a zero-sized viewport", () => {
    const m = computeFieldMetrics(0, 0);

    expect(m.yardLineWidth).toBe(1);
    expect(m.goalLineWidth).toBe(2);
    expect(m.hashTickLength).toBe(0);
    expect(m.numberHeight).toBe(10);
    expect(m.tokenDiameter).toBe(0);
    expect(m.markerStroke).toBe(1.5);
    expect(m.markerLabelFont).toBe(8);
    expect(m.routeWidth).toBe(1.5);
    expect(m.arrowLength).toBe(0);
    expect(m.motionDash).toEqual([0, 0]);
    expect(m.pylonSize).toBe(3);
    expect(m.goalpostCrossbarHalfLength).toBe(0);
    expect(m.goalpostStroke).toBe(2);
    expect(m.gridDotRadius).toBe(0.75);
  });

  it("treats negative inputs as 0", () => {
    const m = computeFieldMetrics(-10, -5);

    expect(m.yardLineWidth).toBe(1);
    expect(m.hashTickLength).toBe(0);
    expect(m.tokenDiameter).toBe(0);
  });
});
