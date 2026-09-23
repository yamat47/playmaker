import { describe, expect, it } from "vitest";
import type { PlayerShape } from "../model/player.js";
import type { CanvasPoint } from "./field.js";
import { playerMarkerOutline } from "./player-marker.js";

const CENTER: CanvasPoint = { x: 100, y: 50 };
const RADIUS = 10;
const POLYGON_SIDES = [
  ["triangle", 3],
  ["square", 4],
  ["diamond", 4],
  ["pentagon", 5],
  ["hexagon", 6],
] as const;

function polygonVertices(shape: PlayerShape): readonly CanvasPoint[] {
  const outline = playerMarkerOutline(shape, CENTER, RADIUS);
  if (outline.kind !== "polygon") {
    throw new Error(`${shape} は多角形で描くはずだった`);
  }
  return outline.vertices;
}

describe("playerMarkerOutline", () => {
  it("丸は、当たり判定の円より小さい半径で描く", () => {
    const outline = playerMarkerOutline("circle", CENTER, RADIUS);

    if (outline.kind !== "circle") {
      throw new Error("丸は円で描くはずだった");
    }
    expect(outline.radius).toBeLessThan(RADIUS);
  });

  it("多角形は形状の辺の数だけ頂点を持つ", () => {
    for (const [shape, sides] of POLYGON_SIDES) {
      expect(polygonVertices(shape)).toHaveLength(sides);
    }
  });

  it("多角形の頂点は、すべて当たり判定の円の上にある", () => {
    for (const [shape] of POLYGON_SIDES) {
      for (const { x, y } of polygonVertices(shape)) {
        expect(Math.hypot(x - CENTER.x, y - CENTER.y)).toBeCloseTo(RADIUS);
      }
    }
  });

  it("正方形以外の多角形は、最初の頂点を真上に向ける", () => {
    for (const shape of ["triangle", "diamond", "pentagon", "hexagon"] as const) {
      const [apex] = polygonVertices(shape);

      expect(apex?.x).toBeCloseTo(CENTER.x);
      expect(apex?.y).toBeCloseTo(CENTER.y - RADIUS);
    }
  });

  it("正方形は辺が水平と垂直になるよう、頂点を斜めに置く", () => {
    const offset = RADIUS / Math.SQRT2;

    for (const { x, y } of polygonVertices("square")) {
      expect(Math.abs(x - CENTER.x)).toBeCloseTo(offset);
      expect(Math.abs(y - CENTER.y)).toBeCloseTo(offset);
    }
  });
});
