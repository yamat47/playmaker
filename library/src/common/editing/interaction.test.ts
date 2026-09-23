import { describe, expect, it } from "vitest";
import { player } from "../../test-support/fixtures.js";
import {
  addDraftPoint,
  committableDraft,
  dragPosition,
  MAX_DRAFT_POINTS,
  startDrag,
  startDrawing,
} from "./interaction.js";

describe("startDrag と dragPosition", () => {
  it("掴んだ点と対象の位置のずれを保って、ポインタの動きに付いていく", () => {
    const drag = startDrag(
      { kind: "player", playerId: "a" },
      { lateralYard: 10, downfieldYard: 0 },
      { lateralYard: 10.5, downfieldYard: 0.25 },
    );

    expect(dragPosition(drag, { lateralYard: 14.5, downfieldYard: 3.25 })).toEqual({
      lateralYard: 14,
      downfieldYard: 3,
    });
  });

  it("掴んだ直後の位置は対象の元の位置", () => {
    const origin = { lateralYard: 10, downfieldYard: 0 };

    const drag = startDrag({ kind: "endpoint", lineId: "l" }, origin, {
      lateralYard: 11,
      downfieldYard: 1,
    });

    expect(drag.current).toEqual(origin);
  });
});

describe("addDraftPoint", () => {
  const start = startDrawing(player("a", 10, 0));

  it("直前の点から離れた位置なら点を打ち、カーソルもそこへ進める", () => {
    const point = { lateralYard: 12, downfieldYard: 3 };

    expect(addDraftPoint(start, point)).toMatchObject({ points: [point], cursor: point });
  });

  it("直前の点（まだ無ければ起点）のすぐ近くなら、打たずにカーソルだけ進める", () => {
    const near = { lateralYard: 10.25, downfieldYard: 0 };

    expect(addDraftPoint(start, near)).toMatchObject({ points: [], cursor: near });
  });

  it("打てる点の上限に達していたら打たない", () => {
    const points = Array.from({ length: MAX_DRAFT_POINTS }, (_, i) => ({
      lateralYard: i,
      downfieldYard: 5,
    }));

    const next = addDraftPoint({ ...start, points }, { lateralYard: 50, downfieldYard: 9 });

    expect(next.points).toHaveLength(MAX_DRAFT_POINTS);
  });
});

describe("committableDraft", () => {
  const origin = { lateralYard: 10, downfieldYard: 0 };
  const start = startDrawing(player("a", 10, 0));

  it("起点からの全長が十分あれば、waypoint と終点を返す", () => {
    const a = { lateralYard: 12, downfieldYard: 3 };
    const b = { lateralYard: 14, downfieldYard: 6 };

    expect(committableDraft({ ...start, points: [a, b] }, origin)).toEqual({
      waypoints: [a],
      end: b,
    });
  });

  it("起点の真上に点を重ねただけなら undefined", () => {
    const draw = { ...start, points: [{ lateralYard: 10.25, downfieldYard: 0 }] };

    expect(committableDraft(draw, origin)).toBeUndefined();
  });

  it("点が無ければ undefined", () => {
    expect(committableDraft(start, origin)).toBeUndefined();
  });
});
