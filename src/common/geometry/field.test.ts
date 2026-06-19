import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIELD_LEAGUE,
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  FieldGeometry,
  fieldZoneWindow,
  HASH_CENTER_OFFSET_YARDS_BY_LEAGUE,
  isEndZone,
  yardLinesInWindow,
  ZONE_WINDOW_LENGTH_YARDS,
} from "./field.js";

describe("ハッシュのリーグ別位置", () => {
  it("既定は NCAA で、サイドラインから 20yd（中央±0.125W）に来る", () => {
    expect(DEFAULT_FIELD_LEAGUE).toBe("ncaa");
    const offset = HASH_CENTER_OFFSET_YARDS_BY_LEAGUE.ncaa;
    expect(offset).toBeCloseTo(FIELD_WIDTH_YARDS * 0.125);
    expect(FIELD_WIDTH_YARDS / 2 - offset).toBeCloseTo(20);
  });

  it("NFHS > NCAA > NFL の順で中央オフセットが大きい（ハッシュが広い）", () => {
    const { ncaa, nfl, nfhs } = HASH_CENTER_OFFSET_YARDS_BY_LEAGUE;
    expect(nfhs).toBeGreaterThan(ncaa);
    expect(ncaa).toBeGreaterThan(nfl);
  });
});

describe("fieldZoneWindow", () => {
  it("own-redzone は自陣EZ(-10)〜自陣RZ(20)を映す", () => {
    expect(fieldZoneWindow("own-redzone")).toEqual({ startYard: -10, endYard: 20 });
  });

  it("redzone は相手RZ(80)〜相手EZ(110)を映す", () => {
    expect(fieldZoneWindow("redzone")).toEqual({ startYard: 80, endYard: 110 });
  });

  it("middle はセンター 50 を中央に置く 35..65", () => {
    expect(fieldZoneWindow("middle")).toEqual({ startYard: 35, endYard: 65 });
  });

  it("どのゾーンも窓の長さは 30 ヤード", () => {
    for (const zone of ["middle", "redzone", "own-redzone"] as const) {
      const w = fieldZoneWindow(zone);
      expect(w.endYard - w.startYard).toBe(ZONE_WINDOW_LENGTH_YARDS);
    }
  });
});

describe("displayYardNumber", () => {
  it("両ゴール 0/100 は 0、センター 50 は 50", () => {
    expect(displayYardNumber(0)).toBe(0);
    expect(displayYardNumber(100)).toBe(0);
    expect(displayYardNumber(50)).toBe(50);
  });

  it("両ゴールから対称に数える（25→25, 75→25, 80→20）", () => {
    expect(displayYardNumber(25)).toBe(25);
    expect(displayYardNumber(75)).toBe(25);
    expect(displayYardNumber(80)).toBe(20);
  });

  it("エンドゾーン（フィールド外）は番号なし=0として扱う", () => {
    expect(displayYardNumber(-10)).toBe(0);
    expect(displayYardNumber(-5)).toBe(0);
    expect(displayYardNumber(105)).toBe(0);
    expect(displayYardNumber(110)).toBe(0);
  });
});

describe("isEndZone", () => {
  it("ゴールラインの外側を true、フィールド内とゴールラインは false", () => {
    expect(isEndZone(-10)).toBe(true);
    expect(isEndZone(-0.1)).toBe(true);
    expect(isEndZone(0)).toBe(false);
    expect(isEndZone(50)).toBe(false);
    expect(isEndZone(100)).toBe(false);
    expect(isEndZone(100.1)).toBe(true);
    expect(isEndZone(110)).toBe(true);
  });
});

describe("yardLinesInWindow", () => {
  it("middle を 5 ヤード刻みで列挙する", () => {
    expect(yardLinesInWindow("middle", 5)).toEqual([35, 40, 45, 50, 55, 60, 65]);
  });

  it("own-redzone を 10 ヤード刻みで列挙する（EZ 側の負値も含む）", () => {
    expect(yardLinesInWindow("own-redzone", 10)).toEqual([-10, 0, 10, 20]);
  });

  it("redzone を 5 ヤード刻みで列挙する（相手 EZ の 110 まで）", () => {
    expect(yardLinesInWindow("redzone", 5)).toEqual([80, 85, 90, 95, 100, 105, 110]);
  });

  it("刻み幅が 0 以下なら例外", () => {
    expect(() => yardLinesInWindow("middle", 0)).toThrow();
    expect(() => yardLinesInWindow("middle", -5)).toThrow();
  });
});

