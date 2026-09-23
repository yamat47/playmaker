import type { Event } from "../base/event.js";
import { Disposable } from "../base/lifecycle.js";
import type { ICommand } from "../commands/command.js";
import type { ICommandService } from "../commands/command-service.js";
import { SetFieldZoneCommand } from "../commands/field-commands.js";
import { LoadFormationCommand } from "../commands/formation-commands.js";
import {
  AddLineCommand,
  type LinePatch,
  RemoveLineCommand,
  UpdateLineCommand,
} from "../commands/line-commands.js";
import {
  AddPlayerCommand,
  type PlayerPatch,
  RemovePlayerCommand,
  UpdatePlayerCommand,
} from "../commands/player-commands.js";
import { type Formation, instantiateFormation } from "../formations/formation.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { hitLineHandle, hitTestLine, hitTestPlayer } from "../geometry/hit-test.js";
import type { IIdFactory } from "../model/id-factory.js";
import { type Line, MAX_LINES } from "../model/line.js";
import type { FieldZone } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import {
  DEFAULT_PLAYER_SHAPE,
  type FieldPosition,
  MAX_PLAYERS,
  type Player,
} from "../model/player.js";
import {
  canLoadFormation,
  type EditorFrame,
  type EditorSelection,
  type EditorTool,
  type EditorViewState,
  type IEditorController,
  isSameSelection,
  isToolAvailable,
} from "./editor.js";
import { EditorNotifier } from "./editor-notifier.js";
import {
  addDraftPoint,
  committableDraft,
  type DragInteraction,
  type DragTarget,
  type DrawInteraction,
  draftToLine,
  dragPatch,
  dragPosition,
  type Interaction,
  startDrag,
  startDrawing,
} from "./interaction.js";
import { composePreview, computeOverlay } from "./preview.js";

function isSamePosition(a: FieldPosition, b: FieldPosition): boolean {
  return a.lateralYard === b.lateralYard && a.downfieldYard === b.downfieldYard;
}

/**
 * ツール、選択、ジェスチャを受けてコマンドを発行する。Model を直接書き換えない。
 * ドラッグや作図の途中は Model に載せず、getFrame で重ねて見せるので、
 * 確定までは Model の onDidChange も履歴も動かない。
 */
export class EditorController extends Disposable implements IEditorController {
  private readonly model: IPlayModel;
  private readonly commands: ICommandService;
  private readonly ids: IIdFactory;

  private readonly notifier: EditorNotifier;
  readonly onDidChangeScene: Event<void>;
  readonly onDidChangeViewState: Event<void>;

  private tool: EditorTool = "select";
  private selection: EditorSelection = null;
  private interaction: Interaction | undefined;

  constructor(model: IPlayModel, commands: ICommandService, ids: IIdFactory) {
    super();
    this.model = model;
    this.commands = commands;
    this.ids = ids;
    this.notifier = this._register(
      new EditorNotifier(() => ({
        state: this.getViewState(),
        player: this.getSelectedPlayer(),
        line: this.getSelectedLine(),
      })),
    );
    this.onDidChangeScene = this.notifier.onDidChangeScene;
    this.onDidChangeViewState = this.notifier.onDidChangeViewState;
    this._register(this.model.onDidChange(() => this.notifier.markSceneChanged()));
    this._register(this.commands.onDidChangeHistory(() => this.notifier.markViewStateChanged()));
  }

  getTool(): EditorTool {
    return this.tool;
  }

  getSelection(): EditorSelection {
    return this.getSelectedPlayer() === undefined && this.getSelectedLine() === undefined
      ? null
      : this.selection;
  }

  getViewState(): EditorViewState {
    const { players, lines } = this.model.getSnapshot();
    return {
      tool: this.tool,
      selection: this.getSelection(),
      canUndo: this.commands.canUndo,
      canRedo: this.commands.canRedo,
      fieldZone: this.model.getFieldZone(),
      isDrawing: this.interaction?.type === "draw-line",
      remainingPlayerSlots: MAX_PLAYERS - players.length,
      canStartLine: lines.length < MAX_LINES,
    };
  }

  getSelectedPlayer(): Player | undefined {
    const s = this.selection;
    return s?.kind === "player" ? this.model.findPlayer(s.id) : undefined;
  }

