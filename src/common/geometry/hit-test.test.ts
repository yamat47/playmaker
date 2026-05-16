import { describe, expect, it } from "vitest";
import type { Line } from "../model/line.js";
import type { Player } from "../model/player.js";
import {
  distanceToSegment,
  hitTestLine,
  hitTestPlayer,
  LINE_HIT_TOLERANCE_YARDS,
} from "./hit-test.js";

function player(id: string, lateralYard: number, absoluteYard: number): Player {
  return { id, position: { lateralYard, absoluteYard }, shape: "circle", label: "" };
}

describe("hitTestPlayer", () => {
  it("当たり半径の内側を指せばその選手を返す", () => {
    const p = player("a", 10, 50);

    expect(hitTestPlayer([p], { lateralYard: 10.5, absoluteYard: 50.3 })).toBe(p);
  });

  it("どの選手からも離れていれば undefined を返す", () => {
    const p = player("a", 10, 50);

    expect(hitTestPlayer([p], { lateralYard: 30, absoluteYard: 50 })).toBeUndefined();
  });

  it("空配列なら undefined を返す", () => {
    expect(hitTestPlayer([], { lateralYard: 0, absoluteYard: 0 })).toBeUndefined();
  });

  it("ちょうど半径上の点は当たりに含む（境界は内側扱い）", () => {
    const p = player("a", 0, 0);

    expect(hitTestPlayer([p], { lateralYard: 1, absoluteYard: 0 }, 1)).toBe(p);
  });

  it("半径のわずか外側は外れる（境界値）", () => {
    const p = player("a", 0, 0);

    expect(hitTestPlayer([p], { lateralYard: 1.0001, absoluteYard: 0 }, 1)).toBeUndefined();
  });

  it("重なり合う選手は最も手前（配列末尾＝上に描画）を返す", () => {
    const back = player("back", 10, 50);
    const front = player("front", 10, 50);

    expect(hitTestPlayer([back, front], { lateralYard: 10, absoluteYard: 50 })).toBe(front);
  });

  it("当たり半径は引数で上書きできる", () => {
    const p = player("a", 0, 0);
    const target = { lateralYard: 3, absoluteYard: 0 };

    expect(hitTestPlayer([p], target, 2)).toBeUndefined();
    expect(hitTestPlayer([p], target, 5)).toBe(p);
  });

  it("半径が 0 以下なら例外", () => {
    const p = player("a", 0, 0);

    expect(() => hitTestPlayer([p], { lateralYard: 0, absoluteYard: 0 }, 0)).toThrow();
    expect(() => hitTestPlayer([p], { lateralYard: 0, absoluteYard: 0 }, -1)).toThrow();
  });
});

