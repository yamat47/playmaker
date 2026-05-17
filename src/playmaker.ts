import { CanvasSurface, PointerInput, PropertyPanel, Toolbar } from "./browser/index.js";
import {
  CommandService,
  Disposable,
  DisposableStore,
  EditorController,
  type FieldZone,
  type Formation,
  IdFactory,
  type ImageExportOptions,
  migratePlayData,
  normalizeFormation,
  type PlayData,
  PlayModel,
  toDisposable,
  UndoRedoService,
} from "./common/index.js";
import "./styles.css";

export type {
  FieldPosition,
  FieldState,
  FieldZone,
  Formation,
  FormationPlayer,
  FormationSide,
  ImageExportOptions,
  Line,
  LineInterpolation,
  LineKind,
  PlayData,
  Player,
  PlayerShape,
} from "./common/index.js";
export {
  CURRENT_PLAY_DATA_VERSION,
  FORMATION_PRESETS,
  getFormationPreset,
  migratePlayData,
} from "./common/index.js";

export type PlaymakerMode = "view" | "edit";

export interface PlaymakerOptions {
  /** 既定は "edit"。"view" は読み取り専用（編集 UI を出さない・PRD 5.5）。 */
  mode?: PlaymakerMode;
  /**
   * 初期表示するプレー図データ。商用ソフトが永続化した PlayData をそのまま渡せる。
   * 旧版・版なし・未来版・破損データでも `migratePlayData` が現行スキーマへ寄せる
   * （決して投げず復元不能要素のみ除外＝PRD 6.6 の往復契約）。
   */
  initialData?: PlayData;
  /**
   * 編集確定契約（PRD 5.8）：編集コマンドおよび Undo/Redo の確定ごとに **1 回**、
   * 最新 PlayData の深いスナップショット（`version` は常に現行・内部状態と分離）を渡す。
   * 受け手はそのまま永続化でき、書き換えても内部に波及しない。構築時・`setPlayData`
   * での再読込・PNG 出力では発火しない（再読込は編集ではない）。
   */
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
      new CanvasSurface(this.root, migratePlayData(options.initialData)),
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
   * フォーメーションテンプレートを読み込み選手を自動配置する（PRD 5.6）。
   * 既存のプレー図へ追記する（攻守プリセットを順に重ねられる）。外部の
   * カスタム隊形は normalizeFormation で正規化し、配置可能な選手が無ければ no-op。
   * 編集操作なので Undo/onChange の対象（view モードでも API としては有効）。
   * プリセットは公開 `FORMATION_PRESETS` / `getFormationPreset` から取得できる。
   */
  loadFormation(formation: Formation): void {
    const normalized = normalizeFormation(formation);
    if (normalized === null) {
      return;
    }
    this.controller.loadFormation(normalized);
  }

  /**
   * 商用ソフトが永続化した PlayData を後から丸ごと再読込する（PRD 5.8）。
   * 旧版・版なし・未来版・破損データでも `migratePlayData` が現行へ寄せ、決して
   * 投げない。1 セッション = 1 Model なので履歴はリセットされ、再読込は編集では
   * ないため `onChange` は発火しない（編集確定のみが通知契約＝PRD 6.6）。
   */
  setPlayData(data: PlayData): void {
    this.session.dispose();
    this.session = new DisposableStore();
    const built = this.buildSession(data);
    this.model = built.model;
    this.controller = built.controller;
  }

  /**
   * 現在のプレー図の正準スナップショット（深い防御的コピー・`version` は現行）。
   * そのまま JSON 化して永続化でき、後で `setPlayData` / `initialData` に戻すと
   * 同値のプレー図に復元される（PRD 5.8 / 6.6 の往復契約）。
   */
  getPlayData(): PlayData {
    return this.model.getData();
  }

  /**
   * 現在のプレー図を PNG 画像（Blob）として書き出す（PRD 5.7）。
   * エクスポート元はコミット済みの PlayData なので、選択強調・waypoint
   * ハンドル・作図中プレビュー・ツールバー/パネルといった編集 UI は
   * 含まれない。view / edit どちらのモードでも利用できる。
   * `options.width` で出力幅(px)を指定でき、高さは縦横比から導かれる。
   */
  exportToPng(options?: ImageExportOptions): Promise<Blob> {
    return this.surface.exportToPngBlob(this.model.getData(), options);
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
