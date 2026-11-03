import type { EditorOverlay, FieldGeometry, FieldMetrics, SceneData } from "../../common/index.js";
import type { ThemeReader } from "../theme/tokens.js";
import { FieldRenderer } from "./field-renderer.js";
import { GridRenderer } from "./grid-renderer.js";
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
 * 図を描く層（field と play）と、編集中だけ挟む層（backdrop と editor）。描く順は
 * field、backdrop、play、editor。PNG の書き出しと view モードは図の層だけで描くので、
 * 格子、選択の強調、ハンドルは書き出した画像と読み取り専用の画面に入らない。
 */
export interface SurfaceLayers {
  /** フィールド。図の層のうち、編集中の backdrop より下に描くもの。 */
  readonly field: readonly ILayerRenderer[];
  /** 編集中だけ、フィールドの上で線と選手の下に敷く層。位置の格子を置く。 */
  readonly backdrop: readonly ILayerRenderer<EditorRenderFrame>[];
  /** 線と選手。 */
  readonly play: readonly ILayerRenderer[];
  /** 編集中だけ、図の上に重ねる層。 */
  readonly editor: readonly ILayerRenderer<EditorRenderFrame>[];
}

/** 線は選手の下に描く。上に描くと、線の根元が選手のマーカーに重なって見える。 */
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
