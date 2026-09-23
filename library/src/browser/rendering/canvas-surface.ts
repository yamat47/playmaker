import {
  computeFieldMetrics,
  Disposable,
  type EditorOverlay,
  FieldGeometry,
  type FieldPosition,
  type ImageExportOptions,
  resolveImageExportSize,
  type SceneData,
  toDisposable,
} from "../../common/index.js";
import { FIELD_FONT_FAMILY } from "../theme/field-font.js";
import { createThemeReader } from "../theme/theme-reader.js";
import {
  createDefaultLayers,
  type EditorRenderFrame,
  type RenderFrame,
  renderLayers,
  type SurfaceLayers,
} from "./layer.js";

/**
 * Canvas の大きさと DPR を受け持ち、渡された図を層ごとに描く。
 * 何を描くか（プレビューの合成、選択の強調）は EditorController が決める。
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layers: SurfaceLayers;
  private scene: SceneData;
  private overlay: EditorOverlay = { kind: "none" };

  constructor(
    parent: HTMLElement,
    scene: SceneData,
    layers: SurfaceLayers = createDefaultLayers(),
  ) {
    super();
    this.scene = scene;
    this.layers = layers;

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
    this.renderWhenFontReady();
  }

  /** テーマ変数は描くたびに読み直すので、ホストが変数を変えたあとに呼べば反映される。 */
  refresh(): void {
    this.render();
  }

  setScene(scene: SceneData, overlay: EditorOverlay): void {
    this.scene = scene;
    this.overlay = overlay;
    this.render();
  }

  /** マウスイベントの clientX / clientY を、フィールドのヤードの位置に変える。 */
  clientToYard(clientX: number, clientY: number): FieldPosition {
    const rect = this.canvas.getBoundingClientRect();
    return this.measure().fromCanvas({ x: clientX - rect.left, y: clientY - rect.top });
  }

  /**
   * 指定したプレー図を PNG（Blob）として書き出す。図の層だけで描くので、選択の強調と
   * ハンドルは入らない。配色は画面と同じテーマ変数から読む。
   */
  exportToPngBlob(data: SceneData, options?: ImageExportOptions): Promise<Blob> {
    const { width, height } = resolveImageExportSize(data.field.zone, options);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Playmaker: エクスポート用 2D canvas context を取得できませんでした。");
    }
    const geometry = new FieldGeometry(width, height, data.field);
    renderLayers(ctx, this.frameFor(geometry, data), this.layers.play);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Playmaker: PNG への変換に失敗しました。"));
        }
      }, "image/png");
    });
  }

  /**
   * 同梱フォントは CSS を読んだあとで非同期に読み込まれる。初回は代わりのフォントで描いて
   * 白い画面を避け、読み込めたら描き直して同梱フォントに差し替える。
   */
  private renderWhenFontReady(): void {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const fontSpec = `700 1em ${FIELD_FONT_FAMILY}`;
    if (!fonts || fonts.check(fontSpec)) {
      return;
    }
    fonts.load(fontSpec).then(
      () => {
        if (!this.isDisposed) {
          this.render();
        }
      },
      () => {
        // 読み込めなくても、代わりのフォントのまま図は描ける。
      },
    );
  }

  /** コンテナの大きさと DPR に合わせて、描画用のバッファを作り直す。 */
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.host;
    this.canvas.width = Math.max(1, Math.round(clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(clientHeight * dpr));
    // 以降は CSS px の座標で描く。geometry も CSS px で求める。
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  private render(): void {
    const frame: EditorRenderFrame = {
      ...this.frameFor(this.measure(), this.scene),
      overlay: this.overlay,
    };
    renderLayers(this.ctx, frame, this.layers.play);
    renderLayers(this.ctx, frame, this.layers.editor);
  }

  private frameFor(geometry: FieldGeometry, scene: SceneData): RenderFrame {
    return {
      geometry,
      metrics: computeFieldMetrics(geometry.fieldPixelWidth, geometry.scale),
      scene,
      theme: createThemeReader(this.host),
    };
  }

  private measure(): FieldGeometry {
    const { clientWidth, clientHeight } = this.host;
    return new FieldGeometry(clientWidth, clientHeight, this.scene.field);
  }

  // 大きさとテーマ変数は、canvas を置いた要素から読む。
  private get host(): HTMLElement {
    return this.canvas.parentElement ?? this.canvas;
  }
}
