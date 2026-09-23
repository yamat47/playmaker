import { describe, expect, it } from "vitest";
import type { CanvasPoint } from "./field.js";
import { polylineLength, segments, trimPolylineEnd } from "./polyline.js";

describe("segments", () => {
  it("隣り合う 2 点の組を先頭から順に返す", () => {
    expect([...segments([1, 2, 3])]).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  it("点が 2 つ未満なら何も返さない", () => {
    expect([...segments([1])]).toEqual([]);
    expect([...segments([])]).toEqual([]);
  });

  it("undefined を含む点列でも組を落とさない", () => {
    expect([...segments([undefined, 1])]).toEqual([[undefined, 1]]);
  });
});

describe("polylineLength", () => {
  it("隣接点間の距離を足し上げる", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 14 },
    ];
    expect(polylineLength(path)).toBeCloseTo(15);
  });

  it("2 点未満は 0", () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
  });
});

describe("trimPolylineEnd", () => {
  it("最終区間の内側で切るときは終点を内分点へ差し替える", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it("複数区間にまたがって遡る（細かく刻まれた曲線でも指定距離だけ戻る）", () => {
    // 1px 刻みで 10 点。最終区間だけ見ると 1 しか戻れないが、累積長なら 5 戻れる。
    const path: CanvasPoint[] = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }));
    const trimmed = trimPolylineEnd(path, 5);

    const tip = trimmed[trimmed.length - 1] as CanvasPoint;
    expect(tip.x).toBeCloseTo(4);
    expect(polylineLength(trimmed)).toBeCloseTo(polylineLength(path) - 5);
  });

  it("距離 0 以下なら元のまま返す", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 0)).toEqual(path);
    expect(trimPolylineEnd(path, -3)).toEqual(path);
  });

  it("2 点未満は元のまま返す", () => {
    expect(trimPolylineEnd([], 5)).toEqual([]);
    expect(trimPolylineEnd([{ x: 1, y: 2 }], 5)).toEqual([{ x: 1, y: 2 }]);
  });

  it("全長以上を指定したら始点 1 点になる", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 10)).toEqual([{ x: 0, y: 0 }]);
    expect(trimPolylineEnd(path, 999)).toEqual([{ x: 0, y: 0 }]);
  });

  it("重複点（長さ 0 の区間）があっても NaN を出さず遡れる", () => {
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

  it("切り位置がサンプル点にちょうど乗っても、長さ 0 の区間を末尾に残さない", () => {
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

  it("maxFraction は削りすぎを抑え、線が消えないよう全長に対する割合で頭打ちにする", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    // 矢じり長 (8) が全長の 90% (9) より短いので distance がそのまま効く。
    expect(trimPolylineEnd(path, 8, 0.9)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);
    // 矢じり長 (30) が全長を超えるので 90% で頭打ちになり、線が消えない。
    expect(trimPolylineEnd(path, 30, 0.9)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it("maxFraction が 0 以下なら 1 点も削らない", () => {
    const path: CanvasPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(trimPolylineEnd(path, 5, 0)).toEqual(path);
  });

  it("元の配列を変更しない", () => {
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
