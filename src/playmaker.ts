import { CanvasSurface, PointerInput, PropertyPanel, Toolbar } from "./browser/index.js";
import {
  CommandService,
  Disposable,
  DisposableStore,
  EditorController,
  type FieldZone,
  IdFactory,
  type PlayData,
  PlayModel,
  resolvePlayData,
  toDisposable,
  UndoRedoService,
} from "./common/index.js";
import "./styles.css";

export type {
  FieldPosition,
  FieldState,
  FieldZone,
  Line,
  LineInterpolation,
  LineKind,
  PlayData,
  Player,
  PlayerShape,
} from "./common/index.js";

export type PlaymakerMode = "view" | "edit";

export interface PlaymakerOptions {
  /** 既定は "edit"。"view" は読み取り専用（編集 UI を出さない・PRD 5.5）。 */
  mode?: PlaymakerMode;
  /** 初期表示するプレー図データ。欠落・古い形式は既定で補完する。 */
  initialData?: PlayData;
  /** 編集操作のたびに最新の PlayData を通知する（暫定契約。確定は M8）。 */
  onChange?: (data: PlayData) => void;
}

/**
 * ライブラリの公開エントリ。common（Model/コマンド/Undo/EditorController）と
 * browser（Canvas/入力/UI）を結線する。商用ソフトはコンテナとオプションを渡すだけ。
 *
 * 1 セッション = 1 つの Model + 履歴 + UI。setPlayData は履歴ごと作り直す
 * （Model は唯一の状態保持者で setData を持たない＝M4 の API を尊重）。
 */
export class Playmaker extends Disposable {
  readonly mode: PlaymakerMode;
  private readonly root: HTMLElement;
  private readonly surface: CanvasSurface;
  private readonly options: PlaymakerOptions;
  // セッション（Model/コマンド/Undo/Controller/UI/入力）。再読込で丸ごと作り直す。
  private session = new DisposableStore();
  private model: PlayModel;
  private controller: EditorController;

  constructor(container: HTMLElement, options: PlaymakerOptions = {}) {
    super();
    this.options = options;
    this.mode = options.mode ?? "edit";

    this.root = document.createElement("div");
    this.root.className = "playmaker-root";
    this.root.dataset.mode = this.mode;
    container.appendChild(this.root);
    this._register(toDisposable(() => this.root.remove()));

    this.surface = this._register(
      new CanvasSurface(this.root, resolvePlayData(options.initialData)),
    );

    const built = this.buildSession(options.initialData);
    this.model = built.model;
    this.controller = built.controller;
  }

  /** 現在のフィールドゾーン。 */
  get fieldZone(): FieldZone {
    return this.model.getFieldZone();
  }

  /**
   * フィールドゾーンを切り替える（PRD 5.1）。コマンド経由なので Undo/onChange の対象。
   * view モードでもプログラム API としては有効（編集 UI は出さないだけ）。
   */
  setFieldZone(zone: FieldZone): void {
    this.controller.setFieldZone(zone);
  }

  /**
   * プレー図データを丸ごと投入し直す（PRD 5.8 再読込）。履歴はリセットされる。
   * 欠落・古い形式は既定で補完する。正式な往復契約は M8 で確定する。
   */
  setPlayData(data: PlayData): void {
    this.session.dispose();
    this.session = new DisposableStore();
    const built = this.buildSession(data);
    this.model = built.model;
    this.controller = built.controller;
  }

  /**
   * 現在の PlayData のスナップショット（防御的コピー）。
   * 正式な往復契約は M8 で確定する。
   */
  getPlayData(): PlayData {
    return this.model.getData();
  }

  override dispose(): void {
    this.session.dispose();
    super.dispose();
  }

  /**
   * Model/コマンド/Undo/Controller/UI/入力を 1 セッションとして構築し session に束ねる。
   * onDidChange→再描画、model 変更→onChange を配線し、edit のみ UI/入力を出す。
   */
  private buildSession(data: PlayData | undefined): {
    model: PlayModel;
    controller: EditorController;
  } {
    const model = new PlayModel(data);
    const undoRedo = new UndoRedoService(model);
    const commands = new CommandService(model, undoRedo);
    const ids = new IdFactory();
    const controller = this.session.add(new EditorController(model, commands, undoRedo, ids));

    this.session.add(
      controller.onDidChange(() =>
        this.surface.setScene(controller.getRenderModel(), controller.getOverlay()),
      ),
    );
    // Model 変更（編集コマンド・Undo/Redo）のたびに最新 PlayData を通知する。
    // 構築時は発火しない＝再読込は edit ではないので onChange を出さない。
    this.session.add(model.onDidChange((snapshot) => this.options.onChange?.(snapshot)));

    if (this.mode === "edit") {
      this.session.add(new Toolbar(this.root, controller));
      this.session.add(new PropertyPanel(this.root, controller));
      this.session.add(new PointerInput(this.surface, controller));
    }

    this.surface.setScene(controller.getRenderModel(), controller.getOverlay());
    return { model, controller };
  }
}
