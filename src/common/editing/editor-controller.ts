// 編集 UI（M5）の頭脳。DOM 非依存の純ロジックなので node 単体で全網羅テストできる。
// 役割: ツール状態・選択状態・ヤード空間ジェスチャ(pointerDown/Move/Up)を受け、
// 適切な ICommand を ICommandService 経由で発行する（Model 直接書き換えはしない）。
// ドラッグ/作図中のプレビューは getRenderModel()（Model スナップショット＋一時状態の
// 純粋な合成）で表現する。これにより実データ変更は 1 コマンド = onChange 1 回を保ち
// （M4 の契約）、見た目の追従はコマンドを汚さずに済む（Model–View 分離の徹底）。
//
// 選択は「id の希望」であり、対象が消えても自動解除しない（lookup 側が欠落を
// 許容して空を返す＝stale でも無害）。これで防御分岐がすべて到達可能になり、
// common 100% を v8 ignore 0 件で維持できる。

import type { ICommandService } from "../commands/command-service.js";
import { SetFieldZoneCommand } from "../commands/field-commands.js";
import { LoadFormationCommand } from "../commands/formation-commands.js";
import {
  AddLineCommand,
  type LinePatch,
  RemoveLineCommand,
  SetLineWaypointsCommand,
  UpdateLineCommand,
} from "../commands/line-commands.js";
import {
  AddPlayerCommand,
  MovePlayerCommand,
  type PlayerPatch,
  RemovePlayerCommand,
  UpdatePlayerCommand,
} from "../commands/player-commands.js";
import { Emitter, type Event } from "../event/emitter.js";
import type { Formation } from "../formations/formation.js";
import { distanceToSegment, hitTestLine, hitTestPlayer } from "../geometry/hit-test.js";
import { Disposable } from "../lifecycle/disposable.js";
import { DEFAULT_LINE_INTERPOLATION, DEFAULT_LINE_KIND, type Line } from "../model/line.js";
import type { FieldZone, PlayData } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import { DEFAULT_PLAYER_SHAPE, type FieldPosition, type Player } from "../model/player.js";
import type { IUndoRedoService } from "../undoRedo/undo-redo-service.js";
import type { IIdFactory } from "./id-factory.js";

/** 編集ツール（3 種で PRD 5.4 の操作を賄う）。 */
export type EditorTool = "select" | "add-player" | "draw-line";

/** 現在の選択対象。プロパティパネル・削除・waypoint 編集の対象を決める。 */
export type EditorSelection =
  | { readonly kind: "player"; readonly id: string }
  | { readonly kind: "line"; readonly id: string }
  | null;

/** 選択中の線の waypoint をドラッグでき、その当たり半径（ヤード）。 */
export const WAYPOINT_HANDLE_RADIUS_YARDS = 0.9;

/** プレビュー専用の合成線 id。Model には決して入らない（getRenderModel の中だけ）。 */
const DRAFT_LINE_ID = "__playmaker_draft_line__";

/**
 * View（CanvasSurface）が選択ハイライト/ハンドルを描くための最小情報（ヤード空間）。
 * 「どこを強調するか」の計算は common 側に閉じ、browser は描くだけにする。
 */
export interface EditorOverlay {
  selectedPlayerId?: string;
  selectedLineId?: string;
  /** 選択中の線の waypoint ハンドル位置（ドラッグ対象）。それ以外は空配列。 */
  waypointHandles: FieldPosition[];
}

/** ツールバー/プロパティパネルが描画に使う集約ビュー状態。 */
export interface EditorViewState {
  tool: EditorTool;
  selection: EditorSelection;
  canUndo: boolean;
  canRedo: boolean;
  fieldZone: FieldZone;
  /** 線を作図中（確定/キャンセル待ち）か。 */
  drawing: boolean;
}

/**
 * EditorController の公開面。browser（入力・UI）は具象でなくこの IF に依存し、
 * テストではフェイクへ差し替えられる（インターフェース抽出）。
 */
export interface IEditorController {
  readonly onDidChange: Event<void>;
  getTool(): EditorTool;
  setTool(tool: EditorTool): void;
  getSelection(): EditorSelection;
  getViewState(): EditorViewState;
  /** 選択中の選手（複製）。選手選択でない/対象が消えていれば undefined。 */
  getSelectedPlayer(): Player | undefined;
  /** 選択中の線（複製）。線選択でない/対象が消えていれば undefined。 */
  getSelectedLine(): Line | undefined;
  getRenderModel(): PlayData;
  getOverlay(): EditorOverlay;
  pointerDown(pos: FieldPosition): void;
  pointerMove(pos: FieldPosition): void;
  pointerUp(pos: FieldPosition): void;
  commitLine(): void;
  cancelInteraction(): void;
  deleteSelection(): void;
  updateSelectedPlayer(patch: PlayerPatch): void;
  updateSelectedLine(patch: LinePatch): void;
  setFieldZone(zone: FieldZone): void;
  /** フォーメーションテンプレートを読み込み選手を自動配置する（PRD 5.6）。 */
  loadFormation(formation: Formation): void;
  undo(): void;
  redo(): void;
}

