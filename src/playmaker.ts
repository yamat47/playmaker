import { CanvasSurface } from "./browser/index.js";
import { Disposable, toDisposable } from "./common/index.js";
import "./styles.css";

export type PlaymakerMode = "view" | "edit";

/**
 * 商用ソフトに保存・復元されるプレー図データ。
 * version でスキーマ進化に備える（マイグレーション機構は M8 で実装）。
 * フィールド/選手/線の具体スキーマは M1〜M3 で確定する。
 */
export interface PlayData {
  version: 1;
}

export interface PlaymakerOptions {
  /** 既定は "edit"。"view" は読み取り専用（編集 UI を出さない）。 */
  mode?: PlaymakerMode;
  /** 初期表示するプレー図データ。 */
  initialData?: PlayData;
  /** 編集操作のたびに最新の PlayData を通知する（M4 以降で発火）。 */
  onChange?: (data: PlayData) => void;
}

/**
 * ライブラリの公開エントリ。common / browser 層を結線する。
 * 商用ソフト側はコンテナ要素とオプションを渡すだけで使える。
 */
export class Playmaker extends Disposable {
  readonly mode: PlaymakerMode;
  private readonly root: HTMLElement;

  constructor(container: HTMLElement, options: PlaymakerOptions = {}) {
    super();
    this.mode = options.mode ?? "edit";

    this.root = document.createElement("div");
    this.root.className = "playmaker-root";
    this.root.dataset.mode = this.mode;
    container.appendChild(this.root);
    this._register(toDisposable(() => this.root.remove()));

    this._register(new CanvasSurface(this.root));
  }
}