describe("FieldGeometry", () => {
  it("横が制約になる場合は幅基準でフィットし上下に余白が出る", () => {
    const g = new FieldGeometry(1000, 600, "middle");

    expect(g.scale).toBeCloseTo(1000 / FIELD_WIDTH_YARDS, 10);
    expect(g.fieldPixelWidth).toBeCloseTo(1000, 10);
    expect(g.fieldPixelHeight).toBeCloseTo(562.5, 10);
    expect(g.offsetX).toBeCloseTo(0, 10);
    expect(g.offsetY).toBeCloseTo(18.75, 10);
  });

  it("縦が制約になる場合は高さ基準でフィットし左右に余白が出る", () => {
    const g = new FieldGeometry(2000, 300, "middle");

    expect(g.scale).toBeCloseTo(10, 10);
    expect(g.fieldPixelHeight).toBeCloseTo(300, 10);
    expect(g.offsetY).toBeCloseTo(0, 10);
    expect(g.offsetX).toBeCloseTo((2000 - FIELD_WIDTH_YARDS * 10) / 2, 10);
  });

  it("横方向: 0 が左サイドライン、FIELD_WIDTH が右サイドライン", () => {
    const g = new FieldGeometry(1000, 600, "middle");

    expect(g.xForLateralYard(0)).toBeCloseTo(g.offsetX, 10);
    expect(g.xForLateralYard(FIELD_WIDTH_YARDS)).toBeCloseTo(g.offsetX + g.fieldPixelWidth, 10);
  });

  it("縦方向: 窓の奥(endYard)が上端、手前(startYard)が下端、中点が中央", () => {
    const g = new FieldGeometry(1000, 600, "middle");

    expect(g.yForAbsoluteYard(65)).toBeCloseTo(g.offsetY, 10);
    expect(g.yForAbsoluteYard(35)).toBeCloseTo(g.offsetY + g.fieldPixelHeight, 10);
    expect(g.yForAbsoluteYard(50)).toBeCloseTo(g.offsetY + g.fieldPixelHeight / 2, 10);
  });

  it("ゾーンが変われば同じ絶対ヤードでも縦位置が変わる", () => {
    const middle = new FieldGeometry(1000, 600, "middle");
    const redzone = new FieldGeometry(1000, 600, "redzone");

    // 50 は middle 窓の中央だが redzone(80..110) では窓外で下端より下になる。
    expect(middle.yForAbsoluteYard(50)).toBeCloseTo(
      middle.offsetY + middle.fieldPixelHeight / 2,
      10,
    );
    expect(redzone.yForAbsoluteYard(50)).toBeGreaterThan(
      redzone.offsetY + redzone.fieldPixelHeight,
    );
  });

  it("toCanvas は横・縦の変換を合成する", () => {
    const g = new FieldGeometry(1000, 600, "middle");

    expect(g.toCanvas(FIELD_WIDTH_YARDS / 2, 50)).toEqual({
      x: g.xForLateralYard(FIELD_WIDTH_YARDS / 2),
      y: g.yForAbsoluteYard(50),
    });
  });

  it("containsYard は窓の端を含み窓外を除外する", () => {
    const g = new FieldGeometry(1000, 600, "middle");

    expect(g.containsYard(35)).toBe(true);
    expect(g.containsYard(65)).toBe(true);
    expect(g.containsYard(50)).toBe(true);
    expect(g.containsYard(34.9)).toBe(false);
    expect(g.containsYard(65.1)).toBe(false);
  });

  it("ビューポートが 0 や負でも NaN を出さない（縮退耐性）", () => {
    const g = new FieldGeometry(0, -10, "middle");

    expect(g.scale).toBe(0);
    expect(g.fieldPixelWidth).toBe(0);
    expect(Number.isNaN(g.offsetX)).toBe(false);
    expect(Number.isNaN(g.toCanvas(10, 50).x)).toBe(false);
  });

  it("逆変換は forward と往復で一致する（横）", () => {
    const g = new FieldGeometry(1000, 600, "middle");

    expect(g.lateralYardForX(g.xForLateralYard(0))).toBeCloseTo(0, 10);
    expect(g.lateralYardForX(g.xForLateralYard(20))).toBeCloseTo(20, 10);
  });

  it("逆変換は forward と往復で一致する（縦・ゾーン非依存の絶対ヤード）", () => {
    const g = new FieldGeometry(1000, 600, "redzone");

    expect(g.absoluteYardForY(g.yForAbsoluteYard(95))).toBeCloseTo(95, 10);
    expect(g.absoluteYardForY(g.yForAbsoluteYard(110))).toBeCloseTo(110, 10);
  });

  it("fromCanvas は toCanvas の逆（点の往復）", () => {
    const g = new FieldGeometry(1000, 600, "middle");
    const canvas = g.toCanvas(26.6, 52);

    const back = g.fromCanvas(canvas);

    expect(back.lateralYard).toBeCloseTo(26.6, 10);
    expect(back.absoluteYard).toBeCloseTo(52, 10);
  });

  it("縮退ビューポートでも逆変換は NaN を出さない", () => {
    const g = new FieldGeometry(0, 0, "middle");

    const back = g.fromCanvas({ x: 100, y: 100 });

    expect(Number.isNaN(back.lateralYard)).toBe(false);
    expect(Number.isNaN(back.absoluteYard)).toBe(false);
  });
});
