import type { Event } from "../base/event.js";
import type { LinePatch } from "../commands/line-commands.js";
import type { PlayerPatch } from "../commands/player-commands.js";
import type { Formation } from "../formations/formation.js";
import type { Line } from "../model/line.js";
import type { FieldZone, PlayData } from "../model/play-data.js";
import type { FieldPosition, Player } from "../model/player.js";

export const EDITOR_TOOL_VALUES = ["select", "add-player", "draw-line"] as const;

export type EditorTool = (typeof EDITOR_TOOL_VALUES)[number];

/** 選択は id の希望であり、対象が消えても解除しない。読み取るときに実在を確かめる。 */
export type EditorSelection =
  | { readonly kind: "player"; readonly id: string }
  | { readonly kind: "line"; readonly id: string }
  | null;

/** 描画するプレー図。版は保存するときだけ要るので持たない。 */
export type SceneData = Omit<PlayData, "version">;

/** 選択の強調とハンドルを描く位置（ヤード空間）。 */
export type EditorOverlay =
  | { readonly kind: "none" }
  | { readonly kind: "player"; readonly playerId: string }
  | {
      readonly kind: "line";
      readonly waypointHandles: readonly FieldPosition[];
      readonly endpointHandle: FieldPosition;
    };

export interface EditorViewState {
  readonly tool: EditorTool;
  readonly selection: EditorSelection;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly fieldZone: FieldZone;
  /** 線を作図中（確定か取り消し待ち）か。 */
  readonly isDrawing: boolean;
}

/** 1 回の描画に要るもの。オーバーレイは scene と同じ途中の状態から求める。 */
export interface EditorFrame {
  /** 確定済みのプレー図に、ドラッグや作図の途中の状態を重ねたもの。 */
  readonly scene: SceneData;
  readonly overlay: EditorOverlay;
}

/** 描画と UI の同期に使う読み取り面。 */
export interface IEditorScene {
  /** getFrame の結果が変わったかもしれないときに、1 つの操作につき 1 回発火する。 */
  readonly onDidChangeScene: Event<void>;
  /**
   * getViewState か、選択中の選手や線の値が変わったときだけ発火する。
   * ドラッグ中の移動のように、描く図だけが変わる操作では発火しない。
   */
  readonly onDidChangeViewState: Event<void>;
  getViewState(): EditorViewState;
  /** 選手を選択していないか、対象が消えていれば undefined。 */
  getSelectedPlayer(): Player | undefined;
  /** 線を選択していないか、対象が消えていれば undefined。 */
  getSelectedLine(): Line | undefined;
  getFrame(): EditorFrame;
}

/** ポインタの操作（ヤード空間）。 */
export interface IEditorGestures {
  pointerDown(pos: FieldPosition): void;
  pointerMove(pos: FieldPosition): void;
  pointerUp(pos: FieldPosition): void;
}

/** ツールバー、パネル、キー操作から呼ぶ編集。 */
export interface IEditorActions {
  setTool(tool: EditorTool): void;
  commitLine(): void;
  cancelInteraction(): void;
  deleteSelection(): void;
  updateSelectedPlayer(patch: PlayerPatch): void;
  updateSelectedLine(patch: LinePatch): void;
  setFieldZone(zone: FieldZone): void;
  /**
   * 選手を既存の図に追記する。置ける選手が無いときと、置くと上限を超えるときは何もしない。
   */
  loadFormation(formation: Formation): void;
  /** 作図中は最後の打点を取り消し、履歴には触れない。 */
  undo(): void;
  redo(): void;
}

/** ツールバーやパネルのように、表示を読んで編集を呼ぶ UI が使う面。 */
export type IEditorUi = IEditorActions & IEditorScene;

export interface IEditorController extends IEditorScene, IEditorGestures, IEditorActions {}
