import {
  Disposable,
  type EditorOverlay,
  FieldGeometry,
  type FieldPosition,
  indexPlayersById,
  lineAnchorPoints,
  PLAYER_RADIUS_YARDS,
  type PlayData,
  sampleLinePath,
  toDisposable,
  WAYPOINT_HANDLE_RADIUS_YARDS,
} from "../../common/index.js";
import { FieldRenderer, type FieldTheme } from "./field-renderer.js";
import { LineRenderer, type LineTheme } from "./line-renderer.js";
import { PlayerRenderer, type PlayerTheme } from "./player-renderer.js";

const EMPTY_OVERLAY: EditorOverlay = { waypointHandles: [] };

/**
 * Canvas のライフサイクル・解像度（DPR）・リサイズを管理し、
 * 「描画モデル + 選択 overlay」を 1 フレームへ合成描画する土台。
 * 何を描くか（プレビュー合成・選択強調）の判断は common(EditorController) が持ち、
 * ここは渡されたシーンを描くだけ（Model–View 分離）。
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fieldRenderer = new FieldRenderer();
  private readonly lineRenderer = new LineRenderer();
  private readonly playerRenderer = new PlayerRenderer();
  private data: PlayData;
  private overlay: EditorOverlay = EMPTY_OVERLAY;
  // 直近 render で確定する。constructor 末尾の resize()→render() で必ず初期化される。
  private geometry!: FieldGeometry;

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

  /** 描画モデルと選択 overlay を差し替えて再描画する（編集のたびに呼ばれる）。 */
  setScene(data: PlayData, overlay: EditorOverlay): void {
    this.data = data;
    this.overlay = overlay;
    this.render();
  }

  /**
   * Canvas クライアント座標（マウスイベントの clientX/Y）をヤード空間へ逆変換する。
   * 入力 → コマンドの土台。geometry が唯一の座標規約なのでここを通す。
   */
  clientToYard(clientX: number, clientY: number): FieldPosition {
    const rect = this.canvas.getBoundingClientRect();
    return this.geometry.fromCanvas({ x: clientX - rect.left, y: clientY - rect.top });
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
    this.geometry = new FieldGeometry(clientWidth, clientHeight, this.data.field.zone);
    // getComputedStyle はスタイル再計算を誘発しうるため 1 render = 1 回に束ねる。
    const read = this.makeReader();
    const { field, line, player } = this.readThemes(read);
    // 線は選手の下に敷く＝起点（選手位置）がマーカーで隠れ、線の根元が綺麗に見える。
    this.fieldRenderer.draw(this.ctx, this.geometry, field);
    this.lineRenderer.draw(this.ctx, this.geometry, this.data.lines, this.data.players, line);
    this.playerRenderer.draw(this.ctx, this.geometry, this.data.players, player);
    this.drawOverlay(read("--playmaker-selection-color", "#ff9800"));
  }

  /**
   * 選択強調と waypoint ハンドルを最前面に描く（編集中の視認用）。
   * 位置計算は common のジオメトリに委譲し、ここは色と図形を置くだけ。
   */
  private drawOverlay(accent: string): void {
    const { selectedPlayerId, selectedLineId, waypointHandles } = this.overlay;

    if (selectedPlayerId !== undefined) {
      const player = this.data.players.find((p) => p.id === selectedPlayerId);
      if (player) {
        const { x, y } = this.geometry.toCanvas(
          player.position.lateralYard,
          player.position.absoluteYard,
        );
        const r = PLAYER_RADIUS_YARDS * this.geometry.scale + 4;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = accent;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    }

    if (selectedLineId !== undefined) {
      const line = this.data.lines.find((l) => l.id === selectedLineId);
      const anchors = line
        ? lineAnchorPoints(line, indexPlayersById(this.data.players))
        : undefined;
      if (line && anchors) {
        const polyline = sampleLinePath(anchors, line.interpolation);
        this.ctx.beginPath();
        polyline.forEach((pt, i) => {
          const { x, y } = this.geometry.toCanvas(pt.lateralYard, pt.absoluteYard);
          if (i === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        });
        this.ctx.strokeStyle = accent;
        this.ctx.lineWidth = 6;
        this.ctx.globalAlpha = 0.35;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
      }
    }

    const handleSize = WAYPOINT_HANDLE_RADIUS_YARDS * this.geometry.scale;
    for (const wp of waypointHandles) {
      const { x, y } = this.geometry.toCanvas(wp.lateralYard, wp.absoluteYard);
      this.ctx.beginPath();
      this.ctx.rect(x - handleSize, y - handleSize, handleSize * 2, handleSize * 2);
      this.ctx.fillStyle = accent;
      this.ctx.fill();
    }
  }

  /**
   * 配色は親要素（.playmaker-root）の CSS 変数から読む。
   * 商用ソフトが --playmaker-* を上書きすれば描画色も追従する（PRD 6.5）。
   */
  private readThemes(read: (name: string, fallback: string) => string): {
    field: FieldTheme;
    line: LineTheme;
    player: PlayerTheme;
  } {
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

  private makeReader(): (name: string, fallback: string) => string {
    const host = this.canvas.parentElement;
    const styles = host ? getComputedStyle(host) : null;
    return (name, fallback) => {
      const v = styles?.getPropertyValue(name).trim();
      return v ? v : fallback;
    };
  }
}
