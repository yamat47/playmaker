import { describe, expect, it } from "vitest";
import { fieldStateForZone, LOS_YARD_BY_ZONE } from "../model/play-data.js";
import {
  clampToZoneWindow,
  DEFAULT_FIELD_LEAGUE,
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  FieldGeometry,
  fieldWindowAspect,
  fieldZoneWindow,
  HASH_CENTER_OFFSET_YARDS_BY_LEAGUE,
  yardLinesInWindow,
  ZONE_WINDOW_LENGTH_YARDS,
  zoneWindowLength,
} from "./field.js";

describe("hash marks by league", () => {
  it("defaults to NCAA, whose hash marks sit 20yd from the sideline", () => {
    expect(DEFAULT_FIELD_LEAGUE).toBe("ncaa");
    const offset = HASH_CENTER_OFFSET_YARDS_BY_LEAGUE.ncaa;
    expect(FIELD_WIDTH_YARDS / 2 - offset).toBe(20);
  });

  it("puts every league's hash marks on a 0.5yd grid point from the field center", () => {
    for (const offset of Object.values(HASH_CENTER_OFFSET_YARDS_BY_LEAGUE)) {
      expect((FIELD_WIDTH_YARDS / 2 + offset) % 0.5).toBe(0);
    }
  });

  it("orders the center offsets NFHS > NCAA > NFL, the widest hash marks first", () => {
    const { ncaa, nfl, nfhs } = HASH_CENTER_OFFSET_YARDS_BY_LEAGUE;
    expect(nfhs).toBeGreaterThan(ncaa);
    expect(ncaa).toBeGreaterThan(nfl);
  });
});

describe("LOS position", () => {
  it("puts each zone's LOS on a 0.5yd grid point so the LOS grid matches the yard grid", () => {
    for (const losYard of Object.values(LOS_YARD_BY_ZONE)) {
      expect(losYard % 0.5).toBe(0);
    }
  });
});

describe("fieldZoneWindow", () => {
  it("shows the own end zone (-10) to the own 25yd (25) for own-redzone", () => {
    expect(fieldZoneWindow("own-redzone")).toEqual({ startYard: -10, endYard: 25 });
  });

  it("shows the opponent's 25yd (75) to the opponent's end zone (110) for redzone", () => {
    expect(fieldZoneWindow("redzone")).toEqual({ startYard: 75, endYard: 110 });
  });

  it("shows 35..65 with midfield 50 at the center for middle", () => {
    expect(fieldZoneWindow("middle")).toEqual({ startYard: 35, endYard: 65 });
  });
});

describe("zoneWindowLength", () => {
  it("is 30yd for middle and 35yd for both red zones so no number is cut off", () => {
    expect(zoneWindowLength("middle")).toBe(ZONE_WINDOW_LENGTH_YARDS);
    expect(zoneWindowLength("redzone")).toBe(35);
    expect(zoneWindowLength("own-redzone")).toBe(35);
  });
});

describe("displayYardNumber", () => {
  it("writes 50 on the midfield 50 yard line", () => {
    expect(displayYardNumber(50)).toBe(50);
  });

  it("counts symmetrically from both goal lines (25 to 25, 75 to 25, 80 to 20)", () => {
    expect(displayYardNumber(25)).toBe(25);
    expect(displayYardNumber(75)).toBe(25);
    expect(displayYardNumber(80)).toBe(20);
  });

  it("returns null for the goal lines and the end zones, which carry no number", () => {
    expect(displayYardNumber(0)).toBeNull();
    expect(displayYardNumber(100)).toBeNull();
    expect(displayYardNumber(-5)).toBeNull();
    expect(displayYardNumber(110)).toBeNull();
  });
});

