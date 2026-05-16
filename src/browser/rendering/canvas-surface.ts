import { Disposable, FieldGeometry, type PlayData, toDisposable } from "../../common/index.js";
import { FieldRenderer, type FieldTheme } from "./field-renderer.js";
import { LineRenderer, type LineTheme } from "./line-renderer.js";
import { PlayerRenderer, type PlayerTheme } from "./player-renderer.js";

/**
 * Canvas のライフサイクル・解像度（DPR）・リサイズを管理し、
 * 現在の PlayData（ゾーン + 線 + 選手）を 1 フレームへ合成描画する土台。
 * Model は Playmaker が専有し、ここは渡された PlayData を描くだけ（Model–View 分離）。
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fieldRenderer = new FieldRenderer();
  private readonly lineRenderer = new LineRenderer();
  private readonly playerRenderer = new PlayerRenderer();
  private data: PlayData;

  constructor(parent: HTMLElement, data: PlayData) {
    super();
    this.data = data;

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

  /** 描画対象の PlayData を差し替えて再描画する（ゾーン切替・選手投入の双方）。 */
  setData(data: PlayData): void {
    this.data = data;
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
    const geometry = new FieldGeometry(clientWidth, clientHeight, this.data.field.zone);
    const { field, line, player } = this.readThemes();
    // 線は選手の下に敷く＝起点（選手位置）がマーカーで隠れ、線の根元が綺麗に見える。
    this.fieldRenderer.draw(this.ctx, geometry, field);
    this.lineRenderer.draw(this.ctx, geometry, this.data.lines, this.data.players, line);
    this.playerRenderer.draw(this.ctx, geometry, this.data.players, player);
  }

  /**
   * 配色は親要素（.playmaker-root）の CSS 変数から読む。
   * 商用ソフトが --playmaker-* を上書きすれば描画色も追従する（PRD 6.5）。
   */
  private readThemes(): { field: FieldTheme; line: LineTheme; player: PlayerTheme } {
    const host = this.canvas.parentElement;
    const styles = host ? getComputedStyle(host) : null;
    const read = (name: string, fallback: string): string => {
      const v = styles?.getPropertyValue(name).trim();
      return v ? v : fallback;
    };
    return {
      field: {
        fieldColor: read("--playmaker-field-bg", "#2e7d32"),
        lineColor: read("--playmaker-field-line-color", "rgba(255, 255, 255, 0.85)"),
        numberColor: read("--playmaker-field-number-color", "rgba(255, 255, 255, 0.9)"),
      },
      line: {
        routeColor: read("--playmaker-line-route-color", "#ffeb3b"),
        blockColor: read("--playmaker-line-block-color", "#ffffff"),
        motionColor: read("--playmaker-line-motion-color", "#ffeb3b"),
      },
      player: {
        fillColor: read("--playmaker-player-fill", "#1565c0"),
        strokeColor: read("--playmaker-player-stroke", "rgba(255, 255, 255, 0.9)"),
        labelColor: read("--playmaker-player-label-color", "#ffffff"),
      },
    };
  }
}
