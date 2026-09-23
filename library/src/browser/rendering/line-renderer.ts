// 線（route / block / motion）を Canvas へ描く（PRD 5.3）。動作ごとに記法を変える:
// route/motion = 塗り三角の矢印、block = 直角バー（T 字キャップ）。色でなく記法で区別する。
// 線の幾何（起点選手の解決・waypoint 連結・曲線サンプル）と寸法トークンは common に委譲し、
// 本クラスは「サンプル後ポリラインを種別ごとの見た目で描く」命令だけを持つ（VRT なしで薄く保つ）。

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
  /** lines を配列順（後の要素ほど上）に描く。起点選手が見つからない線は描かない。 */
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

      // 矢印付きの線は矢じりの根元で止める＝線が三角へ潜らず先端が鋭く整う。弧長で正確に
      // 遡らないと線が先端近くまで伸びきり、太さ一定の線の丸キャップが先細りの三角から
      // はみ出して先端に「丸いドット」が生える。ブロックは T 字キャップを当てるため終点まで
      // 引く。矢じりの向き/位置は元 path から得る。
      const strokePath = isBlock ? path : trimForArrowHead(path, metrics.arrowLength);
      ctx.beginPath();
      // 空のパスへの最初の lineTo は moveTo として働く。
      for (const pt of strokePath) {
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 記法で区別: 走路は矢印、ブロックは T 字キャップ。
      if (isBlock) {
        this.drawBlockCap(ctx, path, color, metrics, width);
      } else {
        this.drawArrowHead(ctx, path, color, metrics);
      }
      ctx.restore();
    }
  }

  /** block は route と同じ太さ。記法（T 字）で区別するため色・太さに頼らない。 */
  private widthFor(kind: LineKind, metrics: FieldMetrics): number {
    return kind === "block" ? metrics.blockWidth : metrics.routeWidth;
  }

  /** 終点に、進行方向へ向けた塗り三角の矢じりを描く（route / motion）。 */
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

  /** 終点に、進行方向と直交する T 字バーを描く（block）。矢印と一目で見分けるため。 */
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
