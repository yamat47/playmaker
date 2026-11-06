import { describe, expect, it } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import { yd } from "../../test-support/play-driver.js";
import type { Line } from "../model/line.js";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";
import { pointDistance } from "./hit-test.js";
import { drawnLineEnd, drawnLinePath } from "./line-path.js";

const start = player("a", 10, 0);
const target = player("b", 20, 0);

function lineFromA(shape: Partial<Line>): Line {
  return { ...line("l"), ...shape };
}

describe("drawnLinePath", () => {
  it("runs from the center of the start player through the waypoints to the end", () => {
    const l = lineFromA({ waypoints: [yd(10, 5)], end: yd(15, 5) });

    expect(drawnLinePath(l, [start, target])).toEqual([yd(10, 0), yd(10, 5), yd(15, 5)]);
  });

  it("cuts a curve where it enters the marker of the player it ends on", () => {
    const l = lineFromA({ waypoints: [yd(15, 5)], end: yd(20, 0), interpolation: "bezier" });

    const path = drawnLinePath(l, [start, target]);

    expect(pointDistance(drawnLineEnd(l, [start, target]), target.position)).toBeCloseTo(
      PLAYER_RADIUS_YARDS,
    );
    expect(
      path.slice(0, -1).every((p) => pointDistance(p, target.position) > PLAYER_RADIUS_YARDS),
    ).toBe(true);
  });

  it("keeps the end of a line that comes back to its own start player", () => {
    const l = lineFromA({ waypoints: [yd(15, 5)], end: yd(10, 0.5) });

    expect(drawnLineEnd(l, [start, target])).toEqual(yd(10, 0.5));
  });

  it("keeps a line that lies entirely inside the marker it ends on", () => {
    const overlapping = player("b", 10.5, 0);
    const l = lineFromA({ end: yd(10.5, 0) });

    expect(drawnLinePath(l, [start, overlapping])).toEqual([yd(10, 0), yd(10.5, 0)]);
  });

  it("is empty when the start player is missing", () => {
    expect(drawnLinePath(line("l", "ghost"), [start])).toEqual([]);
  });

  it("returns the same array for the same line and players", () => {
    const l = lineFromA({ end: yd(20, 0) });
    const players = [start, target];

    expect(drawnLinePath(l, players)).toBe(drawnLinePath(l, players));
  });
});

describe("drawnLineEnd", () => {
  it("is the end point of a line that is not drawn for lack of its start player", () => {
    const l = line("l", "ghost");

    expect(drawnLineEnd(l, [start])).toEqual(l.end);
  });
});
