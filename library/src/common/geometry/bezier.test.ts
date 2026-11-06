import { describe, expect, it } from "vitest";
import type { FieldPosition } from "../model/player.js";
import {
  catmullRomBezierControls,
  cubicBezierPoint,
  DEFAULT_BEZIER_SAMPLES_PER_SEGMENT,
  sampleLinePath,
  segmentMidpoints,
} from "./bezier.js";

const at = (lateralYard: number, downfieldYard: number): FieldPosition => ({
  lateralYard,
  downfieldYard,
});

describe("cubicBezierPoint", () => {
  const p0 = at(0, 0);
  const c1 = at(0, 10);
  const c2 = at(10, 10);
  const p1 = at(10, 0);

  it("returns the start point at t=0 and the end point at t=1", () => {
    expect(cubicBezierPoint(p0, c1, c2, p1, 0)).toEqual(p0);
    expect(cubicBezierPoint(p0, c1, c2, p1, 1)).toEqual(p1);
  });

  it("stays a straight line when the control points sit at 1/3 and 2/3 of the segment", () => {
    const a = at(0, 0);
    const b = at(9, 3);
    const mid = cubicBezierPoint(a, at(3, 1), at(6, 2), b, 0.5);

    expect(mid.lateralYard).toBeCloseTo(4.5, 10);
    expect(mid.downfieldYard).toBeCloseTo(1.5, 10);
  });

  it("puts t=0.5 at the apex of a symmetric curve", () => {
    const mid = cubicBezierPoint(p0, c1, c2, p1, 0.5);

    // The control points are mirrored, so the lateral position is exactly the midpoint.
    expect(mid.lateralYard).toBeCloseTo(5, 10);
    // 0.125*0 + 0.375*10 + 0.375*10 + 0.125*0 = 7.5
    expect(mid.downfieldYard).toBeCloseTo(7.5, 10);
  });
});

describe("catmullRomBezierControls", () => {
  it("returns the control points with the standard 1/6 tension", () => {
    const [c1, c2] = catmullRomBezierControls(at(0, 0), at(6, 0), at(6, 6), at(0, 6));

    // c1 = p1 + (p2 - p0)/6, c2 = p2 - (p3 - p1)/6
    expect(c1).toEqual({ lateralYard: 6 + 6 / 6, downfieldYard: 0 + 6 / 6 });
    expect(c2).toEqual({ lateralYard: 6 - -6 / 6, downfieldYard: 6 - 6 / 6 });
  });

  it("keeps the control points on the line when the points are collinear", () => {
    const [c1, c2] = catmullRomBezierControls(at(0, 0), at(1, 1), at(2, 2), at(3, 3));

    expect(c1.lateralYard).toBeCloseTo(c1.downfieldYard, 10);
    expect(c2.lateralYard).toBeCloseTo(c2.downfieldYard, 10);
  });
});

describe("sampleLinePath", () => {
  it("returns a copy of the control points as they are for straight", () => {
    const input = [at(0, 0), at(5, 5), at(10, 0)];

    const out = sampleLinePath(input, "straight");

    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(input[0]);
  });

  it("treats two or fewer control points as a straight line even for bezier", () => {
    const input = [at(0, 0), at(10, 10)];

    expect(sampleLinePath(input, "bezier")).toEqual(input);
  });

  it("passes through every control point for bezier", () => {
    const start = at(0, 0);
    const mid = at(5, 8);
    const end = at(10, 0);

    const out = sampleLinePath([start, mid, end], "bezier", 8);

    expect(out[0]).toEqual(start);
    expect(out).toContainEqual(mid);
    expect(out.at(-1)).toEqual(end);
  });

  it("returns 1 + samples * segments points for bezier", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 0), at(15, 5)], "bezier", 10);

    // 4 points make 3 segments, so 1 + 10 * 3.
    expect(out).toHaveLength(31);
  });

  it("collapses consecutive duplicate points so the tangents stay defined", () => {
    const out = sampleLinePath([at(0, 0), at(0, 0), at(5, 5), at(10, 0)], "straight");

    expect(out).toEqual([at(0, 0), at(5, 5), at(10, 0)]);
  });

  it("treats bezier as a straight line when collapsing leaves two or fewer points", () => {
    const out = sampleLinePath([at(1, 1), at(1, 1), at(9, 9)], "bezier");

    expect(out).toEqual([at(1, 1), at(9, 9)]);
  });

  it("rounds samplesPerSegment up to 1 when it is below 1", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 0)], "bezier", 0);

    // The start point plus one sample for each of the 2 segments.
    expect(out).toHaveLength(3);
  });

  it("keeps collinear control points on the line for bezier without overshoot", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 10)], "bezier", 6);

    for (const p of out) {
      expect(p.lateralYard).toBeCloseTo(p.downfieldYard, 9);
    }
  });

  it("leaves the input array unchanged", () => {
    const input = [at(0, 0), at(5, 5), at(10, 0)];
    const snapshot = JSON.stringify(input);

    sampleLinePath(input, "bezier");

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("uses the exported constant as the default number of samples", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 0)], "bezier");

    expect(out).toHaveLength(1 + DEFAULT_BEZIER_SAMPLES_PER_SEGMENT * 2);
  });
});

describe("segmentMidpoints", () => {
  it("puts each midpoint of a curve on the drawn curve", () => {
    const points = [at(0, 0), at(5, 5), at(10, 0)];
    const sampled = sampleLinePath(points, "bezier", 2);

    expect(segmentMidpoints(points, "bezier")).toEqual([sampled[1], sampled[3]]);
  });

  it("keeps the midpoints on the drawn curve when two adjacent points are equal", () => {
    const sampled = sampleLinePath([at(0, 0), at(5, 5), at(10, 0)], "bezier", 2);

    expect(segmentMidpoints([at(0, 0), at(5, 5), at(5, 5), at(10, 0)], "bezier")).toEqual([
      sampled[1],
      at(5, 5),
      sampled[3],
    ]);
  });
});
