import { describe, expect, it } from "vitest";
import { player } from "../../test-support/fixtures.js";
import type { Line } from "../model/line.js";
import {
  distanceToSegment,
  hitLineHandle,
  hitTestLine,
  hitTestPlayer,
  LINE_HIT_TOLERANCE_YARDS,
  pointDistance,
} from "./hit-test.js";

describe("hitTestPlayer", () => {
  it("returns the player when the point is inside its hit radius", () => {
    const p = player("a", 10, 50);

    expect(hitTestPlayer([p], { lateralYard: 10.5, downfieldYard: 50.3 })).toBe(p);
  });

  it("returns undefined when the point is far from every player", () => {
    const p = player("a", 10, 50);

    expect(hitTestPlayer([p], { lateralYard: 30, downfieldYard: 50 })).toBeUndefined();
  });

  it("returns undefined for an empty array", () => {
    expect(hitTestPlayer([], { lateralYard: 0, downfieldYard: 0 })).toBeUndefined();
  });

  it("counts a point exactly on the radius as a hit", () => {
    const p = player("a", 0, 0);

    expect(hitTestPlayer([p], { lateralYard: 1, downfieldYard: 0 }, 1)).toBe(p);
  });

  it("misses a point just outside the radius", () => {
    const p = player("a", 0, 0);

    expect(hitTestPlayer([p], { lateralYard: 1.0001, downfieldYard: 0 }, 1)).toBeUndefined();
  });

  it("returns the later player in the array, drawn on top, when players overlap", () => {
    const back = player("back", 10, 50);
    const front = player("front", 10, 50);

    expect(hitTestPlayer([back, front], { lateralYard: 10, downfieldYard: 50 })).toBe(front);
  });

  it("accepts a hit radius override as an argument", () => {
    const p = player("a", 0, 0);
    const target = { lateralYard: 3, downfieldYard: 0 };

    expect(hitTestPlayer([p], target, 2)).toBeUndefined();
    expect(hitTestPlayer([p], target, 5)).toBe(p);
  });

  it("throws when the radius is 0 or less", () => {
    const p = player("a", 0, 0);

    expect(() => hitTestPlayer([p], { lateralYard: 0, downfieldYard: 0 }, 0)).toThrow();
    expect(() => hitTestPlayer([p], { lateralYard: 0, downfieldYard: 0 }, -1)).toThrow();
  });
});

describe("distanceToSegment", () => {
  const a = { lateralYard: 0, downfieldYard: 0 };
  const b = { lateralYard: 10, downfieldYard: 0 };

  it("returns 0 for a point on the segment", () => {
    expect(distanceToSegment({ lateralYard: 5, downfieldYard: 0 }, a, b)).toBeCloseTo(0, 10);
  });

  it("returns the perpendicular distance to the middle of the segment", () => {
    expect(distanceToSegment({ lateralYard: 5, downfieldYard: 3 }, a, b)).toBeCloseTo(3, 10);
  });

  it("returns the distance to the nearest endpoint for a point beyond the ends", () => {
    expect(distanceToSegment({ lateralYard: -4, downfieldYard: 3 }, a, b)).toBeCloseTo(5, 10);
    expect(distanceToSegment({ lateralYard: 13, downfieldYard: 4 }, a, b)).toBeCloseTo(5, 10);
  });

  it("returns the point distance for a degenerate segment (a=b)", () => {
    expect(distanceToSegment({ lateralYard: 3, downfieldYard: 4 }, a, a)).toBeCloseTo(5, 10);
  });
});

