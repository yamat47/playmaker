import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandService } from "../commands/command-service.js";
import type { Formation } from "../formations/formation.js";
import { RemoveLineCommand, RemovePlayerCommand } from "../index.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import { UndoRedoService } from "../undoRedo/undo-redo-service.js";
import { EditorController } from "./editor-controller.js";
import { IdFactory } from "./id-factory.js";

function initialData(): PlayData {
  return {
    version: 1,
    field: { zone: "middle" },
    players: [
      { id: "p-a", position: { lateralYard: 10, absoluteYard: 50 }, shape: "circle", label: "A" },
      { id: "p-b", position: { lateralYard: 20, absoluteYard: 50 }, shape: "square", label: "B" },
    ],
    lines: [
      {
        id: "l-1",
        kind: "route",
        startPlayerId: "p-a",
        waypoints: [{ lateralYard: 15, absoluteYard: 52 }],
        end: { lateralYard: 25, absoluteYard: 55 },
        interpolation: "straight",
      },
    ],
  };
}

function setup(data: PlayData = initialData()) {
  const model = new PlayModel(data);
  const undoRedo = new UndoRedoService(model);
  const commands = new CommandService(model, undoRedo);
  const ids = new IdFactory();
  const controller = new EditorController(model, commands, undoRedo, ids);
  const changes = vi.fn();
  controller.onDidChange(changes);
  return { model, undoRedo, commands, ids, controller, changes };
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
      drawing: false,
    });
    expect(controller.getOverlay()).toEqual({ waypointHandles: [] });
    expect(controller.getSelectedPlayer()).toBeUndefined();
    expect(controller.getSelectedLine()).toBeUndefined();
  });

  it("interaction が無ければ getRenderModel は Model のスナップショットそのまま", () => {
    const { controller, model } = setup();

    const rendered = controller.getRenderModel();

    expect(rendered).toEqual(model.getData());
    // 返り値を書き換えても Model に波及しない（スナップショット）。
    rendered.players.push({
      id: "x",
      position: { lateralYard: 0, absoluteYard: 0 },
      shape: "circle",
      label: "",
    });
    expect(model.getData().players).toHaveLength(2);
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
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a から作図開始
    expect(controller.getViewState().drawing).toBe(true);
    changes.mockClear();

    controller.setTool("select");

    expect(controller.getTool()).toBe("select");
    expect(controller.getViewState().drawing).toBe(false);
    expect(changes).toHaveBeenCalledOnce();
  });
});

describe("EditorController: 選手の追加（add-player）", () => {
  it("空白クリックで選手を追加し、それを選択する", () => {
    const { controller, model } = setup({
      version: 1,
      field: { zone: "middle" },
      players: [],
      lines: [],
    });
    controller.setTool("add-player");

    controller.pointerDown({ lateralYard: 30, absoluteYard: 45 });

    const players = model.getData().players;
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      id: "player-1",
      position: { lateralYard: 30, absoluteYard: 45 },
      shape: "circle",
      label: "",
    });
    expect(controller.getSelection()).toEqual({ kind: "player", id: "player-1" });
    expect(controller.getViewState().canUndo).toBe(true);
  });
});

