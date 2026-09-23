import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { computeFieldMetrics } from "./metrics.js";

describe("computeFieldMetrics", () => {
  it("フィールドの幅だけを 2 倍にすると、ヤードラインとゴールラインだけが 2 倍の太さになる", () => {
    const base = computeFieldMetrics(580, 10.875);

    expect(computeFieldMetrics(1160, 10.875)).toEqual({
      ...base,
      yardLineWidth: 2 * base.yardLineWidth,
      goalLineWidth: 2 * base.goalLineWidth,
    });
  });

  it("1 ヤードの px だけを 2 倍にすると、ヤードライン以外のどの寸法も 2 倍になる", () => {
    const base = computeFieldMetrics(580, 10.875);
    const { yardLineWidth, goalLineWidth, ...byYard } = base;
    const scaled = Object.fromEntries(
      Object.entries(byYard).map(([key, value]) => [
        key,
        typeof value === "number" ? value * 2 : value.map((v) => v * 2),
      ]),
    );

    expect(computeFieldMetrics(580, 21.75)).toEqual({ yardLineWidth, goalLineWidth, ...scaled });
  });

  it("選手マーカーの直径は、当たり判定の半径を 1 ヤードの px で直径にしたもの", () => {
    expect(computeFieldMetrics(580, 10.875).tokenDiameter).toBeCloseTo(
      2 * PLAYER_RADIUS_YARDS * 10.875,
    );
  });

  it("ゴールラインは通常のヤードラインの 2 倍の太さで描く", () => {
    const m = computeFieldMetrics(580, 10.875);

    expect(m.goalLineWidth).toBeCloseTo(2 * m.yardLineWidth);
  });

  it("block の線は route と同じ太さで描く", () => {
    const m = computeFieldMetrics(580, 10.875);

    expect(m.blockWidth).toBe(m.routeWidth);
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
    expect(m.markerStroke).toBe(1);
    expect(m.markerLabelFont).toBe(8);
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