/** ドラッグ/作図の一時状態。Model には載せず getRenderModel で合成表示する。 */
type Interaction =
  | {
      readonly type: "drag-player";
      readonly playerId: string;
      readonly origin: FieldPosition;
      readonly offsetLat: number;
      readonly offsetAbs: number;
      current: FieldPosition;
    }
  | {
      readonly type: "drag-waypoint";
      readonly lineId: string;
      readonly index: number;
      readonly origin: FieldPosition;
      readonly offsetLat: number;
      readonly offsetAbs: number;
      current: FieldPosition;
    }
  | {
      readonly type: "draw-line";
      readonly startPlayerId: string;
      readonly points: FieldPosition[];
      cursor: FieldPosition;
    }
  | null;

function samePosition(a: FieldPosition, b: FieldPosition): boolean {
  return a.lateralYard === b.lateralYard && a.absoluteYard === b.absoluteYard;
}

function sameSelection(a: EditorSelection, b: EditorSelection): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.kind === b.kind && a.id === b.id;
}

export class EditorController extends Disposable implements IEditorController {
  private readonly _onDidChange = this._register(new Emitter<void>());
  readonly onDidChange = this._onDidChange.event;

  private tool: EditorTool = "select";
  private selection: EditorSelection = null;
  private interaction: Interaction = null;

  // 依存はすべて手動コンストラクタ注入（重い DI 機構は持たない＝MVP・依存最小）。
  constructor(
    private readonly model: IPlayModel,
    private readonly commands: ICommandService,
    private readonly undoRedo: IUndoRedoService,
    private readonly ids: IIdFactory,
  ) {
    super();
    // Model 変更（自分のコマンド・undo/redo・カスケード削除）のたびに再描画を促す。
    this._register(this.model.onDidChange(() => this._onDidChange.fire()));
  }

  // --- 状態の読み取り -------------------------------------------------------

  getTool(): EditorTool {
    return this.tool;
  }

  getSelection(): EditorSelection {
    return this.selection;
  }