describe("EditorController: 線の作図（draw-line）", () => {
  it("選手以外で始めようとしても無視する（起点は必ず選手）", () => {
    const { controller, changes } = setup();
    controller.setTool("draw-line");
    changes.mockClear(); // setTool 自体の発火を除外

    controller.pointerDown({ lateralYard: 40, absoluteYard: 40 });

    expect(controller.getViewState().drawing).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });

  it("選手から開始するとプレビュー線が getRenderModel に現れカーソルに追従する", () => {
    const { controller } = setup();
    controller.setTool("draw-line");

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a
    expect(controller.getViewState().drawing).toBe(true);
    let rendered = controller.getRenderModel();
    expect(rendered.lines).toHaveLength(2);
    expect(rendered.lines[1]).toMatchObject({
      startPlayerId: "p-a",
      waypoints: [],
      end: { lateralYard: 10, absoluteYard: 50 },
    });

    controller.pointerMove({ lateralYard: 12, absoluteYard: 58 });
    rendered = controller.getRenderModel();
    expect(rendered.lines[1]?.end).toEqual({ lateralYard: 12, absoluteYard: 58 });

    controller.pointerDown({ lateralYard: 12, absoluteYard: 58 }); // 中継点を打つ
    rendered = controller.getRenderModel();
    expect(rendered.lines[1]?.waypoints).toEqual([{ lateralYard: 12, absoluteYard: 58 }]);
  });

  it("確定すると最後の点を終点、手前を waypoint として線を追加し選択する", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a
    controller.pointerDown({ lateralYard: 12, absoluteYard: 55 }); // waypoint
    controller.pointerDown({ lateralYard: 18, absoluteYard: 60 }); // end

    controller.commitLine();

    const lines = model.getData().lines;
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({
      id: "line-1",
      kind: "route",
      startPlayerId: "p-a",
      waypoints: [{ lateralYard: 12, absoluteYard: 55 }],
      end: { lateralYard: 18, absoluteYard: 60 },
      interpolation: "straight",
    });
    expect(controller.getSelection()).toEqual({ kind: "line", id: "line-1" });
    expect(controller.getViewState().drawing).toBe(false);
  });

  it("確定後は select ツールへ戻す（連続作図せず編集導線へ）", () => {
    const { controller } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a
    controller.pointerDown({ lateralYard: 18, absoluteYard: 60 }); // end

    controller.commitLine();

    expect(controller.getTool()).toBe("select");
  });

  it("直前点とほぼ同座標の打点は無視する（ダブルクリック確定の重複点を防ぐ）", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a
    controller.pointerDown({ lateralYard: 18, absoluteYard: 60 }); // end（1 度目）
    controller.pointerDown({ lateralYard: 18.1, absoluteYard: 60 }); // dblclick の 2 度目相当

    controller.commitLine();

    // 終点直上に重複 waypoint を作らない＝不可視の折れ線が生まれない。
    expect(model.getData().lines[1]).toMatchObject({
      waypoints: [],
      end: { lateralYard: 18, absoluteYard: 60 },
    });
  });

  it("点が無いまま確定すると線を追加せず作図を破棄する", () => {
    const { controller, model, changes } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // 開始のみ（点なし）
    changes.mockClear();

    controller.commitLine();

    expect(model.getData().lines).toHaveLength(1);
    expect(controller.getViewState().drawing).toBe(false);
    expect(changes).toHaveBeenCalledOnce();
  });

  it("起点選手が作図中に消えたら確定しても線を追加しない", () => {
    const { controller, model, commands } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 20, absoluteYard: 50 }); // p-b から
    controller.pointerDown({ lateralYard: 22, absoluteYard: 58 }); // 点あり
    commands.execute(new RemovePlayerCommand("p-b")); // 起点が消える

    controller.commitLine();

    expect(model.getData().lines).toHaveLength(1); // l-1 のみ（p-b 起点線は無かった）
  });

  it("draw-line 中でないときの commitLine は何もしない", () => {
    const { controller } = setup();

    expect(() => controller.commitLine()).not.toThrow();

    // select ツールでドラッグ中（draw-line でない interaction）でも何もしない。
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a を掴む
    expect(() => controller.commitLine()).not.toThrow();
  });

  it("cancelInteraction で作図を破棄する／途中でなければ無反応", () => {
    const { controller, changes } = setup();
    controller.cancelInteraction(); // 何も無い → 無反応
    expect(changes).not.toHaveBeenCalled();

    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 });
    changes.mockClear();
    controller.cancelInteraction();

    expect(controller.getViewState().drawing).toBe(false);
    expect(changes).toHaveBeenCalledOnce();
  });
});

