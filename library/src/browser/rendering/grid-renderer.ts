import {
  FIELD_WIDTH_YARDS,
  type FieldGeometry,
  GRID_STEP_YARDS,
  YARD_LINE_INTERVAL_YARDS,
  yardLinesInWindow,
} from "../../common/index.js";
import type { EditorRenderFrame, ILayerRenderer } from "./layer.js";

/**
 * Lays faint dots on the grid points where a position can go. It is an editing-only layer, so it
 * does not appear in the PNG or in view mode. The grid's origin is the sideline laterally and the
 * LOS lengthwise, but the LOS is on a whole yard, so stepping absolute yards by GRID_STEP_YARDS
 * gives the same points.
 */
export class GridRenderer implements ILayerRenderer<EditorRenderFrame> {
  // There are thousands of dots, and rebuilding them on every drag takes most of the drawing time.
  // While the window and scale stay the same, so does the path, so the previous frame's is reused.
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

// The dots are 1 to 2 px, so squares are indistinguishable from circles and cheaper to fill.
function gridDots(geometry: FieldGeometry, radius: number): Path2D {
  const dots = new Path2D();
  const size = 2 * radius;
  for (const yard of yardLinesInWindow(geometry.zone, GRID_STEP_YARDS)) {
    // No dots on the yard lines or the window edges. Every window edge is a multiple of 5 yards,
    // but the end zones (before 0 and beyond 100) have no yard lines, so dots do go there.
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
