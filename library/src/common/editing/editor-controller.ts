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
import { patchChangesAnything } from "../commands/patch.js";
import {
  AddPlayerCommand,
  type PlayerPatch,
  RemovePlayerCommand,
  UpdatePlayerCommand,
} from "../commands/player-commands.js";
import { Emitter } from "../event/emitter.js";
import { type Formation, instantiateFormation } from "../formations/formation.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { hitLineHandle, hitTestLine, hitTestPlayer } from "../geometry/hit-test.js";
import { Disposable } from "../lifecycle/disposable.js";
import { type Line, MAX_LINES } from "../model/line.js";
import type { FieldZone } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import {
  DEFAULT_PLAYER_SHAPE,
  type FieldPosition,
  MAX_PLAYERS,
  type Player,
} from "../model/player.js";
import type {
  EditorOverlay,
  EditorSelection,
  EditorTool,
  EditorViewState,
  IEditorController,
  SceneData,
} from "./editor.js";
import type { IIdFactory } from "./id-factory.js";
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

function samePosition(a: FieldPosition, b: FieldPosition): boolean {
  return a.lateralYard === b.lateralYard && a.downfieldYard === b.downfieldYard;
}

function sameSelection(a: EditorSelection, b: EditorSelection): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.kind === b.kind && a.id === b.id;
}

/**
 * ツール、選択、ジェスチャを受けてコマンドを発行する。Model を直接書き換えない。
 * ドラッグや作図の途中は Model に載せず、getRenderModel で重ねて見せるので、
 * 確定までは Model の onDidChange も履歴も動かない。
 */
export class EditorController extends Disposable implements IEditorController {
  private readonly model: IPlayModel;
  private readonly commands: ICommandService;
  private readonly ids: IIdFactory;

  private readonly _onDidChange = this._register(new Emitter<void>());
  readonly onDidChange = this._onDidChange.event;

  private tool: EditorTool = "select";
  private selection: EditorSelection = null;
  private interaction: Interaction | undefined;
  // 自分で編集を走らせている間は Model と履歴の通知を転送せず、両方が済んでから 1 回だけ発火する。
  // Model はコマンドの apply の中で通知するので、そのまま転送すると購読側が
  // 更新前の canUndo / canRedo を読んでしまう。
  private editing = false;
  private changedWhileEditing = false;

