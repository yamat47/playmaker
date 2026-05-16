import { describe, expect, it } from "vitest";
import type { Player } from "../model/player.js";
import { hitTestPlayer } from "./hit-test.js";

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
