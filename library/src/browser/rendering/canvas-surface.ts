import {
  computeFieldMetrics,
  Disposable,
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
  type EditorDecorations,
  type EditorRenderFrame,
  type RenderFrame,
  renderLayers,
  type SurfaceLayers,
} from "./layer.js";

/**
 * Owns the canvas size, the DPR, and when to redraw, and draws the given diagram layer by layer.
 * What to draw (preview composition, selection highlight) is decided by whoever passes the diagram.
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layers: SurfaceLayers;
  private scene: SceneData;
  private decorations: EditorDecorations | undefined;
  private frameRequest: number | undefined;
  private dpr = 0;
  // Removes the DPR watchers all at once on dispose.
  private readonly lifetime = new AbortController();

  constructor(
    parent: HTMLElement,
    scene: SceneData,
    decorations: EditorDecorations | undefined,
    layers: SurfaceLayers = createDefaultLayers(),
  ) {
    super();
    this.scene = scene;
    this.decorations = decorations;
    this.layers = layers;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "playmaker-canvas";
    parent.appendChild(this.canvas);
    this._register(toDisposable(() => this.canvas.remove()));

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Playmaker: could not get a 2D canvas context.");
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

    // The first draw is left to the ResizeObserver notification after observe. When constructed,
    // the host has not placed the toolbar or panel, so a draw here would be thrown away by the
    // resize that follows.
    this.watchDevicePixelRatio();
    this.redrawWhenFontLoads();
  }

  /** Theme variables are re-read per draw, so a call after the host changes them takes effect. */
  refresh(): void {
    this.invalidate();
  }

  /**
   * Replaces the diagram and the editing decorations. Drawing happens on the next frame, so
   * replacing them any number of times within the same frame draws only once.
   * Omitting the decorations skips editing-only layers like the grid and selection highlight
   * (view mode).
   */
  setScene(scene: SceneData, decorations: EditorDecorations | undefined): void {
    this.scene = scene;
    this.decorations = decorations;
    this.invalidate();
  }

  /** Converts clientX / clientY of a mouse event into a position in yards on the field. */
  clientToYard(clientX: number, clientY: number): FieldPosition {
    const rect = this.canvas.getBoundingClientRect();
    return this.measure().fromCanvas({ x: clientX - rect.left, y: clientY - rect.top });
  }

  /**
   * Exports the given play diagram as a PNG (Blob). Only the diagram layers are drawn, so the grid,
   * selection highlight, and handles stay out. The colors come from the screen's theme variables.
   * Drawing waits for the bundled font, so numbers and labels use it even right after construction.
   */
  async exportToPngBlob(data: SceneData, options?: ImageExportOptions): Promise<Blob> {
    const { width, height } = resolveImageExportSize(data.field.zone, options);
    // Colors are fixed at call time. If the host reverts the variables while the font loads, or if
    // it disposes and the canvas leaves the host, the exported colors do not change.
    const theme = createThemeReader(this.host);
    await loadFieldFont();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Playmaker: could not get a 2D canvas context for the export.");
    }
    const geometry = new FieldGeometry(width, height, data.field);
    this.paint(ctx, this.frameFor(geometry, data, theme), undefined);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Playmaker: could not convert the canvas to a PNG."));
        }
      }, "image/png");
    });
  }

  /**
   * Draws with the fallback font first to avoid a blank screen, then redraws once the bundled font
   * has loaded.
   */
  private redrawWhenFontLoads(): void {
    void loadFieldFont().then(() => {
      if (!this.isDisposed) {
        this.invalidate();
      }
    });
  }

  /** Rebuilds the drawing buffer to match the container size and the DPR. */
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.host;
    const width = Math.max(1, Math.round(clientWidth * dpr));
    const height = Math.max(1, Math.round(clientHeight * dpr));
    // Even if the element resized, the drawn diagram is reusable if the buffer size and DPR match.
    if (width === this.canvas.width && height === this.canvas.height && dpr === this.dpr) {
      return;
    }
    this.dpr = dpr;
    this.canvas.width = width;
    this.canvas.height = height;
    // From here on, drawing uses CSS px coordinates. The geometry is computed in CSS px as well.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Rebuilding the buffer clears its contents, so draw now instead of waiting for the next frame.
    this.cancelFrame();
    this.render();
  }

  // A resolution media query fires change only once, when it no longer matches the current DPR.
  // Each time the browser zoom or the monitor changes, it is re-attached with the new DPR.
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
    // No drawing before the initial size is known. resize draws once it is.
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
    const frame = this.frameFor(this.measure(), this.scene, createThemeReader(this.host));
    this.paint(this.ctx, frame, this.decorations);
  }

  /**
   * Draws the layers in the order field, backdrop, play, editor. Without decorations, editing-only
   * layers (backdrop and editor) are skipped, so view mode and PNG export use only diagram layers.
   */
  private paint(
    ctx: CanvasRenderingContext2D,
    frame: RenderFrame,
    decorations: EditorDecorations | undefined,
  ): void {
    const editorFrame: EditorRenderFrame | undefined =
      decorations === undefined ? undefined : { ...frame, ...decorations };
    renderLayers(ctx, frame, this.layers.field);
    if (editorFrame !== undefined) {
      renderLayers(ctx, editorFrame, this.layers.backdrop);
    }
    renderLayers(ctx, frame, this.layers.play);
    if (editorFrame !== undefined) {
      renderLayers(ctx, editorFrame, this.layers.editor);
    }
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

  // The size and the theme variables are read from the element the canvas was placed in.
  private get host(): HTMLElement {
    return this.canvas.parentElement ?? this.canvas;
  }
}