  constructor(model: IPlayModel, commands: ICommandService, ids: IIdFactory) {
    super();
    this.model = model;
    this.commands = commands;
    this.ids = ids;
    const forward = (): void => {
      if (this.editing) {
        this.changedWhileEditing = true;
      } else {
        this._onDidChange.fire();
      }
    };
    this._register(this.model.onDidChange(forward));
    this._register(this.commands.onDidChangeHistory(forward));
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
    return {
      tool: this.tool,
      selection: this.getSelection(),
      canUndo: this.commands.canUndo,
      canRedo: this.commands.canRedo,
      fieldZone: this.model.getFieldZone(),
      drawing: this.interaction?.type === "draw-line",
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

  getRenderModel(): SceneData {
    return composePreview(this.model.getSnapshot(), this.interaction);
  }

  getOverlay(): EditorOverlay {
    return computeOverlay(this.getRenderModel(), this.selection);
  }

  setTool(tool: EditorTool): void {
    if (tool === this.tool) {
      return;
    }
    this.tool = tool;
    // ツールを切り替えたら作図やドラッグの途中は捨てる。
    this.interaction = undefined;
    this._onDidChange.fire();
  }

  pointerDown(pos: FieldPosition): void {
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
  }

  pointerMove(pos: FieldPosition): void {
    const i = this.interaction;
    if (i === undefined) {
      return;
    }
    this.interaction =
      i.type === "draw-line"
        ? { ...i, cursor: this.clampToField(pos) }
        : { ...i, current: this.clampToField(dragPosition(i, pos)) };
    this._onDidChange.fire();
  }

  pointerUp(pos: FieldPosition): void {
    const i = this.interaction;
    // 作図はクリック（pointerDown）で点を打つので、up では何もしない。
    if (i?.type !== "drag") {
      return;
    }
    this.interaction = undefined;
    const moved = dragPosition(i, pos);
    // 寄せる前の位置で比べる。窓の外にある選手をクリックしただけで、窓の端へ動かさない。
    if (samePosition(moved, i.origin)) {
      this._onDidChange.fire();
      return;
    }
    const command = this.dropCommand(i, this.clampToField(moved));
    if (command === undefined) {
      this._onDidChange.fire();
      return;
    }
    this.execute(command);
  }

  cancelInteraction(): void {
    if (this.interaction === undefined) {
      return;
    }
    this.interaction = undefined;
    this._onDidChange.fire();
  }

  commitLine(): void {
    const i = this.interaction;
    if (i?.type !== "draw-line") {
      return;
    }
    this.interaction = undefined;
    const line = this.lineFromDraft(i);
    if (line === undefined) {
      this._onDidChange.fire();
      return;
    }
    this.execute(new AddLineCommand(line));
    // 作図の直後は選択ツールへ戻し、引いた線を選ぶ。続けて引くより、すぐ編集できるほうを取る。
    this.setTool("select");
    this.setSelection({ kind: "line", id: line.id });
  }

  deleteSelection(): void {
    const player = this.getSelectedPlayer();
    const line = this.getSelectedLine();
    if (player !== undefined) {
      this.execute(new RemovePlayerCommand(player.id));
    } else if (line !== undefined) {
      this.execute(new RemoveLineCommand(line.id));
    } else {
      return;
    }
    this.setSelection(null);
  }

  updateSelectedPlayer(patch: PlayerPatch): void {
    const player = this.getSelectedPlayer();
    // 値が変わらないパッチを積むと、何も戻らない Undo 段と onChange が出てしまう。
    if (player === undefined || !patchChangesAnything(player, patch)) {
      return;
    }
    this.execute(new UpdatePlayerCommand(player.id, patch));
  }

  updateSelectedLine(patch: LinePatch): void {
    const line = this.getSelectedLine();
    if (line === undefined || !patchChangesAnything(line, patch)) {
      return;
    }
    this.execute(new UpdateLineCommand(line.id, patch));
  }

  setFieldZone(zone: FieldZone): void {
    if (zone === this.model.getFieldZone()) {
      return;
    }
    this.cancelInteraction();
    this.execute(new SetFieldZoneCommand(zone));
  }

  loadFormation(formation: Formation): void {
    const { players } = this.model.getSnapshot();
    if (formation.players.length === 0 || players.length + formation.players.length > MAX_PLAYERS) {
      return;
    }
    const added = instantiateFormation(
      formation,
      this.ids,
      players.map((p) => p.id),
    );
    this.cancelInteraction();
    this.execute(new LoadFormationCommand(added));
    // 読み込んだあとは、元の選択に意味が無いので外す。
    this.setSelection(null);
  }

  undo(): void {
    const i = this.interaction;
    if (i?.type === "draw-line") {
      if (i.points.length === 0) {
        this.cancelInteraction();
      } else {
        this.interaction = { ...i, points: i.points.slice(0, -1) };
        this._onDidChange.fire();
      }
      return;
    }
    this.cancelInteraction();
    this.runEdit(() => this.commands.undo());
  }

  redo(): void {
    this.cancelInteraction();
    this.runEdit(() => this.commands.redo());
  }

  private setSelection(next: EditorSelection): void {
    if (sameSelection(this.selection, next)) {
      return;
    }
    this.selection = next;
    this._onDidChange.fire();
  }

  private execute(command: ICommand): void {
    this.runEdit(() => this.commands.execute(command));
  }

  private runEdit(edit: () => void): void {
    this.editing = true;
    try {
      edit();
    } finally {
      this.editing = false;
    }
    if (this.changedWhileEditing) {
      this.changedWhileEditing = false;
      this._onDidChange.fire();
    }
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
      this.interaction = handle;
      this._onDidChange.fire();
      return;
    }
    // 選手は選択しつつドラッグを始める。動かさずに離せばただの選択になる。
    const player = hitTestPlayer(data.players, pos);
    if (player !== undefined) {
      this.setSelection({ kind: "player", id: player.id });
      this.interaction = startDrag({ kind: "player", playerId: player.id }, player.position, pos);
      this._onDidChange.fire();
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
    const i = this.interaction;
    if (i?.type === "draw-line") {
      this.interaction = addDraftPoint(i, this.clampToField(pos));
      this._onDidChange.fire();
      return;
    }
    const data = this.model.getSnapshot();
    if (data.lines.length >= MAX_LINES) {
      return;
    }
    // 選手以外から始めようとしたら無視する。
    const player = hitTestPlayer(data.players, pos);
    if (player === undefined) {
      return;
    }
    this.interaction = startDrawing(player);
    this._onDidChange.fire();
  }

  private addPlayerAt(pos: FieldPosition): void {
    const { players } = this.model.getSnapshot();
    if (players.length >= MAX_PLAYERS) {
      return;
    }
    const id = this.ids.next("player", new Set(players.map((p) => p.id)));
    this.execute(
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
