import {
  arrowHeadVertices,
  blockCapEndpoints,
  type CanvasPoint,
  type FieldMetrics,
  indexPlayersById,
  type LineKind,
  lineAnchorPoints,
  sampleLinePath,
  trimForArrowHead,
} from "../../common/index.js";
import type { ThemeTokenName } from "../theme/tokens.js";
import type { ILayerRenderer, RenderFrame } from "./layer.js";

const LINE_COLOR_TOKENS = {
  route: "lineRoute",
  block: "lineBlock",
  motion: "lineMotion",
} as const satisfies Record<LineKind, ThemeTokenName>;

export class LineRenderer implements ILayerRenderer {
  /** A line whose origin player cannot be found is not drawn. */
  draw(ctx: CanvasRenderingContext2D, frame: RenderFrame): void {
    const { geometry, metrics } = frame;
    const { lines, players } = frame.scene;
    if (geometry.scale <= 0 || lines.length === 0) {
      return;
    }
    const byId = indexPlayersById(players);

    for (const line of lines) {
      const anchors = lineAnchorPoints(line, byId);
      if (anchors === undefined) {
        continue;
      }
      const path = sampleLinePath(anchors, line.interpolation).map((p) => geometry.toCanvas(p));
      if (path.length < 2) {
        continue;
      }

      const color = line.color ?? frame.theme(LINE_COLOR_TOKENS[line.kind]);
      const width = this.widthFor(line.kind, metrics);
      const isBlock = line.kind === "block";

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (line.kind === "motion") {
        ctx.setLineDash([...metrics.motionDash]);
      }

      // A line with an arrow stops at the arrowhead's base. If drawn to the tip, its round cap
      // would poke out past the narrowing tip of the triangle and look like a dot at the end.
      // A block line gets a T bar, so it runs to the endpoint. The arrowhead's direction and
      // position come from the path before trimming.
      const strokePath = isBlock ? path : trimForArrowHead(path, metrics.arrowLength);
      ctx.beginPath();
      // The first lineTo on an empty path acts as a moveTo.
      for (const pt of strokePath) {
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (isBlock) {
        this.drawBlockCap(ctx, path, color, metrics, width);
      } else {
        this.drawArrowHead(ctx, path, color, metrics);
      }
      ctx.restore();
    }
  }

  private widthFor(kind: LineKind, metrics: FieldMetrics): number {
    return kind === "block" ? metrics.blockWidth : metrics.routeWidth;
  }

  /** Draws a triangular arrowhead at the endpoint, pointing in the direction of travel. */
  private drawArrowHead(
    ctx: CanvasRenderingContext2D,
    path: readonly CanvasPoint[],
    color: string,
    metrics: FieldMetrics,
  ): void {
    const vertices = arrowHeadVertices(path, metrics.arrowLength, metrics.arrowHalfWidth);
    if (vertices === undefined) {
      return;
    }
    const [tip, left, right] = vertices;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /** Draws a T bar at the endpoint, perpendicular to the direction of travel. */
  private drawBlockCap(
    ctx: CanvasRenderingContext2D,
    path: readonly CanvasPoint[],
    color: string,
    metrics: FieldMetrics,
    width: number,
  ): void {
    const endpoints = blockCapEndpoints(path, metrics.blockCapLength);
    if (endpoints === undefined) {
      return;
    }
    const [from, to] = endpoints;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 1.2;
    ctx.lineCap = "round";
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
}
