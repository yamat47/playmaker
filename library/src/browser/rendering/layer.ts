import type { EditorOverlay, FieldGeometry, FieldMetrics, SceneData } from "../../common/index.js";
import type { ThemeReader } from "../theme/tokens.js";
import { FieldRenderer } from "./field-renderer.js";
import { LineRenderer } from "./line-renderer.js";
import { OverlayRenderer } from "./overlay-renderer.js";
import { PlayerRenderer } from "./player-renderer.js";

/** 1 回の描画で、図の層が共有する入力。 */
export interface RenderFrame {
  readonly geometry: FieldGeometry;
  readonly metrics: FieldMetrics;
  readonly scene: SceneData;
  readonly theme: ThemeReader;
}

/**
 * 編集の層だけが受け取る入力。図の層にオーバーレイを渡さないので、
 * PNG に書き出した図に選択の強調やハンドルが紛れ込むことはない。
 */
export interface EditorRenderFrame extends RenderFrame {
  readonly overlay: EditorOverlay;
}

/**
 * 図の 1 層を描く。ctx は DPR の変換を済ませてあるので、CSS px の座標で描いてよい。
 * 層ごとに save と restore で挟むので、層の中で ctx の状態を元に戻さなくてよい。
 */
export interface ILayerRenderer<F extends RenderFrame = RenderFrame> {
  // メソッド記法にすると引数が双変で比べられ、編集の層を図の層に入れても型エラーにならない。
  readonly draw: (ctx: CanvasRenderingContext2D, frame: F) => void;
}

/**
 * 図を描く層と、編集中だけ重ねる層。PNG の書き出しは図の層だけで描くので、
 * 選択の強調やハンドルは書き出した画像に入らない。
 */
export interface SurfaceLayers {
  readonly play: readonly ILayerRenderer[];
  readonly editor: readonly ILayerRenderer<EditorRenderFrame>[];
}

/** 線は選手の下に敷く。起点がマーカーに隠れ、線の根元がきれいに見える。 */
export function createDefaultLayers(): SurfaceLayers {
  return {
    play: [new FieldRenderer(), new LineRenderer(), new PlayerRenderer()],
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
