import { CanvasSurface, PointerInput, PropertyPanel, Toolbar } from "./browser/index.js";
import {
  Disposable,
  DisposableStore,
  type FieldZone,
  type Formation,
  type ImageExportOptions,
  type PlayData,
  PlaySession,
  toDisposable,
} from "./common/index.js";
import "./styles.css";

export type {
  FieldPosition,
  FieldState,
  FieldZone,
  Formation,
  FormationPlayer,
  ImageExportOptions,
  Line,
  LineInterpolation,
  LineKind,
  PlayCategory,
  PlayData,
  Player,
  PlayerShape,
  PlayPreset,
  TeamSide,
} from "./common/index.js";
export {
  CURRENT_PLAY_DATA_VERSION,
  FORMATION_PRESETS,
  getFormationPreset,
  getPlayPreset,
  migratePlayData,
  PLAY_PRESETS,
} from "./common/index.js";

export type PlaymakerMode = "view" | "edit";

export interface PlaymakerOptions {
  /** 既定は "edit"。"view" は読み取り専用（編集 UI を出さない・PRD 5.5）。 */
  mode?: PlaymakerMode;
  /**
   * 初期表示するプレー図データ。商用ソフトが永続化した PlayData をそのまま渡せる。
   * 旧版・版なし・未来版・破損データでも `migratePlayData` が現行スキーマへ寄せる
   * （決して投げず復元不能要素のみ除外＝PRD 6.6 の往復契約）。
   * 選手 64 人、線 128 本、線 1 本あたり waypoint 32 個を超える分は、
   * 先頭から上限までを残して捨てる。
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
 * container の中にプレー図を描き、edit モードでは編集 UI も置く。
 * dispose すると、置いた要素をすべて取り除く。
 */
export class Playmaker extends Disposable {
  readonly mode: PlaymakerMode;
  private readonly root: HTMLElement;
  private readonly surface: CanvasSurface;
  private readonly session: PlaySession;
  // 今の controller に付けた描画の購読、UI、入力。setPlayData で controller が変わると付け直す。
  private ui = new DisposableStore();

  constructor(container: HTMLElement, options: PlaymakerOptions = {}) {
    super();
    this.mode = options.mode ?? "edit";
    this.session = this._register(new PlaySession(options.initialData, options.onChange));

    this.root = document.createElement("div");
    this.root.className = "playmaker-root";
    this.root.dataset.mode = this.mode;
    container.appendChild(this.root);
    this._register(toDisposable(() => this.root.remove()));

    this.surface = this._register(new CanvasSurface(this.root, this.session.getSnapshot()));
    this._register(this.session.onDidReset(() => this.attachUi()));
    this.attachUi();
  }

  /** 現在のフィールドゾーン。 */
  get fieldZone(): FieldZone {
    return this.session.fieldZone;
  }

  /**
   * フィールドゾーンを切り替える（PRD 5.1）。コマンド経由なので Undo/onChange の対象。
   * view モードでもプログラム API としては有効（編集 UI は出さないだけ）。
   */
  setFieldZone(zone: FieldZone): void {
    this.session.setFieldZone(zone);
  }

  /**
   * フォーメーションテンプレートを読み込み選手を自動配置する（PRD 5.6）。
   * 既存のプレー図へ追記する（攻守プリセットを順に重ねられる）。外部の
   * カスタム隊形は正規化してから読み、配置可能な選手が無ければ no-op。
   * 置くと選手が 64 人を超えるときも、1 人も置かずに no-op。
   * 編集操作なので Undo/onChange の対象（view モードでも API としては有効）。
   * プリセットは公開 `FORMATION_PRESETS` / `getFormationPreset` から取得できる。
   */
  loadFormation(formation: Formation): void {
    this.session.loadFormation(formation);
  }

  /**
   * 商用ソフトが永続化した PlayData を後から丸ごと再読込する（PRD 5.8）。
   * 旧版・版なし・未来版・破損データでも `migratePlayData` が現行へ寄せ、決して
   * 投げない。1 セッション = 1 Model なので履歴はリセットされ、再読込は編集では
   * ないため `onChange` は発火しない（編集確定のみが通知契約＝PRD 6.6）。
   * 件数の上限は `initialData` と同じで、超えた分は捨てる。
   */
  setPlayData(data: PlayData): void {
    this.session.setPlayData(data);
  }

  /**
   * 現在のプレー図の正準スナップショット（深い防御的コピー・`version` は現行）。
   * そのまま JSON 化して永続化でき、後で `setPlayData` / `initialData` に戻すと
   * 同値のプレー図に復元される（PRD 5.8 / 6.6 の往復契約）。
   * 編集でも件数の上限（`initialData` を参照）は超えられず、上限に達すると
   * 選手の追加、フォーメーションの読み込み、作図は何もしない。
   */
  getPlayData(): PlayData {
    return this.session.getPlayData();
  }

  /**
   * 現在のプレー図を PNG 画像（Blob）として書き出す（PRD 5.7）。
   * エクスポート元はコミット済みの PlayData なので、選択強調・waypoint
   * ハンドル・作図中プレビュー・ツールバー/パネルといった編集 UI は
   * 含まれない。view / edit どちらのモードでも利用できる。
   * `options.width` で出力幅(px)を指定でき、高さは縦横比から導かれる。
   */
  exportToPng(options?: ImageExportOptions): Promise<Blob> {
    return this.surface.exportToPngBlob(this.session.getSnapshot(), options);
  }

  override dispose(): void {
    this.ui.dispose();
    super.dispose();
  }

  private attachUi(): void {
    this.ui.dispose();
    this.ui = new DisposableStore();
    const controller = this.session.controller;
    const draw = (): void => {
      const { scene, overlay } = controller.getFrame();
      this.surface.setScene(scene, overlay);
    };
    this.ui.add(controller.onDidChangeScene(draw));
    if (this.mode === "edit") {
      this.ui.add(new Toolbar(this.root, controller));
      this.ui.add(new PropertyPanel(this.root, controller));
      this.ui.add(new PointerInput(this.root, this.surface, controller));
    }
    draw();
  }
}