describe("yardLinesInWindow", () => {
  it("lists middle in 5 yard steps", () => {
    expect(yardLinesInWindow("middle", 5)).toEqual([35, 40, 45, 50, 55, 60, 65]);
  });

  it("lists own-redzone in 10 yard steps including the negative end zone yards", () => {
    expect(yardLinesInWindow("own-redzone", 10)).toEqual([-10, 0, 10, 20]);
  });

  it("lists redzone in 5 yard steps from the opponent's 25yd (75) to the end zone (110)", () => {
    expect(yardLinesInWindow("redzone", 5)).toEqual([75, 80, 85, 90, 95, 100, 105, 110]);
  });

  it("throws when the step is 0 or less", () => {
    expect(() => yardLinesInWindow("middle", 0)).toThrow();
    expect(() => yardLinesInWindow("middle", -5)).toThrow();
  });
});

describe("FieldGeometry", () => {
  it("fits to the width and leaves vertical margins when the width constrains", () => {
    const g = new FieldGeometry(530, 400, fieldStateForZone("middle"));

    expect(g.scale).toBeCloseTo(10, 10);
    expect(g.fieldPixelWidth).toBeCloseTo(530, 10);
    expect(g.fieldPixelHeight).toBeCloseTo(300, 10);
    expect(g.offsetX).toBeCloseTo(0, 10);
    expect(g.offsetY).toBeCloseTo(50, 10);
  });

  it("fits to the height and leaves horizontal margins when the height constrains", () => {
    const g = new FieldGeometry(2000, 300, fieldStateForZone("middle"));

    expect(g.scale).toBeCloseTo(10, 10);
    expect(g.fieldPixelHeight).toBeCloseTo(300, 10);
    expect(g.offsetY).toBeCloseTo(0, 10);
    expect(g.offsetX).toBeCloseTo((2000 - FIELD_WIDTH_YARDS * 10) / 2, 10);
  });

  it("maps lateral 0 to the left sideline and FIELD_WIDTH to the right sideline", () => {
    const g = new FieldGeometry(1000, 600, fieldStateForZone("middle"));

    expect(g.xForLateralYard(0)).toBeCloseTo(g.offsetX, 10);
    expect(g.xForLateralYard(FIELD_WIDTH_YARDS)).toBeCloseTo(g.offsetX + g.fieldPixelWidth, 10);
  });

  it("maps endYard to the top, startYard to the bottom, and the middle to the center", () => {
    const g = new FieldGeometry(1000, 600, fieldStateForZone("middle"));

    expect(g.yForAbsoluteYard(65)).toBeCloseTo(g.offsetY, 10);
    expect(g.yForAbsoluteYard(35)).toBeCloseTo(g.offsetY + g.fieldPixelHeight, 10);
    expect(g.yForAbsoluteYard(50)).toBeCloseTo(g.offsetY + g.fieldPixelHeight / 2, 10);
  });

  it("moves the same absolute yard vertically when the zone changes", () => {
    const middle = new FieldGeometry(1000, 600, fieldStateForZone("middle"));
    const redzone = new FieldGeometry(1000, 600, fieldStateForZone("redzone"));

    // 50 is the center of the middle window but falls below the redzone window (75..110).
    expect(middle.yForAbsoluteYard(50)).toBeCloseTo(
      middle.offsetY + middle.fieldPixelHeight / 2,
      10,
    );
    expect(redzone.yForAbsoluteYard(50)).toBeGreaterThan(
      redzone.offsetY + redzone.fieldPixelHeight,
    );
  });

  it("adds a downfield position to the LOS absolute yard before mapping it to canvas y", () => {
    const g = new FieldGeometry(1000, 600, fieldStateForZone("redzone"));

    expect(g.toCanvas({ lateralYard: FIELD_WIDTH_YARDS / 2, downfieldYard: 5 })).toEqual({
      x: g.xForLateralYard(FIELD_WIDTH_YARDS / 2),
      y: g.yForAbsoluteYard(LOS_YARD_BY_ZONE.redzone + 5),
    });
  });

  it("includes the window edges and excludes yards outside it in containsYard", () => {
    const g = new FieldGeometry(1000, 600, fieldStateForZone("middle"));

    expect(g.containsYard(35)).toBe(true);
    expect(g.containsYard(65)).toBe(true);
    expect(g.containsYard(50)).toBe(true);
    expect(g.containsYard(34.9)).toBe(false);
    expect(g.containsYard(65.1)).toBe(false);
  });

  it("produces no NaN for a zero or negative viewport", () => {
    const g = new FieldGeometry(0, -10, fieldStateForZone("middle"));

    expect(g.scale).toBe(0);
    expect(g.fieldPixelWidth).toBe(0);
    expect(Number.isNaN(g.offsetX)).toBe(false);
    expect(Number.isNaN(g.toCanvas({ lateralYard: 10, downfieldYard: 0 }).x)).toBe(false);
  });

  it("round-trips a lateral yard through the forward and inverse transforms", () => {
    const g = new FieldGeometry(1000, 600, fieldStateForZone("middle"));

    expect(g.lateralYardForX(g.xForLateralYard(0))).toBeCloseTo(0, 10);
    expect(g.lateralYardForX(g.xForLateralYard(20))).toBeCloseTo(20, 10);
  });

  it("round-trips an absolute yard through the forward and inverse transforms", () => {
    const g = new FieldGeometry(1000, 600, fieldStateForZone("redzone"));

    expect(g.absoluteYardForY(g.yForAbsoluteYard(95))).toBeCloseTo(95, 10);
    expect(g.absoluteYardForY(g.yForAbsoluteYard(110))).toBeCloseTo(110, 10);
  });

  it("round-trips a point through toCanvas and fromCanvas", () => {
    const g = new FieldGeometry(1000, 600, fieldStateForZone("own-redzone"));
    const canvas = g.toCanvas({ lateralYard: 26.6, downfieldYard: 2 });

    const back = g.fromCanvas(canvas);

    expect(back.lateralYard).toBeCloseTo(26.6, 10);
    expect(back.downfieldYard).toBeCloseTo(2, 10);
  });

  it("produces no NaN from the inverse transform for a degenerate viewport", () => {
    const g = new FieldGeometry(0, 0, fieldStateForZone("middle"));

    const back = g.fromCanvas({ x: 100, y: 100 });

    expect(Number.isNaN(back.lateralYard)).toBe(false);
    expect(Number.isNaN(back.downfieldYard)).toBe(false);
  });
});

