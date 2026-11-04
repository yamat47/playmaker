import { describe, expect, it } from "vitest";
import { playerMarkerOutline } from "./player-marker.js";

const RADIUS = 10;

describe("playerMarkerOutline", () => {
  it("draws a circle with a radius smaller than the hit test circle", () => {
    const outline = playerMarkerOutline("circle", RADIUS);

    if (outline.kind !== "circle") {
      throw new Error("expected a circle outline");
    }
    expect(outline.radius).toBeLessThan(RADIUS);
  });

  it("draws a square whose corners lie on the hit test circle", () => {
    const outline = playerMarkerOutline("square", RADIUS);

    if (outline.kind !== "square") {
      throw new Error("expected a square outline");
    }
    expect(Math.hypot(outline.halfSide, outline.halfSide)).toBeCloseTo(RADIUS);
  });
});