describe("EditorController: 選択と選手ドラッグ（select）", () => {
  it("選手クリックで選択、動かさず離せばコマンドは出ない", () => {
    const { controller, undoRedo } = setup();

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a 中心
    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });

    expect(undoRedo.canUndo).toBe(false);
    expect(controller.getSelectedPlayer()).toMatchObject({ id: "p-a" });
  });

  it("ドラッグするとプレビューが追従し、離すと MovePlayerCommand を実行する", () => {
    const { controller, model } = setup();

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a（offset 0）
    controller.pointerMove({ lateralYard: 14, absoluteYard: 53 });
    const preview = controller.getRenderModel().players.find((p) => p.id === "p-a");
    expect(preview?.position).toEqual({ lateralYard: 14, absoluteYard: 53 });

    controller.pointerUp({ lateralYard: 14, absoluteYard: 53 });

    expect(model.findPlayer("p-a")?.position).toEqual({ lateralYard: 14, absoluteYard: 53 });
    expect(model.getData().lines[0]?.startPlayerId).toBe("p-a"); // 線は起点選手に追従
  });

  it("ドラッグ中に選手が消えたら離してもコマンドを出さない", () => {
    const { controller, model, commands } = setup();
    controller.pointerDown({ lateralYard: 20, absoluteYard: 50 }); // p-b
    commands.execute(new RemovePlayerCommand("p-b"));

    controller.pointerMove({ lateralYard: 24, absoluteYard: 54 });
    expect(() => controller.pointerUp({ lateralYard: 24, absoluteYard: 54 })).not.toThrow();

    expect(model.getData().players.some((p) => p.id === "p-b")).toBe(false);
  });

  it("pointerMove は interaction が無ければ無反応、pointerUp も同様", () => {
    const { controller, changes } = setup();

    controller.pointerMove({ lateralYard: 1, absoluteYard: 1 });
    controller.pointerUp({ lateralYard: 1, absoluteYard: 1 });

    expect(changes).not.toHaveBeenCalled();
  });

  it("pointerUp は作図中（draw-line）には何もしない", () => {
    const { controller, model } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 });

    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });

    expect(controller.getViewState().drawing).toBe(true); // まだ作図継続
    expect(model.getData().lines).toHaveLength(1);
  });

  it("空白クリックで選択解除、無選択での空白クリックは発火しない", () => {
    const { controller, changes } = setup();
    // 無選択で空白 → setSelection(null) は同値で発火しない。
    controller.pointerDown({ lateralYard: 45, absoluteYard: 40 });
    controller.pointerUp({ lateralYard: 45, absoluteYard: 40 });
    expect(changes).not.toHaveBeenCalled();

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a 選択
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });
    controller.pointerDown({ lateralYard: 45, absoluteYard: 40 }); // 空白 → 解除
    expect(controller.getSelection()).toBeNull();
  });

  it("線をクリックすると線が選択される", () => {
    const { controller } = setup();

    controller.pointerDown({ lateralYard: 15, absoluteYard: 52 }); // l-1 の waypoint 上＝線上

    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-1" });
  });

  it("同じ選手の再選択や別対象選択で sameSelection を網羅する", () => {
    const { controller } = setup();
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // 同じ p-a（同値）
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });
    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });

    controller.pointerDown({ lateralYard: 20, absoluteYard: 50 }); // p-b（別 id）
    controller.pointerUp({ lateralYard: 20, absoluteYard: 50 });
    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-b" });

    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 終点付近（別 kind）
    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-1" });
  });
});

