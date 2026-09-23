import {
  CanvasSurface,
  PointerInput,
  PropertyPanel,
  replaceKeepingFocus,
  Toolbar,
} from "./browser/index.js";
import {
  DisposableStore,
  type EditorOverlay,
  type Event,
  type FieldZone,
  type Formation,
  type IDisposable,
  type ImageExportOptions,
  type PlayData,
  type PlayDataInput,
  PlaySession,
  toDisposable,
} from "./common/index.js";
import "./styles.css";

export type {
  Event,
  FieldPosition,
  FieldState,
  FieldZone,
  Formation,
  FormationPlayer,
  IDisposable,
  ImageExportOptions,
  Line,
  LineInterpolation,
  LineKind,
  PlayCategory,
  PlayData,
  PlayDataInput,
  Player,
  PlayerShape,
  PlayPreset,
  TeamSide,
} from "./common/index.js";
export {
  CURRENT_PLAY_DATA_VERSION,
  FIELD_ZONE_LABELS,
  FIELD_ZONE_VALUES,
  FORMATION_PRESETS,
  getFormationPreset,
  getPlayPreset,
  migratePlayData,
  PLAY_PRESETS,
} from "./common/index.js";

export type PlaymakerMode = "view" | "edit";

const NO_OVERLAY: EditorOverlay = { kind: "none" };

// バンドラは process.env.NODE_ENV を文字列に置き換える。置き換えずにブラウザで読み込むと
// process が無く ReferenceError になるので、そのときは本番とみなす。
declare const process: { readonly env: { readonly NODE_ENV?: string } };

function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export interface PlaymakerOptions {
  /**
   * 最初のモード。既定は "edit"。"view" は編集 UI を置かず、ポインタとキーの操作も受けない。
   * あとから `setMode` で切り替えられる。
   */
  mode?: PlaymakerMode | undefined;
  /** 最初に表示する図。`restorePlayData` と同じく、形を確かめずに受け取って今のスキーマへ寄せる。 */
  initialData?: unknown;
  /** 構築時に `onDidChange` へ登録するリスナ。解除するには Playmaker を dispose する。 */
  onChange?: ((data: PlayData) => void) | undefined;
}

/**
 * container の中にプレー図を描き、edit モードでは編集 UI も置く。
 * dispose すると、置いた要素をすべて取り除く。
 * dispose したあとの変更は例外を投げずに何もせず、開発時だけ console.warn で知らせる。
 * getPlayData と fieldZone は、dispose した時点の図を返す。
 */
export class Playmaker implements IDisposable {
  /**
   * 編集コマンドと Undo / Redo の確定ごとに 1 回、最新の図の深いコピーを渡す。
   * `version` は常に現行なので、受け取った値をそのまま永続化できる。
   * 構築時、`setPlayData` と `restorePlayData` での読み込み、PNG の書き出しでは発火しない
   * （読み込みは編集ではないため）。
   * コピーはリスナごとに作るので、受け手が書き換えても、この図とほかのリスナには波及しない。
   * 返り値を dispose すると購読をやめる。
   */
  readonly onDidChange: Event<PlayData>;
  private readonly store = new DisposableStore();
  private readonly root: HTMLElement;
  private readonly surface: CanvasSurface;
  private readonly session: PlaySession;
  private currentMode: PlaymakerMode;
  private panel: PropertyPanel | undefined;
  // 今の controller に付けた描画の購読、UI、入力。controller かモードが変わると付け直す。
  private ui: DisposableStore;

  constructor(container: HTMLElement, options: PlaymakerOptions = {}) {
    this.currentMode = options.mode ?? "edit";
    this.session = this.store.add(new PlaySession(options.initialData));
    this.onDidChange = this.session.onDidChange;
    if (options.onChange !== undefined) {
      this.store.add(this.session.onDidChange(options.onChange));
    }

    this.root = document.createElement("div");
    this.root.className = "playmaker-root";
    this.root.dataset.mode = this.currentMode;
    container.appendChild(this.root);
    this.store.add(toDisposable(() => this.root.remove()));

    const stage = document.createElement("div");
    stage.className = "playmaker-stage";
    this.root.appendChild(stage);
    this.surface = this.store.add(new CanvasSurface(stage, this.session.getSnapshot()));
    // CanvasSurface は構築したときに同じ図を描くので、ここでは描き直さない。
    this.ui = this.createUi();
    this.store.add(this.session.onDidReset(() => this.attachUi()));
  }

  get mode(): PlaymakerMode {
    return this.currentMode;
  }

  /**
   * モードを切り替える。図と Undo の履歴は残し、編集 UI とポインタ、キーの入力だけを付け外しする。
   * view にすると、ドラッグや作図の途中の操作は取り消し、選択の強調も描かない。
   */
  setMode(mode: PlaymakerMode): void {
    if (this.ignoreAfterDispose("setMode") || mode === this.currentMode) {
      return;
    }
    this.currentMode = mode;
    this.root.dataset.mode = mode;
    if (mode === "view") {
      this.session.controller.cancelInteraction();
    }
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
    if (this.ignoreAfterDispose("setFieldZone")) {
      return;
    }
    this.session.setFieldZone(zone);
  }

