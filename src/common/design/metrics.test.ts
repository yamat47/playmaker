import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { computeFieldMetrics } from "./metrics.js";

describe("computeFieldMetrics", () => {
  it("通常サイズで W/U 比率から各寸法を導く", () => {
    const W = 580;
    const U = 10.875;
    const m = computeFieldMetrics(W, U);
    const D = 2 * PLAYER_RADIUS_YARDS * U;

    expect(m.yardLineWidth).toBeCloseTo(0.0021 * W);
    expect(m.goalLineWidth).toBeCloseTo(2 * 0.0021 * W);
    expect(m.hashTickLength).toBeCloseTo(0.375 * U);
    expect(m.numberHeight).toBeCloseTo(2.4 * U);
    expect(m.tokenDiameter).toBeCloseTo(D);
    expect(m.routeWidth).toBeCloseTo(0.11 * D);
    expect(m.blockWidth).toBeCloseTo(m.routeWidth);
    expect(m.blockCapLength).toBeCloseTo(0.4 * D);
    expect(m.arrowLength).toBeCloseTo(D);
    expect(m.arrowHalfWidth).toBeCloseTo(0.62 * D);
    expect(m.motionDash[0]).toBeCloseTo(1.1 * U);
    expect(m.motionDash[1]).toBeCloseTo(0.7 * U);
  });

  it("ゴールラインは通常ヤードラインの 2 倍", () => {
    const m = computeFieldMetrics(580, 10.875);
    expect(m.goalLineWidth).toBeCloseTo(2 * m.yardLineWidth);
  });

  it("極小フィールドでは最小値（ライン 1px・数字 10px・線 1.5px）に張り付く", () => {
    const m = computeFieldMetrics(100, 1.875);
    expect(m.yardLineWidth).toBe(1);
    expect(m.numberHeight).toBe(10);
    expect(m.routeWidth).toBe(1.5);
    expect(m.blockWidth).toBe(1.5);
  });

  it("縮退ビューポート（0）でも NaN を返さず最小値へ丸める", () => {
    const m = computeFieldMetrics(0, 0);
    expect(m.yardLineWidth).toBe(1);
    expect(m.goalLineWidth).toBe(2);
    expect(m.hashTickLength).toBe(0);
    expect(m.numberHeight).toBe(10);
    expect(m.tokenDiameter).toBe(0);
    expect(m.routeWidth).toBe(1.5);
    expect(m.arrowLength).toBe(0);
    expect(m.motionDash).toEqual([0, 0]);
  });

  it("負の入力は 0 として扱う", () => {
    const m = computeFieldMetrics(-10, -5);
    expect(m.yardLineWidth).toBe(1);
    expect(m.hashTickLength).toBe(0);
    expect(m.tokenDiameter).toBe(0);
  });
});