describe("EditorController: waypoint 編集", () => {
  it("選択中の線の waypoint をドラッグして SetLineWaypointsCommand を実行する", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 を選択（終点側）
    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-1" });

    controller.pointerDown({ lateralYard: 15, absoluteYard: 52 }); // waypoint 0 を掴む
    controller.pointerMove({ lateralYard: 16, absoluteYard: 54 });
    const handles = controller.getOverlay().waypointHandles;
    expect(handles).toEqual([{ lateralYard: 16, absoluteYard: 54 }]);
    controller.pointerUp({ lateralYard: 16, absoluteYard: 54 });

    expect(model.findLine("l-1")?.waypoints).toEqual([{ lateralYard: 16, absoluteYard: 54 }]);
  });

  it("waypoint を掴んで動かさず離せばコマンドを出さない", () => {
    const { controller, undoRedo } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    controller.pointerDown({ lateralYard: 15, absoluteYard: 52 }); // waypoint
    controller.pointerUp({ lateralYard: 15, absoluteYard: 52 });

    expect(undoRedo.canUndo).toBe(false);
  });

  it("waypoint ドラッグ中に線が消えたら離してもコマンドを出さない", () => {
    const { controller, commands, model } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    controller.pointerDown({ lateralYard: 15, absoluteYard: 52 }); // waypoint 掴む
    commands.execute(new RemoveLineCommand("l-1"));

    controller.pointerMove({ lateralYard: 16, absoluteYard: 54 });
    expect(() => controller.pointerUp({ lateralYard: 16, absoluteYard: 54 })).not.toThrow();
    expect(model.getData().lines).toHaveLength(0);
  });

  it("選択線が消えていれば waypoint 掴みをスキップして通常選択へ進む", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    commands.execute(new RemoveLineCommand("l-1")); // 選択は stale のまま

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a を選べる

    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
  });

  it("選択線の waypoint から外れた点では掴まず通常選択にフォールバックする", () => {
    const { controller } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    controller.pointerUp({ lateralYard: 25, absoluteYard: 55 });

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // waypoint から遠い→ p-a

    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
  });

  it("waypoint が無い線を選択中はハンドル走査が空で素通りする", () => {
    const { controller } = setup({
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "p-a", position: { lateralYard: 10, absoluteYard: 50 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-0",
          kind: "block",
          startPlayerId: "p-a",
          waypoints: [],
          end: { lateralYard: 18, absoluteYard: 50 },
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 14, absoluteYard: 50 }); // l-0 上を選択
    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-0" });

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a へ

    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-a" });
  });

  it("複数 waypoint・複数線でドラッグ中の 1 点だけが overlay/getRenderModel に反映される", () => {
    const { controller, model } = setup({
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "p-a", position: { lateralYard: 10, absoluteYard: 50 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-2",
          kind: "route",
          startPlayerId: "p-a",
          waypoints: [
            { lateralYard: 14, absoluteYard: 52 },
            { lateralYard: 18, absoluteYard: 56 },
          ],
          end: { lateralYard: 22, absoluteYard: 60 },
          interpolation: "straight",
        },
        {
          id: "l-3",
          kind: "block",
          startPlayerId: "p-a",
          waypoints: [{ lateralYard: 8, absoluteYard: 48 }],
          end: { lateralYard: 5, absoluteYard: 45 },
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 22, absoluteYard: 60 }); // l-2 選択
    controller.pointerDown({ lateralYard: 14, absoluteYard: 52 }); // waypoint 0 掴む
    controller.pointerMove({ lateralYard: 15, absoluteYard: 53 });

    // ドラッグ中の点だけ current、他 waypoint・他線は不変。
    expect(controller.getOverlay().waypointHandles).toEqual([
      { lateralYard: 15, absoluteYard: 53 },
      { lateralYard: 18, absoluteYard: 56 },
    ]);
    const rendered = controller.getRenderModel();
    expect(rendered.lines.find((l) => l.id === "l-2")?.waypoints).toEqual([
      { lateralYard: 15, absoluteYard: 53 },
      { lateralYard: 18, absoluteYard: 56 },
    ]);
    expect(rendered.lines.find((l) => l.id === "l-3")?.waypoints).toEqual([
      { lateralYard: 8, absoluteYard: 48 },
    ]);

    // 確定すると掴んだ点だけ差し替わり、もう 1 点はそのまま残る。
    controller.pointerUp({ lateralYard: 15, absoluteYard: 53 });
    expect(model.findLine("l-2")?.waypoints).toEqual([
      { lateralYard: 15, absoluteYard: 53 },
      { lateralYard: 18, absoluteYard: 56 },
    ]);
  });
});

