import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandService } from "../commands/command-service.js";
import { RemoveLineCommand } from "../commands/line-commands.js";
import { RemovePlayerCommand, UpdatePlayerCommand } from "../commands/player-commands.js";
import { UndoRedoService } from "../commands/undo-redo-service.js";
import type { Formation } from "../formations/formation.js";
import { IdFactory } from "../model/id-factory.js";
import { type Line, MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "../model/line.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import { MAX_PLAYERS, type Player } from "../model/player.js";
import { EditorController } from "./editor-controller.js";

function initialData(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [
      { id: "p-a", position: { lateralYard: 10, downfieldYard: 0 }, shape: "circle", label: "A" },
      { id: "p-b", position: { lateralYard: 20, downfieldYard: 0 }, shape: "square", label: "B" },
    ],
    lines: [
      {
        id: "l-1",
        kind: "route",
        startPlayerId: "p-a",
        waypoints: [{ lateralYard: 15, downfieldYard: 2 }],
        end: { lateralYard: 25, downfieldYard: 5 },
        interpolation: "straight",
      },
    ],
  };
}

function setup(data: PlayData = initialData()) {
  const model = new PlayModel(data);
  const commands = new CommandService(model, new UndoRedoService());
  const ids = new IdFactory();
  const controller = new EditorController(model, commands, ids);
  // どちらの通知が出たかを引数で記録する。
  const changes = vi.fn<(event: "scene" | "view") => void>();
  controller.onDidChangeScene(() => changes("scene"));
  controller.onDidChangeViewState(() => changes("view"));
  return { model, commands, ids, controller, changes };
}

describe("EditorController: 初期状態", () => {
  it("既定は select ツール・無選択・履歴空", () => {
    const { controller } = setup();

    expect(controller.getTool()).toBe("select");
    expect(controller.getSelection()).toBeNull();
    expect(controller.getViewState()).toEqual({
      tool: "select",
      selection: null,
      canUndo: false,
      canRedo: false,
      fieldZone: "middle",
      isDrawing: false,
      remainingPlayerSlots: MAX_PLAYERS - 2,
      canStartLine: true,
    });
    expect(controller.getFrame().overlay).toEqual({ kind: "none" });
    expect(controller.getSelectedPlayer()).toBeUndefined();
    expect(controller.getSelectedLine()).toBeUndefined();
  });

  it("途中の操作が無ければ、描く図は Model のスナップショットそのものになる", () => {
    const { controller, model } = setup();

    expect(controller.getFrame().scene).toBe(model.getSnapshot());
  });
});

