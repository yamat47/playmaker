import { describe, expect, it } from "vitest";
import type { CanvasPoint } from "./field.js";
import { polylineLength, segments, trimPolylineEnd } from "./polyline.js";

describe("segments", () => {
  it("yields each pair of adjacent points in order", () => {
    expect([...segments([1, 2, 3])]).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  it("yields nothing for fewer than two points", () => {
    expect([...segments([1])]).toEqual([]);
    expect([...segments([])]).toEqual([]);
  });

  it("keeps pairs that contain undefined", () => {
    expect([...segments([undefined, 1])]).toEqual([[undefined, 1]]);
  });
});

describe("polylineLength", () => {
  it("sums the distances between adjacent points", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 14 },
    ];
    expect(polylineLength(path)).toBeCloseTo(15);
  });

  it("returns 0 for fewer than two points", () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
  });
});

describe("trimPolylineEnd", () => {
  it("replaces the end with a point inside the last segment when the cut lands there", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it("walks back across several segments on a finely sampled curve", () => {
    // 10 points 1px apart. The last segment alone allows 1, but the cumulative length allows 5.
    const path: CanvasPoint[] = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }));
    const trimmed = trimPolylineEnd(path, 5);

    const tip = trimmed[trimmed.length - 1] as CanvasPoint;
    expect(tip.x).toBeCloseTo(4);
    expect(polylineLength(trimmed)).toBeCloseTo(polylineLength(path) - 5);
  });

  it("returns the path unchanged for a distance of 0 or less", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 0)).toEqual(path);
    expect(trimPolylineEnd(path, -3)).toEqual(path);
  });

  it("returns a path with fewer than two points unchanged", () => {
    expect(trimPolylineEnd([], 5)).toEqual([]);
    expect(trimPolylineEnd([{ x: 1, y: 2 }], 5)).toEqual([{ x: 1, y: 2 }]);
  });

  it("leaves only the start point for a distance of the full length or more", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 10)).toEqual([{ x: 0, y: 0 }]);
    expect(trimPolylineEnd(path, 999)).toEqual([{ x: 0, y: 0 }]);
  });

  it("walks back past duplicate points without producing NaN", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
    ];
    const trimmed = trimPolylineEnd(path, 4);

    const tip = trimmed[trimmed.length - 1] as CanvasPoint;
    expect(tip.x).toBeCloseTo(6);
    expect(tip.y).toBeCloseTo(0);
  });

  it("leaves no zero-length segment when the cut lands exactly on a sample point", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 5)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it("caps the trim at maxFraction of the full length so the line does not vanish", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    // The arrowhead length (8) is below 90% of the full length (9), so distance applies as is.
    expect(trimPolylineEnd(path, 8, 0.9)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);
    // The arrowhead length (30) exceeds the full length, so the 90% cap keeps the line visible.
    expect(trimPolylineEnd(path, 30, 0.9)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it("trims nothing when maxFraction is 0 or less", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 5, 0)).toEqual(path);
  });

  it("leaves the original array unchanged", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    trimPolylineEnd(path, 4);
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });
});