describe("distanceToSegment", () => {
  const a = { lateralYard: 0, absoluteYard: 0 };
  const b = { lateralYard: 10, absoluteYard: 0 };

  it("線分上の点は距離 0", () => {
    expect(distanceToSegment({ lateralYard: 5, absoluteYard: 0 }, a, b)).toBeCloseTo(0, 10);
  });

  it("線分の途中への垂線距離", () => {
    expect(distanceToSegment({ lateralYard: 5, absoluteYard: 3 }, a, b)).toBeCloseTo(3, 10);
  });

  it("端の外側は端点までの距離（射影を [0,1] に丸める）", () => {
    expect(distanceToSegment({ lateralYard: -4, absoluteYard: 3 }, a, b)).toBeCloseTo(5, 10);
    expect(distanceToSegment({ lateralYard: 13, absoluteYard: 4 }, a, b)).toBeCloseTo(5, 10);
  });

  it("退化した線分（a=b）は点距離", () => {
    expect(distanceToSegment({ lateralYard: 3, absoluteYard: 4 }, a, a)).toBeCloseTo(5, 10);
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
      end: { lateralYard: 5, absoluteYard: 60 },
      interpolation: "straight",
      ...overrides,
    };
  }

  it("直線の真上付近を指せばその線を返す", () => {
    const l = line("r1");

    expect(hitTestLine([l], players, { lateralYard: 5.2, absoluteYard: 55 })).toBe(l);
  });

  it("許容半径より離れていれば undefined", () => {
    const l = line("r1");

    expect(hitTestLine([l], players, { lateralYard: 20, absoluteYard: 55 })).toBeUndefined();
  });

  it("起点選手が存在しない線は hit 対象から外す（描画されないため）", () => {
    const l = line("r1", { startPlayerId: "ghost" });

    expect(hitTestLine([l], players, { lateralYard: 5, absoluteYard: 55 })).toBeUndefined();
  });

  it("waypoint を含む折れ線は各区間で判定する", () => {
    const l = line("r1", {
      waypoints: [{ lateralYard: 15, absoluteYard: 50 }],
      end: { lateralYard: 15, absoluteYard: 60 },
    });

    // 起点(5,50)→waypoint(15,50) の水平区間上。
    expect(hitTestLine([l], players, { lateralYard: 10, absoluteYard: 50 })).toBe(l);
  });

  it("bezier 線は曲線（サンプル後ポリライン）で判定する", () => {
    // 起点 wr(5,50)→waypoint(5,60)→end(25,60) の L 字。
    const shape: Partial<Line> = {
      waypoints: [{ lateralYard: 5, absoluteYard: 60 }],
      end: { lateralYard: 25, absoluteYard: 60 },
    };
    const straight = line("s", { ...shape, interpolation: "straight" });
    const curved = line("c", { ...shape, interpolation: "bezier" });
    // 第 1 区間の中点。直線なら線上(距離0)、bezier は内側へ膨らみ離れる。
    const probe = { lateralYard: 5, absoluteYard: 55 };

    expect(hitTestLine([straight], players, probe, 0.3)).toBe(straight);
    expect(hitTestLine([curved], players, probe, 0.3)).toBeUndefined();
  });

  it("重なる線は最も手前（配列末尾＝上に描画）を返す", () => {
    const back = line("back");
    const front = line("front");

    expect(hitTestLine([back, front], players, { lateralYard: 5, absoluteYard: 55 })).toBe(front);
  });

  it("空配列なら undefined", () => {
    expect(hitTestLine([], players, { lateralYard: 0, absoluteYard: 0 })).toBeUndefined();
  });

  it("許容半径は引数で上書きでき、既定は公開定数", () => {
    const l = line("r1");
    const target = { lateralYard: 6, absoluteYard: 55 };

    expect(hitTestLine([l], players, target, 0.5)).toBeUndefined();
    expect(hitTestLine([l], players, target, 2)).toBe(l);
    expect(LINE_HIT_TOLERANCE_YARDS).toBeGreaterThan(0);
  });

  it("許容半径が 0 以下なら例外", () => {
    const l = line("r1");

    expect(() => hitTestLine([l], players, { lateralYard: 0, absoluteYard: 0 }, 0)).toThrow();
    expect(() => hitTestLine([l], players, { lateralYard: 0, absoluteYard: 0 }, -1)).toThrow();
  });

  describe("退化した 1 点線（起点選手位置と終点が同座標・waypoints 空）", () => {
    // wr の position は (5, 50)。end も同座標にすると anchors が [P, P] となり
    // dedupeConsecutive で [P]（1 点）へ縮約され distanceToPolyline の length===1 分岐を通る。
    const degenerate = line("degen", { end: { lateralYard: 5, absoluteYard: 50 } });

    it("その点と同座標（距離 0）は許容半径内で hit する", () => {
      expect(hitTestLine([degenerate], players, { lateralYard: 5, absoluteYard: 50 })).toBe(
        degenerate,
      );
    });

    it("許容半径より離れた点は undefined（境界値）", () => {
      expect(
        hitTestLine([degenerate], players, { lateralYard: 5, absoluteYard: 55 }),
      ).toBeUndefined();
    });
  });
});