describe("EditorController: ツール切替", () => {
  it("同じツールへの切替は何もしない", () => {
    const { controller, changes } = setup();

    controller.setTool("select");

    expect(controller.getTool()).toBe("select");
    expect(changes).not.toHaveBeenCalled();
  });

  it("別ツールへ切替えると発火し作図途中を破棄する", () => {
    const { controller, changes } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a から作図開始
    expect(controller.getViewState().isDrawing).toBe(true);
    changes.mockClear();

    controller.setTool("select");

    expect(controller.getTool()).toBe("select");
    expect(controller.getViewState().isDrawing).toBe(false);
    expect(changes.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("EditorController: 線の作図（draw-line）", () => {
  it("選手以外で始めようとしても無視する（起点は必ず選手）", () => {
    const { controller, changes } = setup();
    controller.setTool("draw-line");
    changes.mockClear(); // setTool 自体の発火を除外

    controller.pointerDown({ lateralYard: 40, downfieldYard: -10 });

    expect(controller.getViewState().isDrawing).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });

  it("選手から開始するとプレビュー線が描く図に現れカーソルに追従する", () => {
    const { controller } = setup();
    controller.setTool("draw-line");

    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a
    expect(controller.getViewState().isDrawing).toBe(true);
    let rendered = controller.getFrame().scene;
    expect(rendered.lines).toHaveLength(2);
    expect(rendered.lines[1]).toMatchObject({
      startPlayerId: "p-a",
      waypoints: [],
      end: { lateralYard: 10, downfieldYard: 0 },
    });

    controller.pointerMove({ lateralYard: 12, downfieldYard: 8 });
    rendered = controller.getFrame().scene;
    expect(rendered.lines[1]?.end).toEqual({ lateralYard: 12, downfieldYard: 8 });

    controller.pointerDown({ lateralYard: 12, downfieldYard: 8 }); // 中継点を打つ
    rendered = controller.getFrame().scene;
    expect(rendered.lines[1]?.waypoints).toEqual([{ lateralYard: 12, downfieldYard: 8 }]);
  });

  it("確定すると最後の点を終点、手前を waypoint として線を追加し選択する", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a
    controller.pointerDown({ lateralYard: 12, downfieldYard: 5 }); // waypoint
    controller.pointerDown({ lateralYard: 18, downfieldYard: 10 }); // end

    controller.commitLine();

    const lines = model.getData().lines;
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({
      id: "line-1",
      kind: "route",
      startPlayerId: "p-a",
      waypoints: [{ lateralYard: 12, downfieldYard: 5 }],
      end: { lateralYard: 18, downfieldYard: 10 },
      interpolation: "straight",
    });
    expect(controller.getSelection()).toEqual({ kind: "line", id: "line-1" });
    expect(controller.getViewState().isDrawing).toBe(false);
  });

  it("確定後は select ツールへ戻す（連続作図せず編集導線へ）", () => {
    const { controller } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a
    controller.pointerDown({ lateralYard: 18, downfieldYard: 10 }); // end

    controller.commitLine();

    expect(controller.getTool()).toBe("select");
  });

  it("直前点とほぼ同座標の打点は無視する（ダブルクリック確定の重複点を防ぐ）", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a
    controller.pointerDown({ lateralYard: 18, downfieldYard: 10 }); // end（1 度目）
    controller.pointerDown({ lateralYard: 18.1, downfieldYard: 10 }); // dblclick の 2 度目相当

    controller.commitLine();

    // 終点直上に重複 waypoint を作らない＝不可視の折れ線が生まれない。
    expect(model.getData().lines[1]).toMatchObject({
      waypoints: [],
      end: { lateralYard: 18, downfieldYard: 10 },
    });
  });

  it("点が無いまま確定すると線を追加せず作図を破棄する", () => {
    const { controller, model, changes } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // 開始のみ（点なし）
    changes.mockClear();

    controller.commitLine();

    expect(model.getData().lines).toHaveLength(1);
    expect(controller.getViewState().isDrawing).toBe(false);
    expect(changes.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("起点選手が作図中に消えたら確定しても線を追加しない", () => {
    const { controller, model, commands } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 20, downfieldYard: 0 }); // p-b から
    controller.pointerDown({ lateralYard: 22, downfieldYard: 8 }); // 点あり
    commands.execute(new RemovePlayerCommand("p-b")); // 起点が消える

    controller.commitLine();

    expect(model.getData().lines).toHaveLength(1); // l-1 のみ（p-b 起点線は無かった）
  });

  it("draw-line 中でないときの commitLine は何もしない", () => {
    const { controller } = setup();

    expect(() => controller.commitLine()).not.toThrow();

    // select ツールでドラッグ中（draw-line でない interaction）でも何もしない。
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a を掴む
    expect(() => controller.commitLine()).not.toThrow();
  });

  it("cancelInteraction で作図を破棄する／途中でなければ無反応", () => {
    const { controller, changes } = setup();
    controller.cancelInteraction(); // 何も無い → 無反応
    expect(changes).not.toHaveBeenCalled();

    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    changes.mockClear();
    controller.cancelInteraction();

    expect(controller.getViewState().isDrawing).toBe(false);
    expect(changes.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("EditorController: 選択と選手ドラッグ（select）", () => {
  it("ドラッグ中に選手が消えたら離してもコマンドを出さない", () => {
    const { controller, model, commands } = setup();
    controller.pointerDown({ lateralYard: 20, downfieldYard: 0 }); // p-b
    commands.execute(new RemovePlayerCommand("p-b"));

    controller.pointerMove({ lateralYard: 24, downfieldYard: 4 });
    expect(() => controller.pointerUp({ lateralYard: 24, downfieldYard: 4 })).not.toThrow();

    expect(model.getData().players.some((p) => p.id === "p-b")).toBe(false);
  });

  it("pointerMove は interaction が無ければ無反応、pointerUp も同様", () => {
    const { controller, changes } = setup();

    controller.pointerMove({ lateralYard: 1, downfieldYard: -49 });
    controller.pointerUp({ lateralYard: 1, downfieldYard: -49 });

    expect(changes).not.toHaveBeenCalled();
  });

  it("pointerUp は作図中（draw-line）には何もしない", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });

    controller.pointerUp({ lateralYard: 10, downfieldYard: 0 });

    expect(controller.getViewState().isDrawing).toBe(true); // まだ作図継続
    expect(model.getData().lines).toHaveLength(1);
  });

  it("線をクリックすると線が選択される", () => {
    const { controller } = setup();

    // l-1 の waypoint は線の上にある。
    controller.pointerDown({ lateralYard: 15, downfieldYard: 2 });

    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-1" });
  });
});

describe("EditorController: waypoint 編集", () => {
  it("選択中の線の waypoint をドラッグして waypoint を更新する", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 を選択（終点側）
    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-1" });

    controller.pointerDown({ lateralYard: 15, downfieldYard: 2 }); // waypoint 0 を掴む
    controller.pointerMove({ lateralYard: 16, downfieldYard: 4 });
    expect(controller.getFrame().overlay).toMatchObject({
      waypointHandles: [{ lateralYard: 16, downfieldYard: 4 }],
    });
    controller.pointerUp({ lateralYard: 16, downfieldYard: 4 });

    expect(model.findLine("l-1")?.waypoints).toEqual([{ lateralYard: 16, downfieldYard: 4 }]);
  });

  it("waypoint を掴んで動かさず離せばコマンドを出さない", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    controller.pointerDown({ lateralYard: 15, downfieldYard: 2 }); // waypoint
    controller.pointerUp({ lateralYard: 15, downfieldYard: 2 });

    expect(commands.canUndo).toBe(false);
  });

  it("waypoint ドラッグ中に線が消えたら離してもコマンドを出さない", () => {
    const { controller, commands, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    controller.pointerDown({ lateralYard: 15, downfieldYard: 2 }); // waypoint 掴む
    commands.execute(new RemoveLineCommand("l-1"));

    controller.pointerMove({ lateralYard: 16, downfieldYard: 4 });
    expect(() => controller.pointerUp({ lateralYard: 16, downfieldYard: 4 })).not.toThrow();
    expect(model.getData().lines).toHaveLength(0);
  });

  it("選択線が消えていれば waypoint 掴みをスキップして通常選択へ進む", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    commands.execute(new RemoveLineCommand("l-1")); // 選択は stale のまま

    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a を選べる

    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
  });

  it("選択線の waypoint から外れた点では掴まず通常選択にフォールバックする", () => {
    const { controller } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    controller.pointerUp({ lateralYard: 25, downfieldYard: 5 });

    // waypoint から遠いので p-a を押す。
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });

    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
  });

  it("waypoint が無い線を選択中はハンドル走査が空で素通りする", () => {
    const { controller } = setup({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "p-a", position: { lateralYard: 10, downfieldYard: 0 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-0",
          kind: "block",
          startPlayerId: "p-a",
          waypoints: [],
          end: { lateralYard: 18, downfieldYard: 0 },
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 14, downfieldYard: 0 }); // l-0 上を選択
    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-0" });

    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a へ

    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
  });

  it("waypoint と線が複数あっても、ドラッグ中の 1 点だけがオーバーレイと描く図で動く", () => {
    const { controller, model } = setup({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "p-a", position: { lateralYard: 10, downfieldYard: 0 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-2",
          kind: "route",
          startPlayerId: "p-a",
          waypoints: [
            { lateralYard: 14, downfieldYard: 2 },
            { lateralYard: 18, downfieldYard: 6 },
          ],
          end: { lateralYard: 22, downfieldYard: 10 },
          interpolation: "straight",
        },
        {
          id: "l-3",
          kind: "block",
          startPlayerId: "p-a",
          waypoints: [{ lateralYard: 8, downfieldYard: -2 }],
          end: { lateralYard: 5, downfieldYard: -5 },
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 22, downfieldYard: 10 }); // l-2 選択
    controller.pointerDown({ lateralYard: 14, downfieldYard: 2 }); // waypoint 0 掴む
    controller.pointerMove({ lateralYard: 15, downfieldYard: 3 });

    // ドラッグ中の点だけ current、他 waypoint・他線は不変。
    expect(controller.getFrame().overlay).toHaveProperty("waypointHandles", [
      { lateralYard: 15, downfieldYard: 3 },
      { lateralYard: 18, downfieldYard: 6 },
    ]);
    const rendered = controller.getFrame().scene;
    expect(rendered.lines.find((l) => l.id === "l-2")?.waypoints).toEqual([
      { lateralYard: 15, downfieldYard: 3 },
      { lateralYard: 18, downfieldYard: 6 },
    ]);
    expect(rendered.lines.find((l) => l.id === "l-3")?.waypoints).toEqual([
      { lateralYard: 8, downfieldYard: -2 },
    ]);

    // 確定すると掴んだ点だけ差し替わり、もう 1 点はそのまま残る。
    controller.pointerUp({ lateralYard: 15, downfieldYard: 3 });
    expect(model.findLine("l-2")?.waypoints).toEqual([
      { lateralYard: 15, downfieldYard: 3 },
      { lateralYard: 18, downfieldYard: 6 },
    ]);
  });
});

describe("EditorController: 終点（endpoint）編集", () => {
  it("終点を掴んでドラッグし、end だけ更新・他線/waypoint 不変・undo 可", () => {
    const { controller, model, commands } = setup({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "p-a", position: { lateralYard: 10, downfieldYard: 0 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-1",
          kind: "route",
          startPlayerId: "p-a",
          waypoints: [{ lateralYard: 15, downfieldYard: 2 }],
          end: { lateralYard: 25, downfieldYard: 5 },
          interpolation: "straight",
        },
        {
          id: "l-2",
          kind: "block",
          startPlayerId: "p-a",
          waypoints: [],
          end: { lateralYard: 5, downfieldYard: -5 },
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択

    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // 終点ハンドルを掴む
    controller.pointerMove({ lateralYard: 28, downfieldYard: 8 });
    // overlay/プレビューに drag-endpoint が反映され、他線は不変。
    expect(controller.getFrame().overlay).toHaveProperty("endpointHandle", {
      lateralYard: 28,
      downfieldYard: 8,
    });
    const rendered = controller.getFrame().scene;
    expect(rendered.lines.find((l) => l.id === "l-1")?.end).toEqual({
      lateralYard: 28,
      downfieldYard: 8,
    });
    expect(rendered.lines.find((l) => l.id === "l-2")?.end).toEqual({
      lateralYard: 5,
      downfieldYard: -5,
    });
    controller.pointerUp({ lateralYard: 28, downfieldYard: 8 });

    expect(model.findLine("l-1")?.end).toEqual({ lateralYard: 28, downfieldYard: 8 });
    expect(model.findLine("l-1")?.waypoints).toEqual([{ lateralYard: 15, downfieldYard: 2 }]);

    commands.undo();
    expect(model.findLine("l-1")?.end).toEqual({ lateralYard: 25, downfieldYard: 5 });
  });

  it("終点を掴んで動かさず離せばコマンドを出さない", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // 終点を掴む
    controller.pointerUp({ lateralYard: 25, downfieldYard: 5 });

    expect(commands.canUndo).toBe(false);
  });

  it("終点ドラッグ中に線が消えたら離してもコマンドを出さない", () => {
    const { controller, commands, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // 終点を掴む
    commands.execute(new RemoveLineCommand("l-1"));

    controller.pointerMove({ lateralYard: 28, downfieldYard: 8 });
    expect(() => controller.pointerUp({ lateralYard: 28, downfieldYard: 8 })).not.toThrow();
    expect(model.getData().lines).toHaveLength(0);
  });

  it("終点と waypoint が近接でも終点を優先して掴む", () => {
    const { controller, model } = setup({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "p-a", position: { lateralYard: 10, downfieldYard: 0 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-x",
          kind: "route",
          startPlayerId: "p-a",
          waypoints: [{ lateralYard: 20, downfieldYard: 10 }],
          end: { lateralYard: 20.2, downfieldYard: 10 }, // waypoint とほぼ同座標
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 15, downfieldYard: 5 }); // l-x 上を選択
    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-x" });

    controller.pointerDown({ lateralYard: 20.2, downfieldYard: 10 }); // 重なり領域を掴む
    controller.pointerMove({ lateralYard: 30, downfieldYard: 15 });
    controller.pointerUp({ lateralYard: 30, downfieldYard: 15 });

    // 終点が動き、waypoint は残る（先端ドラッグが waypoint に奪われない）。
    expect(model.findLine("l-x")?.end).toEqual({ lateralYard: 30, downfieldYard: 15 });
    expect(model.findLine("l-x")?.waypoints).toEqual([{ lateralYard: 20, downfieldYard: 10 }]);
  });
});

describe("EditorController: アクション", () => {
  it("deleteSelection: 線を削除し選択解除", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1
    controller.deleteSelection();

    expect(model.getData().lines).toHaveLength(0);
    expect(controller.getSelection()).toBeNull();
  });

  it("deleteSelection: 線が既に消えていればコマンドを出さない", () => {
    const { controller, commands, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    commands.execute(new RemoveLineCommand("l-1"));

    expect(() => controller.deleteSelection()).not.toThrow();
    expect(model.getData().lines).toHaveLength(0);
  });

  it("updateSelectedLine: 線選択時のみ反映、それ以外は無視", () => {
    const { controller, model, commands } = setup();
    controller.updateSelectedLine({ kind: "block" }); // 無選択 → 無視

    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // 選手選択
    controller.pointerUp({ lateralYard: 10, downfieldYard: 0 });
    controller.updateSelectedLine({ kind: "block" }); // 選手選択 → 無視

    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    controller.updateSelectedLine({ kind: "motion", interpolation: "bezier", thickness: 4 });
    expect(model.findLine("l-1")).toMatchObject({
      kind: "motion",
      interpolation: "bezier",
      thickness: 4,
    });

    commands.execute(new RemoveLineCommand("l-1")); // stale 選択
    expect(() => controller.updateSelectedLine({ kind: "route" })).not.toThrow();
  });

  it("作図の途中で今と同じゾーンを選び直しても、作図は続く", () => {
    const { controller } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a

    controller.setFieldZone("middle");

    expect(controller.getViewState().isDrawing).toBe(true);
  });

  it("setFieldZone: 同値は無視、変更はコマンド化して undo 可能", () => {
    const { controller, model, commands } = setup();
    controller.setFieldZone("middle"); // 同値
    expect(commands.canUndo).toBe(false);

    controller.setFieldZone("redzone");
    expect(model.getFieldZone()).toBe("redzone");
    expect(commands.canUndo).toBe(true);
  });

  it("undo / redo を委譲し履歴を行き来する", () => {
    const { controller, model } = setup();
    controller.setTool("add-player");
    controller.pointerDown({ lateralYard: 5, downfieldYard: -10 });
    expect(model.getData().players).toHaveLength(3);

    controller.undo();
    expect(model.getData().players).toHaveLength(2);
    expect(controller.getViewState().canRedo).toBe(true);

    controller.redo();
    expect(model.getData().players).toHaveLength(3);
    expect(controller.getViewState().canUndo).toBe(true);
  });
});

describe("EditorController: loadFormation（フォーメーション読込）", () => {
  const formation: Formation = {
    id: "x",
    name: "テスト隊形",
    side: "offense",
    players: [
      { position: { lateralYard: 30, downfieldYard: -5 }, shape: "circle", label: "A" },
      {
        position: { lateralYard: 32, downfieldYard: -5 },
        shape: "square",
        label: "B",
        color: "#c62828",
      },
    ],
  };

  it("既存選手を保ち衝突しない id で追記、選択解除、Undo で取り消せる", () => {
    const { controller, model, commands } = setup();
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a 選択
    controller.pointerUp({ lateralYard: 10, downfieldYard: 0 });

    controller.loadFormation(formation);

    const players = model.getData().players;
    expect(players.map((p) => p.id)).toEqual(["p-a", "p-b", "player-1", "player-2"]);
    expect(players[2]).toEqual({
      id: "player-1",
      position: { lateralYard: 30, downfieldYard: -5 },
      shape: "circle",
      label: "A",
    });
    expect(players[3]?.color).toBe("#c62828"); // 色ありテンプレートは色を保つ
    expect(controller.getSelection()).toBeNull(); // 読込で選択解除
    expect(commands.canUndo).toBe(true);

    controller.undo();
    expect(model.getData().players.map((p) => p.id)).toEqual(["p-a", "p-b"]);
  });

  it("既存に同形式の id があっても IdFactory が衝突を避ける", () => {
    const { controller, model } = setup({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        {
          id: "player-1",
          position: { lateralYard: 1, downfieldYard: 0 },
          shape: "circle",
          label: "X",
        },
      ],
      lines: [],
    });

    controller.loadFormation(formation);

    const ids = model.getData().players.map((p) => p.id);
    expect(ids).toEqual(["player-1", "player-2", "player-3"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("選手が 1 人もいない隊形を読んでも、選択は外れない", () => {
    const { controller } = setup();
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a 選択
    controller.pointerUp({ lateralYard: 10, downfieldYard: 0 });

    controller.loadFormation({ id: "empty", name: "空", side: "offense", players: [] });

    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
  });

  it("選手を置いた読み込みは true を返す", () => {
    const { controller } = setup();

    expect(controller.loadFormation(formation)).toBe(true);
  });

  it("選手が 1 人もいない隊形の読み込みは false を返す", () => {
    const { controller } = setup();
    const empty: Formation = { id: "empty", name: "空", side: "offense", players: [] };

    expect(controller.loadFormation(empty)).toBe(false);
  });

  it("配置可能な選手が無ければ no-op（コマンドも発火も出ない）", () => {
    const { controller, model, commands, changes } = setup();
    changes.mockClear();

    controller.loadFormation({ id: "empty", name: "空", side: "offense", players: [] });

    expect(model.getData().players.map((p) => p.id)).toEqual(["p-a", "p-b"]);
    expect(commands.canUndo).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });
});

describe("EditorController: オーバーレイと選択中の要素", () => {
  it("線選択でハンドル、消えていればハンドル空", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1

    expect(controller.getFrame().overlay).toEqual({
      kind: "line",
      waypointHandles: [{ lateralYard: 15, downfieldYard: 2 }],
      endpointHandle: { lateralYard: 25, downfieldYard: 5 },
    });
    expect(controller.getSelectedLine()).toMatchObject({ id: "l-1" });

    commands.execute(new RemoveLineCommand("l-1")); // stale 選択
    expect(controller.getFrame().overlay).toEqual({ kind: "none" });
    expect(controller.getSelectedLine()).toBeUndefined();
  });
});

describe("EditorController: ライフサイクル", () => {
  it("dispose 後は Model 変更で再描画が走らない", () => {
    const { controller, commands, changes } = setup();
    controller.dispose();
    changes.mockClear();

    commands.execute(new RemovePlayerCommand("p-b"));

    expect(changes).not.toHaveBeenCalled();
  });
});

describe("EditorController: 作図中の表示状態", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("作図中は viewState.isDrawing が true になる", () => {
    const { controller } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });

    expect(controller.getViewState().isDrawing).toBe(true);
  });
});

describe("EditorController: 通知の時点の履歴状態", () => {
  it("ドラッグ確定の通知の中で読む canUndo は、確定後の値になっている", () => {
    const { controller, changes } = setup();
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.pointerMove({ lateralYard: 12, downfieldYard: 2 });
    const seen: boolean[] = [];
    changes.mockImplementation(() => seen.push(controller.getViewState().canUndo));

    controller.pointerUp({ lateralYard: 12, downfieldYard: 2 });

    expect(seen).toEqual([true, true]);
  });

  it("Undo の通知の中で読む canRedo は、Undo 後の値になっている", () => {
    const { controller, changes } = setup();
    controller.setFieldZone("redzone");
    const seen: boolean[] = [];
    changes.mockImplementation(() => seen.push(controller.getViewState().canRedo));

    controller.undo();

    expect(seen).toEqual([true, true]);
  });

  it("戻す履歴が無い Undo / Redo は通知しない", () => {
    const { controller, changes } = setup();

    controller.undo();
    controller.redo();

    expect(changes).not.toHaveBeenCalled();
  });
});

describe("EditorController: 長さ 0 の線を作らない", () => {
  it("作図を始めた選手の上でダブルクリックしても線を確定しない", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a から作図開始

    // ダブルクリックは pointerdown を 2 回出してから dblclick になる。
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.commitLine();

    expect(model.getData().lines.map((l) => l.id)).toEqual(["l-1"]);
    expect(controller.getViewState().isDrawing).toBe(false);
  });

  it("起点の選手が打点の上へ動いて全長が 0 に近くなった線は確定しない", () => {
    const { controller, model, commands } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.pointerDown({ lateralYard: 14, downfieldYard: 0 });
    commands.execute(
      new UpdatePlayerCommand("p-a", { position: { lateralYard: 14, downfieldYard: 0 } }),
    );

    controller.commitLine();

    expect(model.getData().lines.map((l) => l.id)).toEqual(["l-1"]);
    expect(controller.getViewState().isDrawing).toBe(false);
  });
});

describe("EditorController: 途中状態のまま別の操作をしたとき", () => {
  it("作図中の Undo は最後の打点だけを取り消し、履歴には触れない", () => {
    const { controller, model, commands } = setup();
    controller.setFieldZone("redzone");
    controller.setFieldZone("middle");
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.pointerDown({ lateralYard: 14, downfieldYard: 0 });
    controller.pointerDown({ lateralYard: 18, downfieldYard: 0 });

    controller.undo();
    controller.commitLine();

    const added = model.getData().lines.find((l) => l.id !== "l-1");
    expect(added).toMatchObject({ waypoints: [], end: { lateralYard: 14, downfieldYard: 0 } });
    expect(model.getFieldZone()).toBe("middle");
    expect(commands.canRedo).toBe(false);
  });

  it("作図中に打点が無いときの Undo は作図をやめ、履歴には触れない", () => {
    const { controller, model } = setup();
    controller.setFieldZone("redzone");
    controller.setFieldZone("middle");
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.pointerDown({ lateralYard: 14, downfieldYard: 0 });

    controller.undo();
    expect(controller.getViewState().isDrawing).toBe(true);
    controller.undo();

    expect(controller.getViewState().isDrawing).toBe(false);
    expect(model.getFieldZone()).toBe("middle");
  });

  it("ドラッグ中の Undo はドラッグを捨ててから履歴を戻す", () => {
    const { controller, model } = setup();
    controller.setFieldZone("redzone");
    controller.setFieldZone("middle");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.pointerMove({ lateralYard: 12, downfieldYard: 2 });

    controller.undo();
    controller.pointerUp({ lateralYard: 12, downfieldYard: 2 });

    expect(model.getFieldZone()).toBe("redzone");
    expect(model.findPlayer("p-a")?.position).toEqual({ lateralYard: 10, downfieldYard: 0 });
  });

  it("作図中の Redo は作図をやめてから履歴を進める", () => {
    const { controller, model } = setup();
    controller.setFieldZone("redzone");
    controller.undo();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });

    controller.redo();

    expect(controller.getViewState().isDrawing).toBe(false);
    expect(model.getFieldZone()).toBe("redzone");
  });

  it("ゾーン切替とフォーメーション読込は、作図を捨ててから行う", () => {
    const { controller } = setup();
    const formation: Formation = {
      id: "one",
      name: "1 人",
      side: "offense",
      players: [{ position: { lateralYard: 30, downfieldYard: -5 }, shape: "circle", label: "Q" }],
    };
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });

    controller.setFieldZone("redzone");
    expect(controller.getViewState().isDrawing).toBe(false);

    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.loadFormation(formation);
    expect(controller.getViewState().isDrawing).toBe(false);
  });
});

describe("EditorController: ゾーン窓の外の位置", () => {
  it("作図の打点と追従カーソルは窓の中に寄せる", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    controller.pointerMove({ lateralYard: 99, downfieldYard: 0 });
    expect(controller.getFrame().scene.lines.at(-1)?.end).toEqual({
      lateralYard: 160 / 3,
      downfieldYard: 0,
    });

    controller.pointerDown({ lateralYard: 10, downfieldYard: 49 });
    controller.commitLine();

    expect(model.getData().lines.at(-1)?.end).toEqual({ lateralYard: 10, downfieldYard: 15 });
  });
});

describe("EditorController: 消えた対象の選択", () => {
  it("選択した線が消えたら、viewState は無選択を返す", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択
    expect(controller.getViewState().selection).toEqual({ kind: "line", id: "l-1" });

    commands.execute(new RemoveLineCommand("l-1"));

    expect(controller.getViewState().selection).toBeNull();
  });
});

