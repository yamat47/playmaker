import {
  arrowHeadVertices,
  blockCapEndpoints,
  type CanvasPoint,
  DEFAULT_LINE_THICKNESS,
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
  /** 後の要素ほど上に描く。起点の選手が見つからない線は描かない。 */
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
      // thickness は既定の太さに対する倍率なので、画面と PNG のどちらの縮尺でも見え方が揃う。
      const width = this.widthFor(line.kind, metrics) * (line.thickness ?? DEFAULT_LINE_THICKNESS);
      const isBlock = line.kind === "block";

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (line.kind === "motion") {
        ctx.setLineDash([...metrics.motionDash]);
      }

      // 矢印を付ける線は、矢じりの根元で止める。先端まで引くと、線の丸いキャップが細くなる三角の先から
      // はみ出して、先端に点が付いたように見える。block は T 字のバーを当てるので終点まで引く。
      // 矢じりの向きと位置は、止める前の path から求める。
      const strokePath = isBlock ? path : trimForArrowHead(path, metrics.arrowLength);
      ctx.beginPath();
      // 空のパスへの最初の lineTo は moveTo として働く。
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

  /** 終点に、進む向きへ向けた三角の矢じりを描く。 */
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

  /** 終点に、進む向きと直交する T 字のバーを描く。 */
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
