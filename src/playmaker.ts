import { CanvasSurface } from "./browser/index.js";
import {
  cloneLine,
  clonePlayer,
  Disposable,
  type FieldZone,
  type PlayData,
  resolvePlayData,
  toDisposable,
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
  /** 既定は "edit"。"view" は読み取り専用（編集 UI を出さない）。 */
  mode?: PlaymakerMode;
  /** 初期表示するプレー図データ。欠落・古い形式は既定で補完する。 */
  initialData?: PlayData;
  /** 編集操作のたびに最新の PlayData を通知する（発火は M4 以降）。 */
  onChange?: (data: PlayData) => void;
}

/**
 * ライブラリの公開エントリ。common / browser 層を結線する。
 * 商用ソフト側はコンテナ要素とオプションを渡すだけで使える。
 */
export class Playmaker extends Disposable {
  readonly mode: PlaymakerMode;
  private readonly root: HTMLElement;
  private readonly surface: CanvasSurface;
  // Model は Playmaker が専有し、View(CanvasSurface) は描画のみ（Model–View 分離）。
  private data: PlayData;

  constructor(container: HTMLElement, options: PlaymakerOptions = {}) {
    super();
    this.mode = options.mode ?? "edit";
    this.data = resolvePlayData(options.initialData);

    this.root = document.createElement("div");
    this.root.className = "playmaker-root";
    this.root.dataset.mode = this.mode;
    container.appendChild(this.root);
    this._register(toDisposable(() => this.root.remove()));

    this.surface = this._register(new CanvasSurface(this.root, this.data));
  }

  /** 現在のフィールドゾーン。 */
  get fieldZone(): FieldZone {
    return this.data.field.zone;
  }

  /**
   * フィールドゾーンを切り替える（PRD 5.1）。
   * onChange 通知は編集コマンド機構を入れる M4 以降で配線する。
   */
  setFieldZone(zone: FieldZone): void {
    if (zone === this.data.field.zone) {
      return;
    }
    this.data = { ...this.data, field: { ...this.data.field, zone } };
    this.surface.setData(this.data);
  }

  /**
   * プレー図データを丸ごと投入し直す（PRD 5.2 の「PlayData 投入で選手表示」/ 5.8 再読込）。
   * 欠落・古い形式は既定で補完する。正式な往復契約は M8 で確定する。
   */
  setPlayData(data: PlayData): void {
    this.data = resolvePlayData(data);
    this.surface.setData(this.data);
  }

  /**
   * 現在の PlayData のスナップショット（防御的コピー）。
   * 正式な往復契約は M8 で確定する。
   */
  getPlayData(): PlayData {
    return {
      version: 1,
      field: { ...this.data.field },
      players: this.data.players.map(clonePlayer),
      lines: this.data.lines.map(cloneLine),
    };
  }
}
