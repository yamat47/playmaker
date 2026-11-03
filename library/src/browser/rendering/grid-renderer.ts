import {
  FIELD_WIDTH_YARDS,
  type FieldGeometry,
  GRID_STEP_YARDS,
  YARD_LINE_INTERVAL_YARDS,
  yardLinesInWindow,
} from "../../common/index.js";
import type { EditorRenderFrame, ILayerRenderer } from "./layer.js";

/**
 * 位置を置ける格子点を薄い点で敷く。編集中だけの層なので、PNG と view モードには出ない。
 * 格子は横がサイドライン、縦が LOS を原点にしているが、LOS は整数ヤードにあるので、
 * 絶対ヤードで GRID_STEP_YARDS ごとに置いても同じ点になる。
 */
export class GridRenderer implements ILayerRenderer<EditorRenderFrame> {
  // 点は数千個あり、ドラッグのたびに組み立て直すと描く時間の大半を占める。
  // 窓と縮尺が同じ間は同じ path なので、前のフレームのものを使い回す。
  private cached: { readonly key: string; readonly dots: Path2D } | undefined;

  draw(ctx: CanvasRenderingContext2D, frame: EditorRenderFrame): void {
    const { geometry, metrics } = frame;
    const key = [
      geometry.zone,
      geometry.offsetX,
      geometry.offsetY,
      geometry.scale,
      metrics.gridDotRadius,
    ].join(":");
    if (this.cached?.key !== key) {
      this.cached = { key, dots: gridDots(geometry, metrics.gridDotRadius) };
    }
    ctx.fillStyle = frame.theme("fieldGrid");
    ctx.fill(this.cached.dots);
  }
}

// 点は 1〜2 px なので、円ではなく正方形で描いても見分けが付かず、塗る負荷が小さい。
function gridDots(geometry: FieldGeometry, radius: number): Path2D {
  const dots = new Path2D();
  const size = 2 * radius;
  for (const yard of yardLinesInWindow(geometry.zone, GRID_STEP_YARDS)) {
    // ヤードラインと窓の端の上には置かない。窓の端はどれも 5 ヤードの倍数だが、
    // エンドゾーンの中（0 より手前と 100 より奥）にはヤードラインが無いので、そこには置く。
    const { startYard, endYard } = geometry.yardWindow;
    const onYardLine = yard >= 0 && yard <= 100 && yard % YARD_LINE_INTERVAL_YARDS === 0;
    if (onYardLine || yard === startYard || yard === endYard) {
      continue;
    }
    const y = geometry.yForAbsoluteYard(yard);
    for (let lateral = GRID_STEP_YARDS; lateral < FIELD_WIDTH_YARDS; lateral += GRID_STEP_YARDS) {
      dots.rect(geometry.xForLateralYard(lateral) - radius, y - radius, size, size);
    }
  }
  return dots;
}