  /**
   * 隊形の選手を今の図に追記し、置いたら true を返す。攻守の隊形を順に重ねられる。
   * 選手の位置は LOS からの相対（`lateralYard` と `downfieldYard`）で書く。
   * 外から渡した隊形は正規化してから読むので、位置の読めない選手は捨てる。
   * 置ける選手が 1 人もいないときと、置くと選手が 64 人を超えるときは、1 人も置かずに false を返す。
   * 編集なので Undo と onDidChange の対象になる。view モードでも呼べる。
   */
  loadFormation(formation: Formation): boolean {
    if (this.ignoreAfterDispose("loadFormation")) {
      return false;
    }
    return this.session.loadFormation(formation);
  }

  /**
   * 型付きで組み立てた図を読み込み、今の図と置き換える。`getPlayData` の戻り値や、
   * プリセットの `data` もそのまま渡せる。
   * 型に合っていても、重複した id と件数の上限を超えた分は `restorePlayData` と同じく正規化する。
   * 読み込みは編集ではないので、Undo の履歴は消え、onDidChange は発火しない。
   */
  setPlayData(data: PlayDataInput): void {
    if (this.ignoreAfterDispose("setPlayData")) {
      return;
    }
    this.session.setPlayData(data);
  }

  /**
   * 永続化しておいた値を、形を確かめずに受け取って読み込み、今の図と置き換える。
   * 旧版、版の無いもの、未来版、壊れたデータも、例外を投げずに今のスキーマへ寄せ、読めない要素だけを捨てる。
   * 選手 64 人、線 128 本、線 1 本あたり waypoint 32 個を超える分は、先頭から上限までを残して捨てる。
   * 読み込みは編集ではないので、Undo の履歴は消え、onDidChange は発火しない。
   */
  restorePlayData(raw: unknown): void {
    if (this.ignoreAfterDispose("restorePlayData")) {
      return;
    }
    this.session.setPlayData(raw);
  }

  /**
   * 今の図の深いコピー。`version` は常に現行で、そのまま JSON にして永続化できる。
   * `restorePlayData` か `initialData` に戻すと、同じ図になる。
   * 編集でも件数の上限は超えられず、上限に達すると選手の追加、フォーメーションの読み込み、作図は何もしない。
   */
  getPlayData(): PlayData {
    return this.session.getPlayData();
  }

  /**
   * 呼んだ時点で確定しているプレー図を PNG 画像（Blob）として書き出す。
   * 選択の強調、waypoint のハンドル、ドラッグや作図の途中の形、ツールバーとパネルは入らない。
   * view と edit のどちらのモードでも使える。
   * 同梱フォントを読み込み終えてから描くので、構築の直後に呼んでもヤードの数字と選手のラベルは同梱フォントになる。
   * フォントを読み込めなかったときは代わりのフォントで描く。
   * canvas を確保できないとき、PNG に変換できないとき、dispose したあとは、例外を投げずに reject する。
   */
  exportToPng(options?: ImageExportOptions): Promise<Blob> {
    if (this.store.isDisposed) {
      return Promise.reject(new Error("Playmaker: dispose したあとは PNG を書き出せません。"));
    }
    return this.surface.exportToPngBlob(this.session.getSnapshot(), options);
  }

  /**
   * 図とパネルの色を、テーマの CSS 変数から読み直す。CSS 変数を変えてもブラウザは知らせてこないので、
   * ホストが祖先の要素で変数を変えたあとに呼ぶ。
   */
  refresh(): void {
    if (this.ignoreAfterDispose("refresh")) {
      return;
    }
    this.surface.refresh();
    this.panel?.refresh();
  }

  dispose(): void {
    this.ui.dispose();
    this.store.dispose();
  }

  private ignoreAfterDispose(method: string): boolean {
    if (!this.store.isDisposed) {
      return false;
    }
    if (isDevelopment()) {
      console.warn(`Playmaker: dispose したあとに ${method} を呼んだので、何もしません。`);
    }
    return true;
  }

  private attachUi(): void {
    // view では canvas がフォーカスを受けないので、消えたフォーカスは body に落ちたままになる。
    replaceKeepingFocus(this.root, this.surface.canvas, () => {
      this.ui.dispose();
      this.ui = this.createUi();
    });
    this.draw();
  }

  private createUi(): DisposableStore {
    const ui = new DisposableStore();
    const controller = this.session.controller;
    ui.add(controller.onDidChangeScene(() => this.draw()));
    this.panel = undefined;
    if (this.currentMode === "edit") {
      ui.add(new Toolbar(this.root, controller));
      this.panel = ui.add(new PropertyPanel(this.root, controller, this.surface.canvas));
      ui.add(new PointerInput(this.root, this.surface, controller));
    }
    return ui;
  }

  private draw(): void {
    const { scene, overlay } = this.session.controller.getFrame();
    this.surface.setScene(scene, this.currentMode === "edit" ? overlay : NO_OVERLAY);
  }
}
