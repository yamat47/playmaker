// フィールド（芝・ヤードライン・ハッシュ・番号）を Canvas へ描く（PRD 5.1）。
// 座標決定はすべて common の FieldGeometry に委譲し、本クラスは描画命令だけを持つ
// → 計算ロジックは common 単体テストで網羅し、ここは VRT なしでも薄く保てる。

import {
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  type FieldGeometry,
  HASH_FROM_SIDELINE_YARDS,
  yardLinesInWindow,
} from "../../common/index.js";

/** 色は CSS 変数（--playmaker-*）由来。商用ソフトが上書きできる（PRD 6.5）。 */
export interface FieldTheme {
  fieldColor: string;
  lineColor: string;
  numberColor: string;
}

// 線の太さ（CSS px）。ゴールライン > 10yd 区切り > 5yd 区切り。
const GOAL_LINE_WIDTH = 3;
const MAJOR_LINE_WIDTH = 2;
const MINOR_LINE_WIDTH = 1;
// ハッシュの目盛り長（ヤード）。実フィールドの 1 ヤード刻みを再現。
const HASH_TICK_YARDS = 0.8;

export class FieldRenderer {
  /**
   * geometry の窓に従って 1 フレーム分のフィールドを描く。
   * ctx は CanvasSurface 側で DPR 変換済み（CSS px 空間で描いてよい）。
   */
  draw(ctx: CanvasRenderingContext2D, geometry: FieldGeometry, theme: FieldTheme): void {
    const { viewportWidth, viewportHeight, zone } = geometry;

    // 1) 芝（レターボックス余白も含め全面）
    ctx.fillStyle = theme.fieldColor;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    const left = geometry.xForLateralYard(0);
    const right = geometry.xForLateralYard(FIELD_WIDTH_YARDS);
    const hashLeft = geometry.xForLateralYard(HASH_FROM_SIDELINE_YARDS);
    const hashRight = geometry.xForLateralYard(FIELD_WIDTH_YARDS - HASH_FROM_SIDELINE_YARDS);
    const tickPx = HASH_TICK_YARDS * geometry.scale;

    // 2) ハッシュマーク（1 ヤード刻み・内側 2 列）。10 ヤード線とは重ねない。
    ctx.strokeStyle = theme.lineColor;
    ctx.lineWidth = MINOR_LINE_WIDTH;
    ctx.beginPath();
    for (const yard of yardLinesInWindow(zone, 1)) {
      if (yard % 5 === 0) {
        continue;
      }
      const y = geometry.yForAbsoluteYard(yard);
      ctx.moveTo(hashLeft - tickPx / 2, y);
      ctx.lineTo(hashLeft + tickPx / 2, y);
      ctx.moveTo(hashRight - tickPx / 2, y);
      ctx.lineTo(hashRight + tickPx / 2, y);
    }
    ctx.stroke();

    // 3) ヤードライン（5 ヤード刻み・横断）
    for (const yard of yardLinesInWindow(zone, 5)) {
      const y = geometry.yForAbsoluteYard(yard);
      const isGoalLine = yard === 0 || yard === 100;
      ctx.strokeStyle = theme.lineColor;
      ctx.lineWidth = isGoalLine
        ? GOAL_LINE_WIDTH
        : yard % 10 === 0
          ? MAJOR_LINE_WIDTH
          : MINOR_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    // 4) サイドライン（窓の縦範囲ぶん）
    const top = geometry.yForAbsoluteYard(geometry.window.endYard);
    const bottom = geometry.yForAbsoluteYard(geometry.window.startYard);
    ctx.strokeStyle = theme.lineColor;
    ctx.lineWidth = GOAL_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    // 5) ヤード番号（10 ヤード刻み・左右ハッシュの外側）。ゴール(0)は描かない。
    const fontPx = Math.max(10, 2.4 * geometry.scale);
    ctx.fillStyle = theme.numberColor;
    ctx.font = `600 ${fontPx}px var(--playmaker-font-family, system-ui, sans-serif)`;
    ctx.textBaseline = "middle";
    for (const yard of yardLinesInWindow(zone, 10)) {
      const n = displayYardNumber(yard);
      if (n === 0) {
        continue;
      }
      const label = String(n);
      const y = geometry.yForAbsoluteYard(yard);
      ctx.textAlign = "right";
      ctx.fillText(label, hashLeft - tickPx, y);
      ctx.textAlign = "left";
      ctx.fillText(label, hashRight + tickPx, y);
    }
  }
}
