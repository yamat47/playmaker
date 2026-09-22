// 選手マーカー（6 形状・ラベル・色）を Canvas へ描く（PRD 5.2）。
// 位置決定は common の FieldGeometry に委譲し、本クラスは描画命令だけを持つ
// → ロジックは common 単体テストで網羅し、ここは VRT なしでも薄く保てる。

import {
  FIELD_FONT_FAMILY,
  type FieldGeometry,
  type FieldMetrics,
  PLAYER_RADIUS_YARDS,
  type Player,
  type PlayerShape,
} from "../../common/index.js";

/** 色は CSS 変数（--playmaker-*）由来。商用ソフトが上書きできる（PRD 6.5）。 */
export interface PlayerTheme {
  /** player.color 未指定時の塗り。 */
  fillColor: string;
  /** マーカーの輪郭（芝とのコントラスト確保）。 */
  strokeColor: string;
  /** ラベル文字色。 */
  labelColor: string;
}

// 正多角形の頂点角（apex を上に向ける）。circle は arc で特別扱い。
// 当たり領域（hit-test）は半径 r の外接円なので、全頂点を r 上に置き整合させる。
const POLYGON_SIDES: Record<Exclude<PlayerShape, "circle">, number> = {
  triangle: 3,
  square: 4,
  diamond: 4,
  pentagon: 5,
  hexagon: 6,
};

// square は頂点を上に置くと菱形に見えるため、辺が水平になるよう 45° 回す。
const SHAPE_ROTATION: Record<Exclude<PlayerShape, "circle">, number> = {
  triangle: 0,
  square: Math.PI / 4,
  diamond: 0,
  pentagon: 0,
  hexagon: 0,
};

// 円は外接円半径そのままだと多角形（外接円に内接＝辺が内側）より一回り大きく見え、
// マーカーが動線（特に LOS 際のブロック）を覆う。描画半径だけ正方形の辺幅へ寄せて
// 視覚的な大きさを揃える（錯視で円は小さく見えるためやや大きめ）。当たり領域は全形状で
// 外接円のまま＝hit-test の一様性（player.ts の不変条件）は崩さない。
const CIRCLE_DRAW_SCALE = 0.82;

export class PlayerRenderer {
  /**
   * players を配列順（後の要素ほど上）に描く。
   * ctx は CanvasSurface 側で DPR 変換済み（CSS px 空間で描いてよい）。
   */
  draw(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    players: readonly Player[],
    theme: PlayerTheme,
    metrics: FieldMetrics,
  ): void {
    // 半径は hit-test と一致させるため PLAYER_RADIUS_YARDS から導く（player.ts の不変条件）。
    // 枠線・ラベルは D 比トークン（metrics）を使い、寸法を 1 か所へ集約する。
    const r = PLAYER_RADIUS_YARDS * geometry.scale;
    if (r <= 0) {
      return;
    }
    const fontPx = metrics.markerLabelFont;
    const strokeWidth = metrics.markerStroke;

    for (const player of players) {
      const { x, y } = geometry.toCanvas(player.position.lateralYard, player.position.absoluteYard);

      // 影・グラデーションを持たない完全フラット。塗り → 枠線の順で描く。
      ctx.beginPath();
      if (player.shape === "circle") {
        ctx.arc(x, y, r * CIRCLE_DRAW_SCALE, 0, Math.PI * 2);
      } else {
        this.tracePolygon(ctx, x, y, r, player.shape);
      }
      ctx.fillStyle = player.color ?? theme.fillColor;
      ctx.fill();
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = theme.strokeColor;
      ctx.stroke();

      if (player.label !== "") {
        ctx.fillStyle = theme.labelColor;
        ctx.font = `700 ${fontPx}px ${FIELD_FONT_FAMILY}`;
        ctx.textAlign = "center";
        // textBaseline="middle" は em ボックス基準でフォント次第で上下にずれる。
        // 実際の字面ボックス（actualBoundingBox）の中心をマーカー中心へ合わせる。
        ctx.textBaseline = "alphabetic";
        const tm = ctx.measureText(player.label);
        const labelY = y + (tm.actualBoundingBoxAscent - tm.actualBoundingBoxDescent) / 2;
        ctx.fillText(player.label, x, labelY);
      }
    }
  }

  private tracePolygon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    shape: Exclude<PlayerShape, "circle">,
  ): void {
    const sides = POLYGON_SIDES[shape];
    // -π/2 で apex を上（Canvas は y 下向き）に向け、形状ごとの回転を加える。
    const start = -Math.PI / 2 + SHAPE_ROTATION[shape];
    for (let i = 0; i < sides; i++) {
      const angle = start + (i * 2 * Math.PI) / sides;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  }
}
