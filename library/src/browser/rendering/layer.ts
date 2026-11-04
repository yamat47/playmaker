import type { EditorOverlay, FieldGeometry, FieldMetrics, SceneData } from "../../common/index.js";
import type { ThemeReader } from "../theme/tokens.js";
import { FieldRenderer } from "./field-renderer.js";
import { GridRenderer } from "./grid-renderer.js";
import { LineRenderer } from "./line-renderer.js";
import { OverlayRenderer } from "./overlay-renderer.js";
import { PlayerRenderer } from "./player-renderer.js";

/** The input shared by the diagram layers in one rendering pass. */
export interface RenderFrame {
  readonly geometry: FieldGeometry;
  readonly metrics: FieldMetrics;
  readonly scene: SceneData;
  readonly theme: ThemeReader;
}

/**
 * The input only the editor layers receive. The overlay is never passed to the diagram layers, so
 * no selection highlight or handle can slip into a diagram exported as PNG.
 */
export interface EditorRenderFrame extends RenderFrame {
  readonly overlay: EditorOverlay;
}

/**
 * Draws one layer of the diagram. ctx already has the DPR transform applied, so drawing can use
 * CSS px coordinates. Each layer is wrapped in save and restore, so it need not reset ctx state.
 */
export interface ILayerRenderer<F extends RenderFrame = RenderFrame> {
  // With method syntax the parameter is checked bivariantly, and putting an editor layer among the
  // diagram layers would not be a type error.
  readonly draw: (ctx: CanvasRenderingContext2D, frame: F) => void;
}

/**
 * The layers that draw the diagram (field and play) and the layers inserted only while editing
 * (backdrop and editor). The drawing order is field, backdrop, play, editor. PNG export and view
 * mode draw only the diagram layers, so the grid, selection highlight, and handles never reach the
 * exported image or the read-only screen.
 */
export interface SurfaceLayers {
  /** The field. The diagram layers drawn below the editing-time backdrop. */
  readonly field: readonly ILayerRenderer[];
  /** Editing-only layers between the field and the lines and players. Holds the position grid. */
  readonly backdrop: readonly ILayerRenderer<EditorRenderFrame>[];
  /** The lines and players. */
  readonly play: readonly ILayerRenderer[];
  /** Layers overlaid on the diagram only while editing. */
  readonly editor: readonly ILayerRenderer<EditorRenderFrame>[];
}

/** Lines go under the players. On top, the root of a line would overlap the player's marker. */
export function createDefaultLayers(): SurfaceLayers {
  return {
    field: [new FieldRenderer()],
    backdrop: [new GridRenderer()],
    play: [new LineRenderer(), new PlayerRenderer()],
    editor: [new OverlayRenderer()],
  };
}

export function renderLayers<F extends RenderFrame>(
  ctx: CanvasRenderingContext2D,
  frame: F,
  layers: readonly ILayerRenderer<F>[],
): void {
  for (const layer of layers) {
    ctx.save();
    layer.draw(ctx, frame);
    ctx.restore();
  }
}