  getViewState(): EditorViewState {
    return {
      tool: this.tool,
      selection: this.selection,
      canUndo: this.undoRedo.canUndo,
      canRedo: this.undoRedo.canRedo,
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

  /** Model スナップショットに一時状態（ドラッグ/作図プレビュー）を合成して返す純関数。 */
  getRenderModel(): PlayData {
    const data = this.model.getData();
    const i = this.interaction;
    if (i === null) {
      return data;
    }
    if (i.type === "drag-player") {
      // 起点が選手の線は players を差し替えるだけで追従する（lineAnchorPoints 経由）。
      return {
        ...data,
        players: data.players.map((p) =>
          p.id === i.playerId ? { ...p, position: { ...i.current } } : p,
        ),
      };
    }
    if (i.type === "drag-waypoint") {
      return {
        ...data,
        lines: data.lines.map((l) =>
          l.id === i.lineId
            ? {
                ...l,
                waypoints: l.waypoints.map((w, idx) => (idx === i.index ? { ...i.current } : w)),
              }
            : l,
        ),
      };
    }
    // draw-line: 起点選手 → 既存 points → 追従カーソルを終点としたプレビュー線を足す。
    return {
      ...data,
      lines: [
        ...data.lines,
        {
          id: DRAFT_LINE_ID,
          kind: DEFAULT_LINE_KIND,
          startPlayerId: i.startPlayerId,
          waypoints: i.points.map((p) => ({ ...p })),
          end: { ...i.cursor },
          interpolation: DEFAULT_LINE_INTERPOLATION,
        },
      ],
    };
  }

  getOverlay(): EditorOverlay {
    const overlay: EditorOverlay = { waypointHandles: [] };
    const s = this.selection;
    if (s?.kind === "player") {
      overlay.selectedPlayerId = s.id;
    } else if (s?.kind === "line") {
      overlay.selectedLineId = s.id;
      const line = this.model.findLine(s.id);
      if (line !== undefined) {
        const drag = this.interaction;
        overlay.waypointHandles = line.waypoints.map((w, idx) =>
          drag?.type === "drag-waypoint" && drag.lineId === s.id && drag.index === idx
            ? { ...drag.current }
            : w,
        );
      }
    }
    return overlay;
  }

  // --- ツール・選択 ---------------------------------------------------------

  setTool(tool: EditorTool): void {
    if (tool === this.tool) {
      return;
    }
    this.tool = tool;
    // ツールを切り替えたら作図/ドラッグ途中は破棄する（中途半端な状態を残さない）。
    this.interaction = null;
    this._onDidChange.fire();
  }

  private setSelection(next: EditorSelection): void {
    if (sameSelection(this.selection, next)) {
      return;
    }
    this.selection = next;
    this._onDidChange.fire();
  }

  // --- ジェスチャ（ヤード空間。browser が px→ヤード変換して呼ぶ） ----------

  pointerDown(pos: FieldPosition): void {
    if (this.tool === "add-player") {
      this.addPlayerAt(pos);
      return;
    }
    if (this.tool === "draw-line") {
      this.drawLinePointerDown(pos);
      return;
    }
    this.selectPointerDown(pos);
  }

  pointerMove(pos: FieldPosition): void {
    const i = this.interaction;
    if (i === null) {
      return;
    }
    if (i.type === "draw-line") {
      i.cursor = { ...pos };
    } else {
      i.current = {
        lateralYard: pos.lateralYard + i.offsetLat,
        absoluteYard: pos.absoluteYard + i.offsetAbs,
      };
    }
    this._onDidChange.fire();
  }

  pointerUp(pos: FieldPosition): void {
    const i = this.interaction;
    if (i === null || i.type === "draw-line") {
      // draw-line はクリック（pointerDown）で点を打つ。up では何もしない。
      return;
    }
    this.interaction = null;
    const final: FieldPosition = {
      lateralYard: pos.lateralYard + i.offsetLat,
      absoluteYard: pos.absoluteYard + i.offsetAbs,
    };
    if (samePosition(final, i.origin)) {
      // 動いていない＝ただのクリック。無駄なコマンド/onChange を出さず再描画だけ。
      this._onDidChange.fire();
      return;
    }
    if (i.type === "drag-player") {
      if (this.model.findPlayer(i.playerId) === undefined) {
        this._onDidChange.fire();
        return;
      }
      this.commands.execute(new MovePlayerCommand(i.playerId, final));
      return;
    }
    const line = this.model.findLine(i.lineId);
    if (line === undefined) {
      this._onDidChange.fire();
      return;
    }
    const waypoints = line.waypoints.map((w, idx) => (idx === i.index ? final : w));
    this.commands.execute(new SetLineWaypointsCommand(i.lineId, waypoints));
  }

  cancelInteraction(): void {
    if (this.interaction === null) {
      return;
    }
    this.interaction = null;
    this._onDidChange.fire();
  }

  /** 作図中の線を確定する（最後の点を終点、手前を waypoint として AddLineCommand）。 */
  commitLine(): void {
    const i = this.interaction;
    if (i === null || i.type !== "draw-line") {
      return;
    }
    this.interaction = null;
    if (i.points.length === 0) {
      // 終点に足る点が無い＝確定できない。作図を破棄して再描画のみ。
      this._onDidChange.fire();
      return;
    }
    if (this.model.findPlayer(i.startPlayerId) === undefined) {
      this._onDidChange.fire();
      return;
    }
    const waypoints = i.points.slice(0, -1);
    const end = i.points[i.points.length - 1] as FieldPosition;
    const id = this.ids.next("line", this.lineIds());
    const line: Line = {
      id,
      kind: DEFAULT_LINE_KIND,
      startPlayerId: i.startPlayerId,
      waypoints: waypoints.map((p) => ({ ...p })),
      end: { ...end },
      interpolation: DEFAULT_LINE_INTERPOLATION,
    };
    this.commands.execute(new AddLineCommand(line));
    this.setSelection({ kind: "line", id });
  }

  // --- アクション（ツールバー/パネルから） --------------------------------

  deleteSelection(): void {
    const s = this.selection;
    if (s === null) {
      return;
    }
    if (s.kind === "player") {
      if (this.model.findPlayer(s.id) !== undefined) {
        this.commands.execute(new RemovePlayerCommand(s.id));
        this.setSelection(null);
      }
      return;
    }
    if (this.model.findLine(s.id) !== undefined) {
      this.commands.execute(new RemoveLineCommand(s.id));
      this.setSelection(null);
    }
  }

  updateSelectedPlayer(patch: PlayerPatch): void {
    const s = this.selection;
    if (s?.kind !== "player" || this.model.findPlayer(s.id) === undefined) {
      return;
    }
    this.commands.execute(new UpdatePlayerCommand(s.id, patch));
  }

  updateSelectedLine(patch: LinePatch): void {
    const s = this.selection;
    if (s?.kind !== "line" || this.model.findLine(s.id) === undefined) {
      return;
    }
    this.commands.execute(new UpdateLineCommand(s.id, patch));
  }

  setFieldZone(zone: FieldZone): void {
    if (zone === this.model.getFieldZone()) {
      return;
    }
    this.commands.execute(new SetFieldZoneCommand(zone));
  }

  /**
   * フォーメーションテンプレートを読み込み選手を自動配置する（PRD 5.6）。
   * 既存選手・線は保持し追記する。id は IdFactory で採番し既存と衝突させない
   * （バッチ内重複も taken に積んで回避＝採番直後の再衝突を防ぐ）。
   * 配置可能な選手が無ければ no-op。1 コマンド = onChange 1 回（M4 契約）。
   */
  loadFormation(formation: Formation): void {
    const taken = new Set(this.model.getData().players.map((p) => p.id));
    const players: Player[] = formation.players.map((fp) => {
      const id = this.ids.next("player", taken);
      taken.add(id);
      const player: Player = {
        id,
        position: { ...fp.position },
        shape: fp.shape,
        label: fp.label,
      };
      if (fp.color !== undefined) {
        player.color = fp.color;
      }
      return player;
    });
    if (players.length === 0) {
      return;
    }
    this.commands.execute(new LoadFormationCommand(players));
    // 読込で局所の選択は意味を失う＝解除（stale な選択を残さない）。
    this.setSelection(null);
  }

  undo(): void {
    this.undoRedo.undo();
  }

  redo(): void {
    this.undoRedo.redo();
  }

  // --- 内部 ----------------------------------------------------------------

  private selectPointerDown(pos: FieldPosition): void {
    const data = this.model.getData();
    // 1) 選択中の線の waypoint ハンドルを最優先で掴む（選手/線と重なっても編集可能に）。
    const s = this.selection;
    if (s?.kind === "line") {
      const line = data.lines.find((l) => l.id === s.id);
      if (line !== undefined) {
        const index = this.hitWaypoint(line, pos);
        if (index !== undefined) {
          const origin = line.waypoints[index] as FieldPosition;
          this.interaction = {
            type: "drag-waypoint",
            lineId: line.id,
            index,
            origin,
            offsetLat: origin.lateralYard - pos.lateralYard,
            offsetAbs: origin.absoluteYard - pos.absoluteYard,
            current: { ...origin },
          };
          this._onDidChange.fire();
          return;
        }
      }
    }
    // 2) 選手（末尾優先）。選択しつつドラッグ開始（move せず up なら単なる選択）。
    const player = hitTestPlayer(data.players, pos);
    if (player !== undefined) {
      this.setSelection({ kind: "player", id: player.id });
      const origin = { ...player.position };
      this.interaction = {
        type: "drag-player",
        playerId: player.id,
        origin,
        offsetLat: origin.lateralYard - pos.lateralYard,
        offsetAbs: origin.absoluteYard - pos.absoluteYard,
        current: origin,
      };
      this._onDidChange.fire();
      return;
    }
    // 3) 線（末尾優先）。
    const line = hitTestLine(data.lines, data.players, pos);
    if (line !== undefined) {
      this.setSelection({ kind: "line", id: line.id });
      return;
    }
    // 4) 何も無ければ選択解除。
    this.setSelection(null);
  }

  private drawLinePointerDown(pos: FieldPosition): void {
    const i = this.interaction;
    if (i?.type === "draw-line") {
      // 作図中: クリックごとに中継点を打つ（最後の点が終点になる）。
      i.points.push({ ...pos });
      i.cursor = { ...pos };
      this._onDidChange.fire();
      return;
    }
    // 起点は必ず選手（Model の不変条件）。選手以外で始めようとしたら無視する。
    const player = hitTestPlayer(this.model.getData().players, pos);
    if (player === undefined) {
      return;
    }
    this.interaction = {
      type: "draw-line",
      startPlayerId: player.id,
      points: [],
      cursor: { ...player.position },
    };
    this._onDidChange.fire();
  }

  private addPlayerAt(pos: FieldPosition): void {
    const taken = new Set(this.model.getData().players.map((p) => p.id));
    const id = this.ids.next("player", taken);
    const player: Player = {
      id,
      position: { ...pos },
      shape: DEFAULT_PLAYER_SHAPE,
      label: "",
    };
    this.commands.execute(new AddPlayerCommand(player));
    this.setSelection({ kind: "player", id });
  }

  private hitWaypoint(line: Line, pos: FieldPosition): number | undefined {
    // 末尾優先（後の waypoint ほど手前に描く想定に合わせる）。点距離は
    // geometry の primitive（退化線分 = 点距離）を再利用し当たり計算を一本化する。
    for (let idx = line.waypoints.length - 1; idx >= 0; idx--) {
      const w = line.waypoints[idx] as FieldPosition;
      if (distanceToSegment(pos, w, w) <= WAYPOINT_HANDLE_RADIUS_YARDS) {
        return idx;
      }
    }
    return undefined;
  }

  private lineIds(): Set<string> {
    return new Set(this.model.getData().lines.map((l) => l.id));
  }
}
