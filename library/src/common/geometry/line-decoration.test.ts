import { describe, expect, it } from "vitest";
import type { CanvasPoint } from "./field.js";
import { arrowHeadVertices, blockCapEndpoints, trimForArrowHead } from "./line-decoration.js";

const RIGHTWARD: CanvasPoint[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
];

describe("trimForArrowHead", () => {
  it("stops a line longer than the arrowhead one arrowhead length before its end", () => {
    expect(trimForArrowHead(RIGHTWARD, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it("keeps a tenth of a line shorter than the arrowhead", () => {
    const trimmed = trimForArrowHead(RIGHTWARD, 20);

    expect(trimmed.at(-1)?.x).toBeCloseTo(1);
  });
});

describe("arrowHeadVertices", () => {
  it("puts the tip at the end and the base to the left for a rightward line", () => {
    expect(arrowHeadVertices(RIGHTWARD, 4, 2)).toEqual([
      { x: 10, y: 0 },
      { x: 6, y: 2 },
      { x: 6, y: -2 },
    ]);
  });

  it("takes the direction from the last distinct point when the end point repeats", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 10 },
    ];

    expect(arrowHeadVertices(path, 4, 2)).toEqual([
      { x: 0, y: 10 },
      { x: -2, y: 6 },
      { x: 2, y: 6 },
    ]);
  });

  it("draws no arrowhead for a line with all points equal or fewer than two points", () => {
    const point = { x: 3, y: 3 };

    expect(arrowHeadVertices([point, point], 4, 2)).toBeUndefined();
    expect(arrowHeadVertices([point], 4, 2)).toBeUndefined();
    expect(arrowHeadVertices([], 4, 2)).toBeUndefined();
  });
});

describe("blockCapEndpoints", () => {
  it("becomes a vertical bar centered on the end for a rightward line", () => {
    expect(blockCapEndpoints(RIGHTWARD, 4)).toEqual([
      { x: 10, y: -2 },
      { x: 10, y: 2 },
    ]);
  });

  it("draws no bar for a line with no direction", () => {
    const point = { x: 3, y: 3 };

    expect(blockCapEndpoints([point, point], 4)).toBeUndefined();
  });
});