describe("EditorController: 終点（endpoint）編集", () => {
  it("終点を掴んでドラッグし、end だけ更新・他線/waypoint 不変・undo 可", () => {
    const { controller, model, undoRedo } = setup({
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "p-a", position: { lateralYard: 10, absoluteYard: 50 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-1",
          kind: "route",
          startPlayerId: "p-a",
          waypoints: [{ lateralYard: 15, absoluteYard: 52 }],
          end: { lateralYard: 25, absoluteYard: 55 },
          interpolation: "straight",
        },
        {
          id: "l-2",
          kind: "block",
          startPlayerId: "p-a",
          waypoints: [],
          end: { lateralYard: 5, absoluteYard: 45 },
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択

    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // 終点ハンドルを掴む
    controller.pointerMove({ lateralYard: 28, absoluteYard: 58 });
    // overlay/プレビューに drag-endpoint が反映され、他線は不変。
    expect(controller.getOverlay().endpointHandle).toEqual({ lateralYard: 28, absoluteYard: 58 });
    const rendered = controller.getRenderModel();
    expect(rendered.lines.find((l) => l.id === "l-1")?.end).toEqual({
      lateralYard: 28,
      absoluteYard: 58,
    });
    expect(rendered.lines.find((l) => l.id === "l-2")?.end).toEqual({
      lateralYard: 5,
      absoluteYard: 45,
    });
    controller.pointerUp({ lateralYard: 28, absoluteYard: 58 });

    expect(model.findLine("l-1")?.end).toEqual({ lateralYard: 28, absoluteYard: 58 });
    expect(model.findLine("l-1")?.waypoints).toEqual([{ lateralYard: 15, absoluteYard: 52 }]);

    undoRedo.undo();
    expect(model.findLine("l-1")?.end).toEqual({ lateralYard: 25, absoluteYard: 55 });
  });

  it("終点を掴んで動かさず離せばコマンドを出さない", () => {
    const { controller, undoRedo } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // 終点を掴む
    controller.pointerUp({ lateralYard: 25, absoluteYard: 55 });

    expect(undoRedo.canUndo).toBe(false);
  });

  it("終点ドラッグ中に線が消えたら離してもコマンドを出さない", () => {
    const { controller, commands, model } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // 終点を掴む
    commands.execute(new RemoveLineCommand("l-1"));

    controller.pointerMove({ lateralYard: 28, absoluteYard: 58 });
    expect(() => controller.pointerUp({ lateralYard: 28, absoluteYard: 58 })).not.toThrow();
    expect(model.getData().lines).toHaveLength(0);
  });

  it("終点と waypoint が近接でも終点を優先して掴む", () => {
    const { controller, model } = setup({
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "p-a", position: { lateralYard: 10, absoluteYard: 50 }, shape: "circle", label: "A" },
      ],
      lines: [
        {
          id: "l-x",
          kind: "route",
          startPlayerId: "p-a",
          waypoints: [{ lateralYard: 20, absoluteYard: 60 }],
          end: { lateralYard: 20.2, absoluteYard: 60 }, // waypoint とほぼ同座標
          interpolation: "straight",
        },
      ],
    });
    controller.pointerDown({ lateralYard: 15, absoluteYard: 55 }); // l-x 上を選択
    expect(controller.getSelection()).toEqual({ kind: "line", id: "l-x" });

    controller.pointerDown({ lateralYard: 20.2, absoluteYard: 60 }); // 重なり領域を掴む
    controller.pointerMove({ lateralYard: 30, absoluteYard: 65 });
    controller.pointerUp({ lateralYard: 30, absoluteYard: 65 });

    // 終点が動き、waypoint は残る（先端ドラッグが waypoint に奪われない）。
    expect(model.findLine("l-x")?.end).toEqual({ lateralYard: 30, absoluteYard: 65 });
    expect(model.findLine("l-x")?.waypoints).toEqual([{ lateralYard: 20, absoluteYard: 60 }]);
  });
});

describe("EditorController: アクション", () => {
  it("deleteSelection: 無選択では何もしない", () => {
    const { controller, changes } = setup();
    controller.deleteSelection();
    expect(changes).not.toHaveBeenCalled();
  });

  it("deleteSelection: 選手を削除し従属線もカスケード除去、選択解除", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });

    controller.deleteSelection();

    const data = model.getData();
    expect(data.players.some((p) => p.id === "p-a")).toBe(false);
    expect(data.lines).toHaveLength(0); // l-1 は p-a 起点でカスケード除去
    expect(controller.getSelection()).toBeNull();
  });

  it("deleteSelection: 選手が既に消えていればコマンドを出さない", () => {
    const { controller, commands, undoRedo } = setup();
    controller.pointerDown({ lateralYard: 20, absoluteYard: 50 }); // p-b
    controller.pointerUp({ lateralYard: 20, absoluteYard: 50 });
    commands.execute(new RemovePlayerCommand("p-b"));
    const undoCount = undoRedo.canUndo;

    controller.deleteSelection();

    expect(undoRedo.canUndo).toBe(undoCount);
    expect(controller.getSelection()).toEqual({ kind: "player", id: "p-b" });
  });

  it("deleteSelection: 線を削除し選択解除", () => {
    const { controller, model } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1
    controller.deleteSelection();

    expect(model.getData().lines).toHaveLength(0);
    expect(controller.getSelection()).toBeNull();
  });

  it("deleteSelection: 線が既に消えていればコマンドを出さない", () => {
    const { controller, commands, model } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    commands.execute(new RemoveLineCommand("l-1"));

    expect(() => controller.deleteSelection()).not.toThrow();
    expect(model.getData().lines).toHaveLength(0);
  });

  it("updateSelectedPlayer: 選手選択時のみ反映、それ以外は無視", () => {
    const { controller, model, commands } = setup();
    controller.updateSelectedPlayer({ label: "Z" }); // 無選択 → 無視

    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // 線選択
    controller.updateSelectedPlayer({ label: "Z" }); // 線選択 → 無視

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a 選択
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });
    controller.updateSelectedPlayer({ label: "Z", shape: "triangle", color: "#f00" });
    expect(model.findPlayer("p-a")).toMatchObject({
      label: "Z",
      shape: "triangle",
      color: "#f00",
    });

    commands.execute(new RemovePlayerCommand("p-a")); // stale 選択
    expect(() => controller.updateSelectedPlayer({ label: "Q" })).not.toThrow();
  });

  it("updateSelectedLine: 線選択時のみ反映、それ以外は無視", () => {
    const { controller, model, commands } = setup();
    controller.updateSelectedLine({ kind: "block" }); // 無選択 → 無視

    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // 選手選択
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });
    controller.updateSelectedLine({ kind: "block" }); // 選手選択 → 無視

    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1 選択
    controller.updateSelectedLine({ kind: "motion", interpolation: "bezier", thickness: 4 });
    expect(model.findLine("l-1")).toMatchObject({
      kind: "motion",
      interpolation: "bezier",
      thickness: 4,
    });

    commands.execute(new RemoveLineCommand("l-1")); // stale 選択
    expect(() => controller.updateSelectedLine({ kind: "route" })).not.toThrow();
  });

  it("setFieldZone: 同値は無視、変更はコマンド化して undo 可能", () => {
    const { controller, model, undoRedo } = setup();
    controller.setFieldZone("middle"); // 同値
    expect(undoRedo.canUndo).toBe(false);

    controller.setFieldZone("redzone");
    expect(model.getFieldZone()).toBe("redzone");
    expect(undoRedo.canUndo).toBe(true);
  });

  it("undo / redo を委譲し履歴を行き来する", () => {
    const { controller, model } = setup();
    controller.setTool("add-player");
    controller.pointerDown({ lateralYard: 5, absoluteYard: 40 });
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
      { position: { lateralYard: 30, absoluteYard: 45 }, shape: "circle", label: "A" },
      {
        position: { lateralYard: 32, absoluteYard: 45 },
        shape: "square",
        label: "B",
        color: "#c62828",
      },
    ],
  };

  it("既存選手を保ち衝突しない id で追記、選択解除、Undo で取り消せる", () => {
    const { controller, model, undoRedo } = setup();
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 }); // p-a 選択
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });

    controller.loadFormation(formation);

    const players = model.getData().players;
    expect(players.map((p) => p.id)).toEqual(["p-a", "p-b", "player-1", "player-2"]);
    expect(players[2]).toEqual({
      id: "player-1",
      position: { lateralYard: 30, absoluteYard: 45 },
      shape: "circle",
      label: "A",
    });
    expect(players[3]?.color).toBe("#c62828"); // 色ありテンプレートは色を保つ
    expect(controller.getSelection()).toBeNull(); // 読込で選択解除
    expect(undoRedo.canUndo).toBe(true);

    controller.undo();
    expect(model.getData().players.map((p) => p.id)).toEqual(["p-a", "p-b"]);
  });

  it("既存に同形式の id があっても IdFactory が衝突を避ける", () => {
    const { controller, model } = setup({
      version: 1,
      field: { zone: "middle" },
      players: [
        {
          id: "player-1",
          position: { lateralYard: 1, absoluteYard: 50 },
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

  it("配置可能な選手が無ければ no-op（コマンドも発火も出ない）", () => {
    const { controller, model, undoRedo, changes } = setup();
    changes.mockClear();

    controller.loadFormation({ id: "empty", name: "空", side: "offense", players: [] });

    expect(model.getData().players.map((p) => p.id)).toEqual(["p-a", "p-b"]);
    expect(undoRedo.canUndo).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });
});

describe("EditorController: getOverlay / getSelected*", () => {
  it("選手選択で selectedPlayerId と選手スナップショットを返す", () => {
    const { controller } = setup();
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 });
    controller.pointerUp({ lateralYard: 10, absoluteYard: 50 });

    expect(controller.getOverlay()).toEqual({ selectedPlayerId: "p-a", waypointHandles: [] });
    expect(controller.getSelectedPlayer()).toMatchObject({ id: "p-a" });
    expect(controller.getSelectedLine()).toBeUndefined();
  });

  it("線選択で selectedLineId とハンドル、消えていればハンドル空", () => {
    const { controller, commands } = setup();
    controller.pointerDown({ lateralYard: 25, absoluteYard: 55 }); // l-1

    expect(controller.getOverlay()).toEqual({
      selectedLineId: "l-1",
      waypointHandles: [{ lateralYard: 15, absoluteYard: 52 }],
      endpointHandle: { lateralYard: 25, absoluteYard: 55 },
    });
    expect(controller.getSelectedLine()).toMatchObject({ id: "l-1" });

    commands.execute(new RemoveLineCommand("l-1")); // stale 選択
    expect(controller.getOverlay()).toEqual({ selectedLineId: "l-1", waypointHandles: [] });
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

describe("EditorController: 初期状態（drawing フラグ別経路）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("作図中は viewState.drawing が true になる", () => {
    const { controller } = setup();
    controller.setTool("draw-line");
    controller.pointerDown({ lateralYard: 10, absoluteYard: 50 });

    expect(controller.getViewState().drawing).toBe(true);
  });
});
