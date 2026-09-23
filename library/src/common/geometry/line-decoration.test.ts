import { describe, expect, it } from "vitest";
import type { CanvasPoint } from "./field.js";
import { arrowHeadVertices, blockCapEndpoints, trimForArrowHead } from "./line-decoration.js";

const RIGHTWARD: CanvasPoint[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
];

describe("trimForArrowHead", () => {
  it("矢じりより長い線は、終点から矢じりの長さだけ手前で止める", () => {
    expect(trimForArrowHead(RIGHTWARD, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it("矢じりより短い線も、全長の 1 割は残す", () => {
    const trimmed = trimForArrowHead(RIGHTWARD, 20);

    expect(trimmed.at(-1)?.x).toBeCloseTo(1);
  });
});

describe("arrowHeadVertices", () => {
  it("右へ進む線は、終点を先端にして根元を左に置く", () => {
    expect(arrowHeadVertices(RIGHTWARD, 4, 2)).toEqual([
      { x: 10, y: 0 },
      { x: 6, y: 2 },
      { x: 6, y: -2 },
    ]);
  });

  it("終点と同じ座標の点が末尾に続く線は、座標の違う直近の点から向きを求める", () => {
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

  it("すべての点が同じ座標の線や点が 1 つ以下の線には、矢じりを描かない", () => {
    const point = { x: 3, y: 3 };

    expect(arrowHeadVertices([point, point], 4, 2)).toBeUndefined();
    expect(arrowHeadVertices([point], 4, 2)).toBeUndefined();
    expect(arrowHeadVertices([], 4, 2)).toBeUndefined();
  });
});

describe("blockCapEndpoints", () => {
  it("右へ進む線は、終点を中点にした縦の横棒になる", () => {
    expect(blockCapEndpoints(RIGHTWARD, 4)).toEqual([
      { x: 10, y: -2 },
      { x: 10, y: 2 },
    ]);
  });

  it("向きが決まらない線には、横棒を描かない", () => {
    const point = { x: 3, y: 3 };

    expect(blockCapEndpoints([point, point], 4)).toBeUndefined();
  });
});
