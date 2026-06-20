// 線（route / block / motion）を Canvas へ描く（PRD 5.3）。動作ごとに記法を変える:
// route/motion = 塗り三角の矢印、block = 直角バー（T 字キャップ）。色でなく記法で区別する。
// 線の幾何（起点選手の解決・waypoint 連結・曲線サンプル）と寸法トークンは common に委譲し、
// 本クラスは「サンプル後ポリラインを種別ごとの見た目で描く」命令だけを持つ（VRT なしで薄く保つ）。

import {
  type FieldGeometry,
  type FieldMetrics,
  indexPlayersById,
  type Line,
  type LineKind,
  lineAnchorPoints,
  type Player,
  sampleLinePath,
} from "../../common/index.js";

/** 色は CSS 変数（--playmaker-*）由来。商用ソフトが上書きできる（PRD 6.5）。 */
export interface LineTheme {
  routeColor: string;
  blockColor: string;
  motionColor: string;
}

interface CanvasPoint {
  x: number;
  y: number;
}

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
      const path = sampleLinePath(anchors, line.interpolation).map((p) =>
        geometry.toCanvas(p.lateralYard, p.absoluteYard),
      );
      if (path.length < 2) {
        continue;
      }

      const color = line.color ?? this.colorFor(line.kind, theme);
      const width = line.thickness ?? this.widthFor(line.kind, metrics);
      const isBlock = line.kind === "block";

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (line.kind === "motion") {
        ctx.setLineDash([...metrics.motionDash]);
      }

      // 矢印付きの線は根元で止める＝線が矢じり内へ潜らず先端が鋭く整う。ブロックは
      // 終端に T 字キャップを当てるため終点まで引く。矢じりの向き/位置は元 path から得る。
      const strokePath = isBlock ? path : this.trimForArrow(path, metrics.arrowLength);
      ctx.beginPath();
      const head = strokePath[0] as CanvasPoint;
      ctx.moveTo(head.x, head.y);
      for (let i = 1; i < strokePath.length; i++) {
        const pt = strokePath[i] as CanvasPoint;
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
   * 終点と一致しない直近点を遡り、終端の進行方向（角度）を得る。
   * 曲線末尾の微小区間で方向が出ない事故を避ける。終端飾りの共通前処理。
   */
  private endAngle(path: readonly CanvasPoint[]): number | undefined {
    const tip = path[path.length - 1] as CanvasPoint;
    for (let i = path.length - 2; i >= 0; i--) {
      const p = path[i] as CanvasPoint;
      if (p.x !== tip.x || p.y !== tip.y) {
        return Math.atan2(tip.y - p.y, tip.x - p.x);
      }
    }
    return undefined;
  }

  /**
   * 矢じりの根元（終点から arrowLength 手前）で終わるポリラインを返す。
   * 線が三角の内側に潜って先端が潰れるのを防ぐ。最終区間が矢じりより短い場合は
   * 線が消えないよう区間の 90% までに留める（残りは矢じりが覆う）。
   */
  private trimForArrow(path: readonly CanvasPoint[], arrowLength: number): readonly CanvasPoint[] {
    if (path.length < 2) {
      return path;
    }
    const angle = this.endAngle(path);
    if (angle === undefined) {
      return path;
    }
    const tip = path[path.length - 1] as CanvasPoint;
    const prev = path[path.length - 2] as CanvasPoint;
    const segLen = Math.hypot(tip.x - prev.x, tip.y - prev.y);
    const pull = Math.min(arrowLength, segLen * 0.9);
    const neck = { x: tip.x - pull * Math.cos(angle), y: tip.y - pull * Math.sin(angle) };
    return [...path.slice(0, -1), neck];
  }

  /** 終点に、進行方向へ向けた塗り三角の矢じりを描く（route / motion）。 */
  private drawArrowHead(
    ctx: CanvasRenderingContext2D,
    path: readonly CanvasPoint[],
    color: string,
    metrics: FieldMetrics,
  ): void {
    const angle = this.endAngle(path);
    if (angle === undefined) {
      return;
    }
    const tip = path[path.length - 1] as CanvasPoint;
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
    const angle = this.endAngle(path);
    if (angle === undefined) {
      return;
    }
    const tip = path[path.length - 1] as CanvasPoint;
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
