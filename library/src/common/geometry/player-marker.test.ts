import { describe, expect, it } from "vitest";
import { playerMarkerOutline } from "./player-marker.js";

const RADIUS = 10;

describe("playerMarkerOutline", () => {
  it("丸は、当たり判定の円より小さい半径で描く", () => {
    const outline = playerMarkerOutline("circle", RADIUS);

    if (outline.kind !== "circle") {
      throw new Error("丸は円で描くはずだった");
    }
    expect(outline.radius).toBeLessThan(RADIUS);
  });

  it("正方形は、頂点が当たり判定の円に乗る大きさで描く", () => {
    const outline = playerMarkerOutline("square", RADIUS);

    if (outline.kind !== "square") {
      throw new Error("四角は正方形で描くはずだった");
    }
    expect(Math.hypot(outline.halfSide, outline.halfSide)).toBeCloseTo(RADIUS);
  });
});
