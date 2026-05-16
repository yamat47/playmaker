import { Disposable, toDisposable } from "../../common/index.js";

/**
 * Canvas 要素のライフサイクルと解像度（devicePixelRatio）を管理する土台。
 * フィールド/選手/線の描画は以降のマイルストーンでこの上に載せる。
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(parent: HTMLElement) {
    super();

    this.canvas = document.createElement("canvas");
    this.canvas.className = "playmaker-canvas";
    parent.appendChild(this.canvas);
    this._register(toDisposable(() => this.canvas.remove()));

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Playmaker: 2D canvas context を取得できませんでした。");
    }
    this.ctx = ctx;

    const observer = new ResizeObserver(() => this.resize());
    observer.observe(parent);
    this._register(toDisposable(() => observer.disconnect()));

    this.resize();
  }

  /** コンテナサイズと DPR に合わせてバックバッファを再構成し再描画する。 */
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.canvas.parentElement ?? this.canvas;
    this.canvas.width = Math.max(1, Math.round(clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(clientHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  /** M0 では空（背景クリアのみ）。M1 でフィールド描画に置き換える。 */
  private render(): void {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
  }
}