describe("EditorController: 値が変わらないパッチ", () => {
  it("線の現在値と同じパッチはコマンドを積まない", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択

    controller.updateSelectedLine({ kind: "route", interpolation: "straight" });

    expect(commands.canUndo).toBe(false);
  });

  it("指定したキーのうち 1 つでも値が違えば適用する", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 選択

    controller.updateSelectedLine({ kind: "route", interpolation: "bezier" });

    expect(model.findLine("l-1")?.interpolation).toBe("bezier");
  });
});

describe("EditorController: 件数の上限", () => {
  function manyPlayers(count: number): Player[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `m-${i}`,
      position: { lateralYard: 1 + (i % 50), downfieldYard: -10 },
      shape: "circle",
      label: "",
    }));
  }

  function withPlayers(count: number): PlayData {
    return { ...initialData(), players: manyPlayers(count), lines: [] };
  }

  const pair: Formation = {
    id: "pair",
    name: "2 人",
    side: "offense",
    players: [
      { position: { lateralYard: 30, downfieldYard: -5 }, shape: "circle", label: "A" },
      { position: { lateralYard: 32, downfieldYard: -5 }, shape: "circle", label: "B" },
    ],
  };

  it("読み込むと MAX_PLAYERS 人を超えるフォーメーションは、1 人も置かない", () => {
    const { controller, model, commands } = setup(withPlayers(MAX_PLAYERS - 1));

    controller.loadFormation(pair);

    expect(model.getSnapshot().players).toHaveLength(MAX_PLAYERS - 1);
    expect(commands.canUndo).toBe(false);
  });

  it("読み込むと MAX_PLAYERS 人を超えるフォーメーションは false を返す", () => {
    const { controller } = setup(withPlayers(MAX_PLAYERS - 1));

    expect(controller.loadFormation(pair)).toBe(false);
  });

  it("読み込んでちょうど MAX_PLAYERS 人になるフォーメーションは置く", () => {
    const { controller, model } = setup(withPlayers(MAX_PLAYERS - 2));

    controller.loadFormation(pair);

    expect(model.getSnapshot().players).toHaveLength(MAX_PLAYERS);
  });

  it("線が MAX_LINES 本あると、選手をクリックしても作図を始めない", () => {
    const base = initialData();
    const lines: Line[] = Array.from({ length: MAX_LINES }, (_, i) => ({
      id: `m-${i}`,
      kind: "route",
      startPlayerId: "p-b",
      waypoints: [],
      end: { lateralYard: 20, downfieldYard: 5 },
      interpolation: "straight",
    }));
    const { controller } = setup({ ...base, lines });
    controller.setTool("draw-line");

    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });

    expect(controller.getViewState().isDrawing).toBe(false);
    expect(controller.getViewState().canStartLine).toBe(false);
  });

  it("作図では waypoint の上限を超えて打点せず、上限を超えた打点は線に入らない", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    // 最後の点は終点になるので、上限より 2 つ多く打つと 1 つだけ溢れる。
    for (let i = 1; i <= MAX_WAYPOINTS_PER_LINE + 2; i++) {
      controller.pointerDown({ lateralYard: 10 + i, downfieldYard: 3 });
    }

    controller.commitLine();

    const added = model.getSnapshot().lines.find((l) => l.id !== "l-1");
    expect(added?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
    expect(added?.end).toEqual({ lateralYard: 10 + MAX_WAYPOINTS_PER_LINE + 1, downfieldYard: 3 });
  });

  it("打点が上限に達したら、プレビューはカーソルではなく最後の打点を終点に描く", () => {
    const { controller } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 });
    for (let i = 1; i <= MAX_WAYPOINTS_PER_LINE + 1; i++) {
      controller.pointerDown({ lateralYard: 10 + i, downfieldYard: 3 });
    }

    controller.pointerMove({ lateralYard: 50, downfieldYard: 10 });

    const draft = controller.getFrame().scene.lines.at(-1);
    expect(draft?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
    expect(draft?.end).toEqual({ lateralYard: 10 + MAX_WAYPOINTS_PER_LINE + 1, downfieldYard: 3 });
  });
});