describe("hitTestLine", () => {
  const players = [player("qb", 26, 48), player("wr", 5, 50)];

  function line(id: string, overrides: Partial<Line> = {}): Line {
    return {
      id,
      kind: "route",
      startPlayerId: "wr",
      waypoints: [],
      end: { lateralYard: 5, downfieldYard: 60 },
      interpolation: "straight",
      ...overrides,
    };
  }

  it("returns the line when the point is near a straight line", () => {
    const l = line("r1");

    expect(hitTestLine([l], players, { lateralYard: 5.2, downfieldYard: 55 })).toBe(l);
  });

  it("returns undefined when the point is farther than the tolerance", () => {
    const l = line("r1");

    expect(hitTestLine([l], players, { lateralYard: 20, downfieldYard: 55 })).toBeUndefined();
  });

  it("skips a line whose start player does not exist, since it is not drawn", () => {
    const l = line("r1", { startPlayerId: "ghost" });

    expect(hitTestLine([l], players, { lateralYard: 5, downfieldYard: 55 })).toBeUndefined();
  });

  it("tests each segment of a polyline with waypoints", () => {
    const l = line("r1", {
      waypoints: [{ lateralYard: 15, downfieldYard: 50 }],
      end: { lateralYard: 15, downfieldYard: 60 },
    });

    // On the horizontal segment from the start (5, 50) to the waypoint (15, 50).
    expect(hitTestLine([l], players, { lateralYard: 10, downfieldYard: 50 })).toBe(l);
  });

  it("tests a bezier line against the sampled curve", () => {
    // An L shape through the start wr (5, 50), the waypoint (5, 60), and the end (25, 60).
    const shape: Partial<Line> = {
      waypoints: [{ lateralYard: 5, downfieldYard: 60 }],
      end: { lateralYard: 25, downfieldYard: 60 },
    };
    const straight = line("s", { ...shape, interpolation: "straight" });
    const curved = line("c", { ...shape, interpolation: "bezier" });
    // The midpoint of the first segment. It lies on the straight line, but the bezier bulges away.
    const probe = { lateralYard: 5, downfieldYard: 55 };

    expect(hitTestLine([straight], players, probe, 0.3)).toBe(straight);
    expect(hitTestLine([curved], players, probe, 0.3)).toBeUndefined();
  });

  it("returns the later line in the array, drawn on top, when lines overlap", () => {
    const back = line("back");
    const front = line("front");

    expect(hitTestLine([back, front], players, { lateralYard: 5, downfieldYard: 55 })).toBe(front);
  });

  it("returns undefined for an empty array", () => {
    expect(hitTestLine([], players, { lateralYard: 0, downfieldYard: 0 })).toBeUndefined();
  });

  it("hits only points within the given tolerance", () => {
    const l = line("r1");
    const target = { lateralYard: 6, downfieldYard: 55 };

    expect(hitTestLine([l], players, target, 0.5)).toBeUndefined();
    expect(hitTestLine([l], players, target, 2)).toBe(l);
  });

  it("hits points within LINE_HIT_TOLERANCE_YARDS when no tolerance is given", () => {
    const l = line("r1");
    const near = { lateralYard: 5 + LINE_HIT_TOLERANCE_YARDS * 0.99, downfieldYard: 55 };
    const far = { lateralYard: 5 + LINE_HIT_TOLERANCE_YARDS * 1.01, downfieldYard: 55 };

    expect(hitTestLine([l], players, near)).toBe(l);
    expect(hitTestLine([l], players, far)).toBeUndefined();
  });

  it("throws when the tolerance is 0 or less", () => {
    const l = line("r1");

    expect(() => hitTestLine([l], players, { lateralYard: 0, downfieldYard: 0 }, 0)).toThrow();
    expect(() => hitTestLine([l], players, { lateralYard: 0, downfieldYard: 0 }, -1)).toThrow();
  });

  describe("a line without waypoints whose end sits on its start player", () => {
    // wr stands at (5, 50).
    const degenerate = line("degen", { end: { lateralYard: 5, downfieldYard: 50 } });

    it("hits a point at those exact coordinates", () => {
      expect(hitTestLine([degenerate], players, { lateralYard: 5, downfieldYard: 50 })).toBe(
        degenerate,
      );
    });

    it("returns undefined for a point farther than the tolerance", () => {
      expect(
        hitTestLine([degenerate], players, { lateralYard: 5, downfieldYard: 55 }),
      ).toBeUndefined();
    });
  });
});

describe("pointDistance", () => {
  it("returns the Euclidean distance between two points", () => {
    expect(
      pointDistance({ lateralYard: 0, downfieldYard: 0 }, { lateralYard: 3, downfieldYard: 4 }),
    ).toBe(5);
  });
});

describe("hitLineHandle", () => {
  const line = {
    waypointHandles: [
      { lateralYard: 10, downfieldYard: 0 },
      { lateralYard: 10.5, downfieldYard: 0 },
    ],
    endpointHandle: { lateralYard: 20, downfieldYard: 5 },
    bendHandles: [{ lateralYard: 15, downfieldYard: 2.5 }],
  };

  it("returns the position and index of a waypoint inside the radius", () => {
    expect(hitLineHandle(line, { lateralYard: 9.5, downfieldYard: 0 })).toEqual({
      kind: "waypoint",
      index: 0,
      point: { lateralYard: 10, downfieldYard: 0 },
    });
  });

  it("returns the later waypoint when waypoints overlap", () => {
    expect(hitLineHandle(line, { lateralYard: 10.25, downfieldYard: 0 })).toMatchObject({
      index: 1,
    });
  });

  it("returns the endpoint when the point hits it", () => {
    expect(hitLineHandle(line, { lateralYard: 20.5, downfieldYard: 5 })).toEqual({
      kind: "endpoint",
      point: line.endpointHandle,
    });
  });

  it("returns the endpoint when it overlaps a waypoint", () => {
    const overlapped = { ...line, endpointHandle: { lateralYard: 10.5, downfieldYard: 0 } };

    expect(hitLineHandle(overlapped, { lateralYard: 10.5, downfieldYard: 0 })?.kind).toBe(
      "endpoint",
    );
  });

  it("returns the index of a bend handle inside the radius", () => {
    expect(hitLineHandle(line, { lateralYard: 15.5, downfieldYard: 2.5 })).toEqual({
      kind: "bend",
      index: 0,
      point: { lateralYard: 15, downfieldYard: 2.5 },
    });
  });

  it("returns the waypoint rather than a bend handle that overlaps it", () => {
    const crowded = { ...line, bendHandles: [{ lateralYard: 10.25, downfieldYard: 0 }] };

    expect(hitLineHandle(crowded, { lateralYard: 10.25, downfieldYard: 0 })?.kind).toBe("waypoint");
  });

  it("returns undefined when no handle is hit", () => {
    expect(hitLineHandle(line, { lateralYard: 40, downfieldYard: 0 })).toBeUndefined();
  });
});