describe("clampToZoneWindow", () => {
  const middle = fieldStateForZone("middle");

  it("returns a position inside the window unchanged", () => {
    expect(clampToZoneWindow({ lateralYard: 10, downfieldYard: 5 }, middle)).toEqual({
      lateralYard: 10,
      downfieldYard: 5,
    });
  });

  it("snaps a position beyond a sideline onto the sideline", () => {
    expect(clampToZoneWindow({ lateralYard: -3, downfieldYard: 0 }, middle).lateralYard).toBe(0);
    expect(clampToZoneWindow({ lateralYard: 99, downfieldYard: 0 }, middle).lateralYard).toBe(
      FIELD_WIDTH_YARDS,
    );
  });

  it("snaps a position beyond the window ends onto the window edge relative to the LOS", () => {
    expect(clampToZoneWindow({ lateralYard: 10, downfieldYard: -50 }, middle).downfieldYard).toBe(
      -15,
    );
    expect(clampToZoneWindow({ lateralYard: 10, downfieldYard: 40 }, middle).downfieldYard).toBe(
      15,
    );
    const redzone = fieldStateForZone("redzone");
    expect(clampToZoneWindow({ lateralYard: 10, downfieldYard: 200 }, redzone).downfieldYard).toBe(
      110 - LOS_YARD_BY_ZONE.redzone,
    );
  });
});

describe("fieldWindowAspect", () => {
  it("divides the field width by the window length of each zone", () => {
    expect(fieldWindowAspect("middle")).toBe(FIELD_WIDTH_YARDS / zoneWindowLength("middle"));
    expect(fieldWindowAspect("redzone")).toBe(FIELD_WIDTH_YARDS / zoneWindowLength("redzone"));
  });

  it("gives the taller red zone window a smaller ratio than middle", () => {
    expect(fieldWindowAspect("redzone")).toBeLessThan(fieldWindowAspect("middle"));
  });
});
