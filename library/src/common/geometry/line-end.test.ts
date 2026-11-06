import { describe, expect, it } from "vitest";
import { player } from "../../test-support/fixtures.js";
import { yd } from "../../test-support/play-driver.js";
import { stopShortOfPlayer } from "./line-end.js";

const defender = player("e", 20, 1.5);

describe("stopShortOfPlayer", () => {
  it("returns the point unchanged when it is not on a player", () => {
    expect(stopShortOfPlayer(yd(30, 5), yd(20, -1), [defender])).toEqual(yd(30, 5));
  });

  it("stops on the grid point just outside the marker, on the side the line comes from", () => {
    expect(stopShortOfPlayer(yd(20, 1.5), yd(20, -1), [defender])).toEqual(yd(20, 0.5));
  });

  it("steps one grid point further out when the point nearest the edge rounds into the marker", () => {
    expect(stopShortOfPlayer(yd(20, 1.5), yd(19, 0.5), [defender])).toEqual(yd(19, 0.5));
  });

  it("returns the point unchanged when the line comes from the player's center", () => {
    expect(stopShortOfPlayer(yd(20.5, 1.5), yd(20, 1.5), [defender])).toEqual(yd(20.5, 1.5));
  });
});
