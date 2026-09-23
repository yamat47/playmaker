import { describe, expect, it, vi } from "vitest";
import { CommandService } from "../commands/command-service.js";
import { RemoveLineCommand } from "../commands/line-commands.js";
import { RemovePlayerCommand } from "../commands/player-commands.js";
import { UndoRedoService } from "../commands/undo-redo-service.js";
import type { Formation } from "../formations/formation.js";
import { IdFactory } from "../model/id-factory.js";
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

describe("EditorController: 選択と選手ドラッグ（select）", () => {
  it("pointerMove は interaction が無ければ無反応、pointerUp も同様", () => {
    const { controller, changes } = setup();

    controller.pointerMove({ lateralYard: 1, downfieldYard: -49 });
    controller.pointerUp({ lateralYard: 1, downfieldYard: -49 });

    expect(changes).not.toHaveBeenCalled();
  });
});

describe("EditorController: アクション", () => {
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

describe("EditorController: ライフサイクル", () => {
  it("dispose 後は Model 変更で再描画が走らない", () => {
    const { controller, commands, changes } = setup();
    controller.dispose();
    changes.mockClear();

    commands.execute(new RemovePlayerCommand("p-b"));

    expect(changes).not.toHaveBeenCalled();
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

describe("EditorController: 途中状態のまま別の操作をしたとき", () => {
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
});

describe("EditorController: 履歴の通知", () => {
  it("controller を通さずに編集しても、履歴が変わったあとに表示状態を通知する", () => {
    const { commands, changes } = setup();

    commands.execute(new RemoveLineCommand("l-1"));

    // Model の通知の時点では履歴がまだ変わっていないので、表示状態は履歴の通知で出る。
    expect(changes.mock.calls).toEqual([["scene"], ["view"]]);
  });
});
