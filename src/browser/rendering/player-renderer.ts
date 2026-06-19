// 選手マーカー（6 形状・ラベル・色）を Canvas へ描く（PRD 5.2）。
// 位置決定は common の FieldGeometry に委譲し、本クラスは描画命令だけを持つ
// → ロジックは common 単体テストで網羅し、ここは VRT なしでも薄く保てる。

import {
  type FieldGeometry,
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

const STROKE_WIDTH = 2;

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
  ): void {
    const r = PLAYER_RADIUS_YARDS * geometry.scale;
    if (r <= 0) {
      return;
    }
    // ラベルは選手マーカーの中に収まるサイズに抑える（半径の 1/3 ほど）。
    const fontPx = Math.max(8, r * 0.35);

    for (const player of players) {
      const { x, y } = geometry.toCanvas(player.position.lateralYard, player.position.absoluteYard);

      ctx.beginPath();
      if (player.shape === "circle") {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      } else {
        this.tracePolygon(ctx, x, y, r, player.shape);
      }

      ctx.fillStyle = player.color ?? theme.fillColor;
      ctx.fill();
      ctx.lineWidth = STROKE_WIDTH;
      ctx.strokeStyle = theme.strokeColor;
      ctx.stroke();

      if (player.label !== "") {
        ctx.fillStyle = theme.labelColor;
        ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(player.label, x, y);
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
