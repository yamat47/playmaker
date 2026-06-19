// フィールド（芝・ヤードライン・ハッシュ・番号）を Canvas へ描く（PRD 5.1）。
// 座標決定はすべて common の FieldGeometry に委譲し、本クラスは描画命令だけを持つ
// → 計算ロジックは common 単体テストで網羅し、ここは VRT なしでも薄く保てる。

import {
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  type FieldGeometry,
  HASH_FROM_SIDELINE_YARDS,
  HASH_TICK_YARDS,
  yardLinesInWindow,
} from "../../common/index.js";

/** 色は CSS 変数（--playmaker-*）由来。商用ソフトが上書きできる（PRD 6.5）。 */
export interface FieldTheme {
  fieldColor: string;
  lineColor: string;
  numberColor: string;
}

// 線の太さ（CSS px）。階層: 外枠 > 10yd > 5yd > 1yd ティック。
const HEAVY_LINE_WIDTH = 3;
const MAJOR_LINE_WIDTH = 2;
const MINOR_LINE_WIDTH = 1.25;
const TICK_WIDTH = 1;

// 方向マーカー（"9yd マーク"）の寸法（ヤード単位）。数字を主役にするため小ぶり。
const ARROW_LENGTH_YARDS = 0.8;
const ARROW_HALF_WIDTH_YARDS = 0.3;
// 数字の中心からゴール側へずらす距離。数字の半分の高さ + 少しのゆとり分。
const ARROW_OFFSET_FROM_NUMBER_YARDS = 2.5;

const NUMBER_HEIGHT_YARDS = 3.5;
// 番号の lateralYard。三角も同じ列に置いて縦に揃える。
const NUMBER_FROM_SIDELINE_YARDS = 6;

export class FieldRenderer {
  /**
   * geometry の窓に従って 1 フレーム分のフィールドを描く。
   * ctx は CanvasSurface 側で DPR 変換済み（CSS px 空間で描いてよい）。
   */
  draw(ctx: CanvasRenderingContext2D, geometry: FieldGeometry, theme: FieldTheme): void {
    const { viewportWidth, viewportHeight, zone } = geometry;

    ctx.fillStyle = theme.fieldColor;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    const left = geometry.xForLateralYard(0);
    const right = geometry.xForLateralYard(FIELD_WIDTH_YARDS);
    const hashLeft = geometry.xForLateralYard(HASH_FROM_SIDELINE_YARDS);
    const hashRight = geometry.xForLateralYard(FIELD_WIDTH_YARDS - HASH_FROM_SIDELINE_YARDS);
    const tickPx = HASH_TICK_YARDS * geometry.scale;
    const halfTick = tickPx / 2;
    const centeredTickXs = [hashLeft, hashRight];

    // サイドラインのティックだけ内向きに伸ばす（外向きはフィールド外に出てしまう）。
    // 5yd 倍数は横断ラインと重なるためスキップ。9yd 列は三角マーカーに譲る。
    ctx.strokeStyle = theme.lineColor;
    ctx.lineWidth = TICK_WIDTH;
    ctx.beginPath();
    for (const yard of yardLinesInWindow(zone, 1)) {
      if (yard % 5 === 0) {
        continue;
      }
      const y = geometry.yForAbsoluteYard(yard);
      ctx.moveTo(left, y);
      ctx.lineTo(left + tickPx, y);
      ctx.moveTo(right - tickPx, y);
      ctx.lineTo(right, y);
      for (const cx of centeredTickXs) {
        ctx.moveTo(cx - halfTick, y);
        ctx.lineTo(cx + halfTick, y);
      }
    }
    ctx.stroke();

    // 太さ階層ごとに 1 ストロークへ集約（lineWidth 変更はストローク確定のため）。
    const goalPath = new Path2D();
    const majorPath = new Path2D();
    const minorPath = new Path2D();
    for (const yard of yardLinesInWindow(zone, 5)) {
      const y = geometry.yForAbsoluteYard(yard);
      const target =
        yard === 0 || yard === 100 ? goalPath : yard % 10 === 0 ? majorPath : minorPath;
      target.moveTo(left, y);
      target.lineTo(right, y);
    }
    ctx.lineWidth = MINOR_LINE_WIDTH;
    ctx.stroke(minorPath);
    ctx.lineWidth = MAJOR_LINE_WIDTH;
    ctx.stroke(majorPath);
    ctx.lineWidth = HEAVY_LINE_WIDTH;
    ctx.stroke(goalPath);

    const top = geometry.yForAbsoluteYard(geometry.window.endYard);
    const bottom = geometry.yForAbsoluteYard(geometry.window.startYard);
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    // 番号付きヤードライン（10yd 刻み）ごとに、数字と「数字の隣の三角」を描く。
    // 三角は数字からゴール側へ ARROW_OFFSET_FROM_NUMBER_YARDS ずれた位置に置き、
    // 5yd ラインの上に正確に乗らずに数字とペアで読めるようにする。
    // ゴール(0)・センター(50)は数字のみ。
    // 三角は数字と同じ lateralYard 列に揃えて縦に並べる。
    const arrowLeftX = geometry.xForLateralYard(NUMBER_FROM_SIDELINE_YARDS);
    const arrowRightX = geometry.xForLateralYard(FIELD_WIDTH_YARDS - NUMBER_FROM_SIDELINE_YARDS);
    const arrowBaseHalfPx = ARROW_HALF_WIDTH_YARDS * geometry.scale;
    const halfArrowLength = ARROW_LENGTH_YARDS / 2;

    const fontPx = Math.max(10, NUMBER_HEIGHT_YARDS * geometry.scale);
    // Canvas の ctx.font は CSS の var() を解釈できず "10px sans-serif" にフォールバックする
    // ため、--playmaker-font-family を埋め込まず固定スタックを書く。
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const leftNumberX = geometry.xForLateralYard(NUMBER_FROM_SIDELINE_YARDS);
    const rightNumberX = geometry.xForLateralYard(FIELD_WIDTH_YARDS - NUMBER_FROM_SIDELINE_YARDS);

    const drawRotatedLabel = (label: string, x: number, y: number, rotation: number): void => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    };
    const drawArrow = (xc: number, tipY: number, baseY: number): void => {
      ctx.beginPath();
      ctx.moveTo(xc, tipY);
      ctx.lineTo(xc - arrowBaseHalfPx, baseY);
      ctx.lineTo(xc + arrowBaseHalfPx, baseY);
      ctx.closePath();
      ctx.fill();
    };

    for (const yard of yardLinesInWindow(zone, 10)) {
      const n = displayYardNumber(yard);
      if (n === 0) {
        continue;
      }
      const label = String(n);
      const numberY = geometry.yForAbsoluteYard(yard);

      ctx.fillStyle = theme.numberColor;
      drawRotatedLabel(label, leftNumberX, numberY, Math.PI / 2);
      drawRotatedLabel(label, rightNumberX, numberY, -Math.PI / 2);

      if (yard === 50) {
        continue;
      }
      const towardGoal = yard < 50 ? -1 : 1;
      const arrowCenterYard = yard + towardGoal * ARROW_OFFSET_FROM_NUMBER_YARDS;
      const tipY = geometry.yForAbsoluteYard(arrowCenterYard + towardGoal * halfArrowLength);
      const baseY = geometry.yForAbsoluteYard(arrowCenterYard - towardGoal * halfArrowLength);
      ctx.fillStyle = theme.lineColor;
      drawArrow(arrowLeftX, tipY, baseY);
      drawArrow(arrowRightX, tipY, baseY);
    }
  }
}
