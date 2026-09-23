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
import { loadFieldFont } from "../theme/field-font-face.js";
import { createThemeReader } from "../theme/theme-reader.js";
import type { ThemeReader } from "../theme/tokens.js";
import {
  createDefaultLayers,
  type EditorRenderFrame,
  type RenderFrame,
  renderLayers,
  type SurfaceLayers,
} from "./layer.js";

/**
 * Canvas の大きさ、DPR、再描画の時機を受け持ち、渡された図を層ごとに描く。
 * 何を描くか（プレビューの合成、選択の強調）は EditorController が決める。
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layers: SurfaceLayers;
  private scene: SceneData;
  private overlay: EditorOverlay = { kind: "none" };
  private frameRequest: number | undefined;
  private dpr = 0;
  // 破棄するときに、DPR の見張りをまとめて外す。
  private readonly lifetime = new AbortController();

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
    this._register(
      toDisposable(() => {
        observer.disconnect();
        this.lifetime.abort();
        this.cancelFrame();
      }),
    );

    // 最初の描画は、observe した直後の ResizeObserver の通知で行う。構築した時点ではホストが
    // ツールバーやパネルをまだ並べておらず、ここで描くとすぐに大きさが変わって描き直しになる。
    this.watchDevicePixelRatio();
    this.redrawWhenFontLoads();
  }

  /** テーマ変数は描くたびに読み直すので、ホストが変数を変えたあとに呼べば反映される。 */
  refresh(): void {
    this.invalidate();
  }

  /**
   * 図とオーバーレイを差し替える。描くのは次のフレームなので、
   * 同じフレームの中で何度差し替えても描くのは 1 回になる。
   */
  setScene(scene: SceneData, overlay: EditorOverlay): void {
    this.scene = scene;
    this.overlay = overlay;
    this.invalidate();
  }

  /** マウスイベントの clientX / clientY を、フィールドのヤードの位置に変える。 */
  clientToYard(clientX: number, clientY: number): FieldPosition {
    const rect = this.canvas.getBoundingClientRect();
    return this.measure().fromCanvas({ x: clientX - rect.left, y: clientY - rect.top });
  }

  /**
   * 指定したプレー図を PNG（Blob）として書き出す。図の層だけで描くので、選択の強調と
   * ハンドルは入らない。配色は画面と同じテーマ変数から読む。
   * 同梱フォントを読み込み終えてから描くので、構築の直後でも数字とラベルは同梱フォントになる。
   */
  async exportToPngBlob(data: SceneData, options?: ImageExportOptions): Promise<Blob> {
    const { width, height } = resolveImageExportSize(data.field.zone, options);
    // 配色は呼んだ時点の変数で決める。フォントを待つ間にホストが変数を戻したり、破棄して canvas が
    // host から外れたりしても、書き出す色は変わらない。
    const theme = createThemeReader(this.host);
    await loadFieldFont();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Playmaker: エクスポート用 2D canvas context を取得できませんでした。");
    }
    const geometry = new FieldGeometry(width, height, data.field);
    renderLayers(ctx, this.frameFor(geometry, data, theme), this.layers.play);
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

  /** 初回は代わりのフォントで描いて白い画面を避け、同梱フォントを読み込めたら描き直す。 */
  private redrawWhenFontLoads(): void {
    void loadFieldFont().then(() => {
      if (!this.isDisposed) {
        this.invalidate();
      }
    });
  }

  /** コンテナの大きさと DPR に合わせて、描画用のバッファを作り直す。 */
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.host;
    const width = Math.max(1, Math.round(clientWidth * dpr));
    const height = Math.max(1, Math.round(clientHeight * dpr));
    // 要素の大きさが変わっても、バッファの大きさと DPR が同じなら描いた図がそのまま使える。
    if (width === this.canvas.width && height === this.canvas.height && dpr === this.dpr) {
      return;
    }
    this.dpr = dpr;
    this.canvas.width = width;
    this.canvas.height = height;
    // 以降は CSS px の座標で描く。geometry も CSS px で求める。
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // バッファを作り直すと中身が消えるので、次のフレームを待たずに描く。
    this.cancelFrame();
    this.render();
  }

  // resolution の media query は、今の DPR と合わなくなったときに 1 回だけ change を出す。
  // ブラウザの拡大率やモニタが変わるたびに、新しい DPR で張り直す。
  private watchDevicePixelRatio(): void {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener(
      "change",
      () => {
        this.resize();
        this.watchDevicePixelRatio();
      },
      { once: true, signal: this.lifetime.signal },
    );
  }

  private invalidate(): void {
    // 最初の大きさが決まる前は描かない。決まったときに resize が描く。
    if (this.frameRequest !== undefined || this.dpr === 0) {
      return;
    }
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = undefined;
      this.render();
    });
  }

  private cancelFrame(): void {
    if (this.frameRequest !== undefined) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = undefined;
    }
  }

  private render(): void {
    const frame: EditorRenderFrame = {
      ...this.frameFor(this.measure(), this.scene, createThemeReader(this.host)),
      overlay: this.overlay,
    };
    renderLayers(this.ctx, frame, this.layers.play);
    renderLayers(this.ctx, frame, this.layers.editor);
  }

  private frameFor(geometry: FieldGeometry, scene: SceneData, theme: ThemeReader): RenderFrame {
    return {
      geometry,
      metrics: computeFieldMetrics(geometry.fieldPixelWidth, geometry.scale),
      scene,
      theme,
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
