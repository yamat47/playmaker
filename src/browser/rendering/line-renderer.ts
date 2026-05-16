// 線（route / block / motion）を Canvas へ描く（PRD 5.3）。
// 線の幾何（起点選手の解決・waypoint 連結・曲線サンプル）はすべて common に委譲し、
// 本クラスは「サンプル後ポリラインを種別ごとの見た目で描く」命令だけを持つ
// → ロジックは common 単体テストで網羅、ここは VRT なしでも薄く保てる。
// 戦術記法準拠の体裁（block の T 字終端等）は M9 へ繰り延べ（PRD 4.1）。

import {
  type FieldGeometry,
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

// 既定の線幅（CSS px）。block を太く、route/motion は標準。line.thickness で上書き可。
const DEFAULT_WIDTH_PX: Record<LineKind, number> = {
  route: 2.5,
  block: 5,
  motion: 2.5,
};

// 矢印・破線はヤード基準でスケールし、ビューポートに依らず比率を一定に保つ。
const ARROW_LENGTH_YARDS = 1.4;
const ARROW_HALF_WIDTH_YARDS = 0.9;
const MOTION_DASH_YARDS: readonly [number, number] = [1.2, 0.8];

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
      const width = line.thickness ?? DEFAULT_WIDTH_PX[line.kind];

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (line.kind === "motion") {
        ctx.setLineDash(MOTION_DASH_YARDS.map((d) => d * geometry.scale));
      }

      ctx.beginPath();
      const head = path[0] as { x: number; y: number };
      ctx.moveTo(head.x, head.y);
      for (let i = 1; i < path.length; i++) {
        const pt = path[i] as { x: number; y: number };
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // route だけ終点に矢印（PRD 5.3）。block/motion は矢印なし。
      if (line.kind === "route") {
        this.drawArrowHead(ctx, path, color, geometry.scale);
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

  /** 終点に、最後の進行方向へ向けた塗り三角の矢じりを描く。 */
  private drawArrowHead(
    ctx: CanvasRenderingContext2D,
    path: readonly { x: number; y: number }[],
    color: string,
    scale: number,
  ): void {
    const tip = path[path.length - 1] as { x: number; y: number };
    // 終点と一致しない直近点を遡って進行方向を得る（曲線末尾の微小区間対策）。
    let prev: { x: number; y: number } | undefined;
    for (let i = path.length - 2; i >= 0; i--) {
      const p = path[i] as { x: number; y: number };
      if (p.x !== tip.x || p.y !== tip.y) {
        prev = p;
        break;
      }
    }
    if (prev === undefined) {
      return;
    }
    const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const len = ARROW_LENGTH_YARDS * scale;
    const half = ARROW_HALF_WIDTH_YARDS * scale;
    const baseX = tip.x - len * Math.cos(angle);
    const baseY = tip.y - len * Math.sin(angle);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(baseX + half * nx, baseY + half * ny);
    ctx.lineTo(baseX - half * nx, baseY - half * ny);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}
