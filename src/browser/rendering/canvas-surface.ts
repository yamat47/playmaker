import { Disposable, FieldGeometry, type FieldZone, toDisposable } from "../../common/index.js";
import { FieldRenderer, type FieldTheme } from "./field-renderer.js";

/**
 * Canvas のライフサイクル・解像度（DPR）・リサイズを管理し、
 * 現在のゾーンに対応するフィールドを描く土台。
 * 選手/線の描画は M2・M3 でこの上に重ねる。
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fieldRenderer = new FieldRenderer();
  private zone: FieldZone;

  constructor(parent: HTMLElement, zone: FieldZone) {
    super();
    this.zone = zone;

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

  /** ゾーンを切り替えて再描画する（PRD 5.1 のゾーン切替）。 */
  setZone(zone: FieldZone): void {
    if (zone === this.zone) {
      return;
    }
    this.zone = zone;
    this.render();
  }

  /** コンテナサイズと DPR に合わせてバックバッファを再構成し再描画する。 */
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.canvas.parentElement ?? this.canvas;
    this.canvas.width = Math.max(1, Math.round(clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(clientHeight * dpr));
    // 以降は CSS px 空間で描く（geometry も CSS px で算出）。
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  private render(): void {
    const { clientWidth, clientHeight } = this.canvas.parentElement ?? this.canvas;
    const geometry = new FieldGeometry(clientWidth, clientHeight, this.zone);
    this.fieldRenderer.draw(this.ctx, geometry, this.readTheme());
  }

  /**
   * 配色は親要素（.playmaker-root）の CSS 変数から読む。
   * 商用ソフトが --playmaker-* を上書きすればフィールド色も追従する（PRD 6.5）。
   */
  private readTheme(): FieldTheme {
    const host = this.canvas.parentElement;
    const styles = host ? getComputedStyle(host) : null;
    const read = (name: string, fallback: string): string => {
      const v = styles?.getPropertyValue(name).trim();
      return v ? v : fallback;
    };
    return {
      fieldColor: read("--playmaker-field-bg", "#2e7d32"),
      lineColor: read("--playmaker-field-line-color", "rgba(255, 255, 255, 0.85)"),
      numberColor: read("--playmaker-field-number-color", "rgba(255, 255, 255, 0.9)"),
    };
  }
}
