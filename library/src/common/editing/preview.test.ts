import { describe, expect, it } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import { MAX_WAYPOINTS_PER_LINE } from "../model/line.js";
import type { FieldPosition } from "../model/player.js";
import type { SceneData } from "./editor.js";
import { type DrawInteraction, startDrag } from "./interaction.js";
import { composePreview, computeOverlay } from "./preview.js";

const moved: FieldPosition = { lateralYard: 30, downfieldYard: 9 };

function scene(): SceneData {
  return {
    field: { zone: "middle", losYard: 50 },
    players: [player("a", 5, 0), player("b", 9, 0)],
    lines: [
      { ...line("l1", "a"), waypoints: [{ lateralYard: 6, downfieldYard: 3 }] },
      line("l2", "b"),
    ],
  };
}

function draw(points: readonly FieldPosition[]): DrawInteraction {
  return {
    type: "draw-line",
    startPlayerId: "a",
    start: { lateralYard: 5, downfieldYard: 0 },
    points,
    cursor: moved,
  };
}

describe("composePreview", () => {
  it("途中の状態が無ければ、渡した図をそのまま返す", () => {
    const data = scene();

    expect(composePreview(data, undefined)).toBe(data);
  });

  it("選手のドラッグは、その選手だけをドラッグ先に置く", () => {
    const drag = startDrag({ kind: "player", playerId: "a" }, moved, moved);

    const preview = composePreview(scene(), drag);

    expect(preview.players.map((p) => p.position)).toEqual([moved, scene().players[1]?.position]);
    expect(preview.lines).toEqual(scene().lines);
  });

  it("waypoint のドラッグは、その線のその waypoint だけを動かす", () => {
    const target = { kind: "waypoint", lineId: "l1", index: 0 } as const;
    const drag = startDrag(target, moved, moved);

    const preview = composePreview(scene(), drag);

    expect(preview.lines[0]?.waypoints).toEqual([moved]);
    expect(preview.lines[1]).toEqual(scene().lines[1]);
  });

  it("終点のドラッグは、その線の終点だけを動かす", () => {
    const drag = startDrag({ kind: "endpoint", lineId: "l2" }, moved, moved);

    const preview = composePreview(scene(), drag);

    expect(preview.lines[1]?.end).toEqual(moved);
    expect(preview.lines[0]).toEqual(scene().lines[0]);
  });

  it("ドラッグ中の対象が図から消えていれば、図をそのまま返す", () => {
    const data = scene();
    const drag = startDrag({ kind: "player", playerId: "ghost" }, moved, moved);

    expect(composePreview(data, drag)).toBe(data);
  });

  it("作図中は、打った点を waypoint、カーソルを終点にした線を末尾に足す", () => {
    const p = { lateralYard: 7, downfieldYard: 4 };

    const draft = composePreview(scene(), draw([p])).lines.at(-1);

    expect(draft).toMatchObject({ startPlayerId: "a", waypoints: [p], end: moved });
  });

  it("打点が上限に達したら、最後の打点を終点にする", () => {
    const points = Array.from({ length: MAX_WAYPOINTS_PER_LINE + 1 }, (_, i) => ({
      lateralYard: i,
      downfieldYard: 5,
    }));

    const draft = composePreview(scene(), draw(points)).lines.at(-1);

    expect(draft?.waypoints).toEqual(points.slice(0, -1));
    expect(draft?.end).toEqual(points.at(-1));
  });
});

describe("computeOverlay", () => {
  it("選手を選んでいれば、その選手を強調する", () => {
    expect(computeOverlay(scene(), { kind: "player", id: "a" })).toEqual({
      kind: "player",
      playerId: "a",
    });
  });

  it("線を選んでいれば、渡した図のその線の waypoint と終点にハンドルを置く", () => {
    const data = scene();

    expect(computeOverlay(data, { kind: "line", id: "l1" })).toEqual({
      kind: "line",
      waypointHandles: data.lines[0]?.waypoints,
      endpointHandle: data.lines[0]?.end,
    });
  });

  it("選んだ線が図に無ければ何も描かない", () => {
    expect(computeOverlay(scene(), { kind: "line", id: "ghost" })).toEqual({ kind: "none" });
  });

  it("何も選んでいなければ何も描かない", () => {
    expect(computeOverlay(scene(), null)).toEqual({ kind: "none" });
  });
});
