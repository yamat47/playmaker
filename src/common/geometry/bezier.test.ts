import { describe, expect, it } from "vitest";
import type { FieldPosition } from "../model/player.js";
import {
  catmullRomBezierControls,
  cubicBezierPoint,
  DEFAULT_BEZIER_SAMPLES_PER_SEGMENT,
  sampleLinePath,
} from "./bezier.js";

const at = (lateralYard: number, absoluteYard: number): FieldPosition => ({
  lateralYard,
  absoluteYard,
});

describe("cubicBezierPoint", () => {
  const p0 = at(0, 0);
  const c1 = at(0, 10);
  const c2 = at(10, 10);
  const p1 = at(10, 0);

  it("t=0 で始点、t=1 で終点に一致する", () => {
    expect(cubicBezierPoint(p0, c1, c2, p1, 0)).toEqual(p0);
    expect(cubicBezierPoint(p0, c1, c2, p1, 1)).toEqual(p1);
  });

  it("制御点を線分の 1/3・2/3 に置くと直線（中点は線分中点）", () => {
    const a = at(0, 0);
    const b = at(9, 3);
    const mid = cubicBezierPoint(a, at(3, 1), at(6, 2), b, 0.5);

    expect(mid.lateralYard).toBeCloseTo(4.5, 10);
    expect(mid.absoluteYard).toBeCloseTo(1.5, 10);
  });

  it("対称な制御点では t=0.5 が左右対称の頂点になる", () => {
    const mid = cubicBezierPoint(p0, c1, c2, p1, 0.5);

    // 左右対称配置なので中央の横位置はちょうど中点。
    expect(mid.lateralYard).toBeCloseTo(5, 10);
    // 0.125*0 + 0.375*10 + 0.375*10 + 0.125*0 = 7.5
    expect(mid.absoluteYard).toBeCloseTo(7.5, 10);
  });
});

describe("catmullRomBezierControls", () => {
  it("標準の 1/6 係数で制御点を返す", () => {
    const [c1, c2] = catmullRomBezierControls(at(0, 0), at(6, 0), at(6, 6), at(0, 6));

    // c1 = p1 + (p2 - p0)/6, c2 = p2 - (p3 - p1)/6
    expect(c1).toEqual({ lateralYard: 6 + 6 / 6, absoluteYard: 0 + 6 / 6 });
    expect(c2).toEqual({ lateralYard: 6 - -6 / 6, absoluteYard: 6 - 6 / 6 });
  });

  it("一直線上の点なら制御点も同一直線上（曲線が直線のまま）", () => {
    const [c1, c2] = catmullRomBezierControls(at(0, 0), at(1, 1), at(2, 2), at(3, 3));

    expect(c1.lateralYard).toBeCloseTo(c1.absoluteYard, 10);
    expect(c2.lateralYard).toBeCloseTo(c2.absoluteYard, 10);
  });
});

describe("sampleLinePath", () => {
  it("straight は制御点をそのまま返す（新規配列・要素は複製）", () => {
    const input = [at(0, 0), at(5, 5), at(10, 0)];

    const out = sampleLinePath(input, "straight");

    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(input[0]);
  });

  it("bezier でも制御点が 2 点以下なら直線扱い（曲げようがない）", () => {
    const input = [at(0, 0), at(10, 10)];

    expect(sampleLinePath(input, "bezier")).toEqual(input);
  });

  it("bezier は全制御点を必ず通る（waypoint を確実に経由）", () => {
    const start = at(0, 0);
    const mid = at(5, 8);
    const end = at(10, 0);

    const out = sampleLinePath([start, mid, end], "bezier", 8);

    expect(out[0]).toEqual(start);
    expect(out).toContainEqual(mid);
    expect(out.at(-1)).toEqual(end);
  });

  it("bezier の点数は 1 + samples*(区間数)", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 0), at(15, 5)], "bezier", 10);

    // 4 点 = 3 区間 → 1 + 10*3
    expect(out).toHaveLength(31);
  });

  it("連続する同一点は畳んで接線破綻を防ぐ", () => {
    const out = sampleLinePath([at(0, 0), at(0, 0), at(5, 5), at(10, 0)], "straight");

    expect(out).toEqual([at(0, 0), at(5, 5), at(10, 0)]);
  });

  it("畳んだ結果 2 点以下になれば bezier でも直線扱い", () => {
    const out = sampleLinePath([at(1, 1), at(1, 1), at(9, 9)], "bezier");

    expect(out).toEqual([at(1, 1), at(9, 9)]);
  });

  it("samplesPerSegment は 1 未満なら 1 に丸める", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 0)], "bezier", 0);

    // 2 区間 × 1 + 始点
    expect(out).toHaveLength(3);
  });

  it("一直線上の制御点は bezier でも直線上に乗る（オーバーシュートしない）", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 10)], "bezier", 6);

    for (const p of out) {
      expect(p.lateralYard).toBeCloseTo(p.absoluteYard, 9);
    }
  });

  it("入力配列を変更しない", () => {
    const input = [at(0, 0), at(5, 5), at(10, 0)];
    const snapshot = JSON.stringify(input);

    sampleLinePath(input, "bezier");

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("既定の分割数は公開定数と一致する", () => {
    const out = sampleLinePath([at(0, 0), at(5, 5), at(10, 0)], "bezier");

    expect(out).toHaveLength(1 + DEFAULT_BEZIER_SAMPLES_PER_SEGMENT * 2);
  });
});