  getSelectedLine(): Line | undefined {
    const s = this.selection;
    return s?.kind === "line" ? this.model.findLine(s.id) : undefined;
  }

  getFrame(): EditorFrame {
    const scene = composePreview(this.model.getSnapshot(), this.interaction);
    return { scene, overlay: computeOverlay(scene, this.selection) };
  }

  setTool(tool: EditorTool): void {
    if (tool === this.tool) {
      return;
    }
    this.notifier.batch(() => {
      this.tool = tool;
      this.setInteraction(undefined);
    });
  }

  pointerDown(pos: FieldPosition): void {
    this.notifier.batch(() => {
      switch (this.tool) {
        case "add-player":
          this.addPlayerAt(pos);
          return;
        case "draw-line":
          this.drawLinePointerDown(pos);
          return;
        case "select":
          this.selectPointerDown(pos);
          return;
      }
    });
  }

  pointerMove(pos: FieldPosition): void {
    const interaction = this.interaction;
    if (interaction === undefined) {
      return;
    }
    this.notifier.batch(() =>
      this.setInteraction(
        interaction.type === "draw-line"
          ? { ...interaction, cursor: this.clampToField(pos) }
          : { ...interaction, current: this.clampToField(dragPosition(interaction, pos)) },
      ),
    );
  }