describe("EditorController: 履歴の通知", () => {
  it("controller を通さずに編集しても、履歴が変わったあとに表示状態を通知する", () => {
    const { commands, changes } = setup();

    commands.execute(new RemoveLineCommand("l-1"));

    // Model の通知の時点では履歴がまだ変わっていないので、表示状態は履歴の通知で出る。
    expect(changes.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("EditorController: 中心から外れた位置を掴んだドラッグ", () => {
  it("waypoint は掴んだ点とポインタのずれを保って動く", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 を選択
    controller.pointerDown({ lateralYard: 15.5, downfieldYard: 2.25 }); // waypoint 0 の中心から外れた点

    controller.pointerMove({ lateralYard: 18.5, downfieldYard: 4.25 });
    const handle = controller.getFrame().overlay;
    controller.pointerUp({ lateralYard: 18.5, downfieldYard: 4.25 });

    expect(handle).toMatchObject({ waypointHandles: [{ lateralYard: 18, downfieldYard: 4 }] });
    expect(model.findLine("l-1")?.waypoints).toEqual([{ lateralYard: 18, downfieldYard: 4 }]);
  });

  it("終点は掴んだ点とポインタのずれを保って動く", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 25, downfieldYard: 5 }); // l-1 を選択
    controller.pointerDown({ lateralYard: 25.5, downfieldYard: 5.25 }); // 終点の中心から外れた点

    controller.pointerMove({ lateralYard: 28.5, downfieldYard: 8.25 });
    const handle = controller.getFrame().overlay;
    controller.pointerUp({ lateralYard: 28.5, downfieldYard: 8.25 });

    expect(handle).toMatchObject({ endpointHandle: { lateralYard: 28, downfieldYard: 8 } });
    expect(model.findLine("l-1")?.end).toEqual({ lateralYard: 28, downfieldYard: 8 });
  });
});

describe("EditorController: 描く図と表示状態の通知", () => {
  it("ドラッグ中の移動は描く図の通知だけを出し、表示状態の通知は出さない", () => {
    const { controller, changes } = setup();
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a を掴む
    changes.mockClear();

    controller.pointerMove({ lateralYard: 12, downfieldYard: 2 });
    controller.pointerMove({ lateralYard: 14, downfieldYard: 4 });

    expect(changes.mock.calls).toEqual([["scene"], ["scene"]]);
  });

  it("線の確定で Model、履歴、ツール、選択が変わっても、通知はそれぞれ 1 回にまとめる", () => {
    const { controller, changes } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, downfieldYard: 0 }); // p-a
    controller.pointerDown({ lateralYard: 18, downfieldYard: 10 });
    changes.mockClear();

    controller.commitLine();

    expect(changes.mock.calls).toEqual([["scene"], ["view"]]);
  });
});
