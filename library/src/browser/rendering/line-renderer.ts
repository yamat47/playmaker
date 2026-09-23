// 線（route / block / motion）を Canvas へ描く（PRD 5.3）。動作ごとに記法を変える:
// route/motion = 塗り三角の矢印、block = 直角バー（T 字キャップ）。色でなく記法で区別する。
// 線の幾何（起点選手の解決・waypoint 連結・曲線サンプル）と寸法トークンは common に委譲し、
// 本クラスは「サンプル後ポリラインを種別ごとの見た目で描く」命令だけを持つ（VRT なしで薄く保つ）。

import {
  type CanvasPoint,
  DEFAULT_LINE_THICKNESS,
  type FieldGeometry,
  type FieldMetrics,
  indexPlayersById,
  type Line,
  type LineKind,
  lineAnchorPoints,
  type Player,
  sampleLinePath,
  trimPolylineEnd,
} from "../../common/index.js";

/** 色は CSS 変数（--playmaker-*）由来。商用ソフトが上書きできる（PRD 6.5）。 */
export interface LineTheme {
  routeColor: string;
  blockColor: string;
  motionColor: string;
}

// 線が矢じりより短くても消えないよう、切り詰めは全長のこの割合までに留める（残りは矢じりが覆う）。
const ARROW_TRIM_MAX_FRACTION = 0.9;

export class LineRenderer {
  /**
   * lines を配列順（後の要素ほど上）に描く。起点選手が見つからない線は描かない。
   * ctx は CanvasSurface 側で DPR 変換済み（CSS px 空間で描いてよい）。
   */
  draw(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    lines: readonly Line[],
    players: readonly Player[],
    theme: LineTheme,
    metrics: FieldMetrics,
  ): void {
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

      const color = line.color ?? this.colorFor(line.kind, theme);
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
      const strokePath = isBlock
        ? path
        : trimPolylineEnd(path, metrics.arrowLength, ARROW_TRIM_MAX_FRACTION);
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

  private colorFor(kind: LineKind, theme: LineTheme): string {
    switch (kind) {
      case "route":
        return theme.routeColor;
      case "block":
        return theme.blockColor;
      case "motion":
        return theme.motionColor;
    }
  }

  /** block は route と同じ太さ。記法（T 字）で区別するため色・太さに頼らない。 */
  private widthFor(kind: LineKind, metrics: FieldMetrics): number {
    return kind === "block" ? metrics.blockWidth : metrics.routeWidth;
  }

  /**
   * 終点と、終点と一致しない直近点から見た終端の進行方向（角度）。
   * 曲線末尾の微小区間で方向が出ない事故を避ける。終端飾りの共通前処理。
   */
  private endDirection(
    path: readonly CanvasPoint[],
  ): { readonly tip: CanvasPoint; readonly angle: number } | undefined {
    const tip = path.at(-1);
    if (tip === undefined) {
      return undefined;
    }
    // 毎フレーム線ごとに呼ぶので、配列を複製せずに終点側から探す。
    for (let i = path.length - 2; i >= 0; i--) {
      const from = path[i];
      if (from !== undefined && (from.x !== tip.x || from.y !== tip.y)) {
        return { tip, angle: Math.atan2(tip.y - from.y, tip.x - from.x) };
      }
    }
    return undefined;
  }

  /** 終点に、進行方向へ向けた塗り三角の矢じりを描く（route / motion）。 */
  private drawArrowHead(
    ctx: CanvasRenderingContext2D,
    path: readonly CanvasPoint[],
    color: string,
    metrics: FieldMetrics,
  ): void {
    const direction = this.endDirection(path);
    if (direction === undefined) {
      return;
    }
    const { tip, angle } = direction;
    const baseX = tip.x - metrics.arrowLength * Math.cos(angle);
    const baseY = tip.y - metrics.arrowLength * Math.sin(angle);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);

    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(baseX + metrics.arrowHalfWidth * nx, baseY + metrics.arrowHalfWidth * ny);
    ctx.lineTo(baseX - metrics.arrowHalfWidth * nx, baseY - metrics.arrowHalfWidth * ny);
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
    const direction = this.endDirection(path);
    if (direction === undefined) {
      return;
    }
    const { tip, angle } = direction;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const half = metrics.blockCapLength / 2;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 1.2;
    ctx.lineCap = "round";
    ctx.moveTo(tip.x - half * nx, tip.y - half * ny);
    ctx.lineTo(tip.x + half * nx, tip.y + half * ny);
    ctx.stroke();
  }
}