  pointerUp(pos: FieldPosition): void {
    const interaction = this.interaction;
    // 作図はクリック（pointerDown）で点を打つので、up では何もしない。
    if (interaction?.type !== "drag") {
      return;
    }
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      const moved = dragPosition(interaction, pos);
      // 寄せる前の位置で比べる。窓の外にある選手をクリックしただけで、窓の端へ動かさない。
      if (isSamePosition(moved, interaction.origin)) {
        return;
      }
      const command = this.dropCommand(interaction, this.clampToField(moved));
      if (command !== undefined) {
        this.commands.execute(command);
      }
    });
  }

  cancelInteraction(): void {
    this.notifier.batch(() => this.setInteraction(undefined));
  }

  commitLine(): void {
    const interaction = this.interaction;
    if (interaction?.type !== "draw-line") {
      return;
    }
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      const line = this.lineFromDraft(interaction);
      if (line === undefined) {
        return;
      }
      this.commands.execute(new AddLineCommand(line));
      // 作図の直後は選択ツールへ戻し、引いた線を選ぶ。続けて引くより、すぐ編集できるほうを取る。
      this.setTool("select");
      this.setSelection({ kind: "line", id: line.id });
    });
  }

  deleteSelection(): void {
    const player = this.getSelectedPlayer();
    const line = this.getSelectedLine();
    this.notifier.batch(() => {
      if (player !== undefined) {
        this.commands.execute(new RemovePlayerCommand(player.id));
      } else if (line !== undefined) {
        this.commands.execute(new RemoveLineCommand(line.id));
      } else {
        return;
      }
      this.setSelection(null);
    });
  }

  updateSelectedPlayer(patch: PlayerPatch): void {
    const player = this.getSelectedPlayer();
    if (player === undefined) {
      return;
    }
    this.notifier.batch(() => this.commands.execute(new UpdatePlayerCommand(player.id, patch)));
  }

  updateSelectedLine(patch: LinePatch): void {
    const line = this.getSelectedLine();
    if (line === undefined) {
      return;
    }
    this.notifier.batch(() => this.commands.execute(new UpdateLineCommand(line.id, patch)));
  }

  setFieldZone(zone: FieldZone): void {
    this.notifier.batch(() => {
      // 同じゾーンを選び直しただけなら、途中のドラッグや作図は残す。
      if (this.commands.execute(new SetFieldZoneCommand(zone))) {
        this.setInteraction(undefined);
      }
    });
  }

  loadFormation(formation: Formation): boolean {
    if (!canLoadFormation(formation, this.getViewState())) {
      return false;
    }
    const { players } = this.model.getSnapshot();
    const added = instantiateFormation(
      formation,
      this.ids,
      players.map((p) => p.id),
    );
    return this.notifier.batch(() => {
      const loaded = this.commands.execute(new LoadFormationCommand(added));
      if (loaded) {
        // 読み込んだあとは、途中の操作と元の選択に意味が無いので外す。
        this.setInteraction(undefined);
        this.setSelection(null);
      }
      return loaded;
    });
  }

  undo(): void {
    this.notifier.batch(() => {
      const interaction = this.interaction;
      if (interaction?.type === "draw-line") {
        this.setInteraction(
          interaction.points.length === 0
            ? undefined
            : { ...interaction, points: interaction.points.slice(0, -1) },
        );
        return;
      }
      this.setInteraction(undefined);
      this.commands.undo();
    });
  }

  redo(): void {
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      this.commands.redo();
    });
  }

  private setSelection(next: EditorSelection): void {
    if (isSameSelection(this.selection, next)) {
      return;
    }
    this.selection = next;
    this.notifier.markSceneChanged();
  }

  private setInteraction(next: Interaction | undefined): void {
    if (next === this.interaction) {
      return;
    }
    this.interaction = next;
    this.notifier.markSceneChanged();
  }

  private clampToField(pos: FieldPosition): FieldPosition {
    return clampToZoneWindow(pos, this.model.getSnapshot().field);
  }

  // ドラッグ中に対象が消えていたら undefined を返し、コマンドを出さない。
  private dropCommand(drag: DragInteraction, to: FieldPosition): ICommand | undefined {
    const drop = dragPatch(this.model.getSnapshot(), drag.target, to);
    if (drop === undefined) {
      return undefined;
    }
    return drop.kind === "player"
      ? new UpdatePlayerCommand(drop.playerId, drop.patch)
      : new UpdateLineCommand(drop.lineId, drop.patch);
  }

  // 起点の選手が消えていれば確定しない。
  private lineFromDraft(draw: DrawInteraction): Line | undefined {
    const start = this.model.findPlayer(draw.startPlayerId);
    const split = start === undefined ? undefined : committableDraft(draw, start.position);
    if (split === undefined) {
      return undefined;
    }
    const id = this.ids.next("line", new Set(this.model.getSnapshot().lines.map((l) => l.id)));
    return draftToLine(draw, id, split);
  }

  private selectPointerDown(pos: FieldPosition): void {
    const data = this.model.getSnapshot();
    // 選択中の線のハンドルを最優先で掴む。選手や線と重なっていても編集できるようにする。
    const handle = this.hitSelectedLineHandle(pos);
    if (handle !== undefined) {
      this.setInteraction(handle);
      return;
    }
    // 選手は選択しつつドラッグを始める。動かさずに離せばただの選択になる。
    const player = hitTestPlayer(data.players, pos);
    if (player !== undefined) {
      this.setSelection({ kind: "player", id: player.id });
      this.setInteraction(startDrag({ kind: "player", playerId: player.id }, player.position, pos));
      return;
    }
    const line = hitTestLine(data.lines, data.players, pos);
    this.setSelection(line === undefined ? null : { kind: "line", id: line.id });
  }

  private hitSelectedLineHandle(pos: FieldPosition): DragInteraction | undefined {
    const line = this.getSelectedLine();
    const hit = line === undefined ? undefined : hitLineHandle(line, pos);
    if (line === undefined || hit === undefined) {
      return undefined;
    }
    const target: DragTarget =
      hit.kind === "endpoint"
        ? { kind: "endpoint", lineId: line.id }
        : { kind: "waypoint", lineId: line.id, index: hit.index };
    return startDrag(target, hit.point, pos);
  }

  private drawLinePointerDown(pos: FieldPosition): void {
    const interaction = this.interaction;
    if (interaction?.type === "draw-line") {
      this.setInteraction(addDraftPoint(interaction, this.clampToField(pos)));
      return;
    }
    if (!isToolAvailable("draw-line", this.getViewState())) {
      return;
    }
    const data = this.model.getSnapshot();
    // 選手以外から始めようとしたら無視する。
    const player = hitTestPlayer(data.players, pos);
    if (player === undefined) {
      return;
    }
    this.setInteraction(startDrawing(player));
  }

  private addPlayerAt(pos: FieldPosition): void {
    if (!isToolAvailable("add-player", this.getViewState())) {
      return;
    }
    const { players } = this.model.getSnapshot();
    const id = this.ids.next("player", new Set(players.map((p) => p.id)));
    this.commands.execute(
      new AddPlayerCommand({
        id,
        position: this.clampToField(pos),
        shape: DEFAULT_PLAYER_SHAPE,
        label: "",
      }),
    );
    this.setSelection({ kind: "player", id });
  }
}
