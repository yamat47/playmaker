// フィールド（芝・刈り込みストライプ・ライン・ハッシュ・数字・エンドゾーン・パイロン・
// ゴールポスト）を Canvas へ描く（PRD 5.1）。マーキングは実寸比率に忠実、寸法は
// computeFieldMetrics（common）に集約する＝固定 px を散らさず表示サイズに追従する。
// 座標決定は FieldGeometry に委譲し、本クラスは描画命令だけを持つ（VRT なしで薄く保つ）。

import {
  DEFAULT_FIELD_LEAGUE,
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  type FieldGeometry,
  type FieldMetrics,
  HASH_CENTER_OFFSET_YARDS_BY_LEAGUE,
  yardLinesInWindow,
} from "../../common/index.js";

/** 色は CSS 変数（--playmaker-*）由来。商用ソフトが上書きできる（PRD 6.5）。 */
export interface FieldTheme {
  fieldColor: string;
  /** 刈り込みストライプの濃い帯（芝ベースとの明度差はごく僅か）。 */
  stripeColor: string;
  /** アウトオブバウンズ／レターボックス余白。 */
  oobColor: string;
  endzoneColor: string;
  lineColor: string;
  /** ゴールライン（最重要境界。通常ラインより太く・純白）。 */
  goalLineColor: string;
  numberColor: string;
  /** 数字のアスレチック系フォントスタック。 */
  numberFontFamily: string;
  pylonColor: string;
  goalpostColor: string;
}

// 数字の方向マーカー（"9yd マーク"相当）の寸法（ヤード）。数字を主役にするため小ぶり。
const ARROW_LENGTH_YARDS = 0.8;
const ARROW_HALF_WIDTH_YARDS = 0.3;
const ARROW_OFFSET_FROM_NUMBER_YARDS = 2.5;
// 番号の lateralYard（サイドラインから）。方向三角も同じ列に置いて縦に揃える。
const NUMBER_FROM_SIDELINE_YARDS = 6;

export class FieldRenderer {
  /**
   * geometry の窓に従って 1 フレーム分のフィールドを描く。
   * ctx は CanvasSurface 側で DPR 変換済み（CSS px 空間で描いてよい）。
   */
  draw(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    theme: FieldTheme,
    metrics: FieldMetrics,
  ): void {
    const { viewportWidth, viewportHeight, window } = geometry;

    const left = geometry.xForLateralYard(0);
    const right = geometry.xForLateralYard(FIELD_WIDTH_YARDS);
    const top = geometry.yForAbsoluteYard(window.endYard);
    const bottom = geometry.yForAbsoluteYard(window.startYard);

    // アウトオブバウンズ（レターボックス余白 + サイドライン外）を先に敷く。
    ctx.fillStyle = theme.oobColor;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    // 芝ベース（イン領域）。
    ctx.fillStyle = theme.fieldColor;
    ctx.fillRect(left, top, right - left, bottom - top);

    this.drawStripes(ctx, geometry, left, right, theme);
    this.drawEndZones(ctx, geometry, left, right, theme);
    this.drawHashes(ctx, geometry, left, right, metrics, theme);
    this.drawYardLines(ctx, geometry, left, right, top, bottom, metrics, theme);
    this.drawNumbers(ctx, geometry, metrics, theme);
    this.drawEndZoneMarkers(ctx, geometry, left, right, metrics, theme);
  }

  /** 5yd 帯ごとに濃淡を交互にした刈り込みストライプ。EZ(0..100 外)には敷かない。 */
  private drawStripes(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    left: number,
    right: number,
    theme: FieldTheme,
  ): void {
    const { startYard, endYard } = geometry.window;
    const from = Math.max(0, Math.floor(startYard / 5) * 5);
    const to = Math.min(100, endYard);
    ctx.fillStyle = theme.stripeColor;
    for (let band = from; band < to; band += 5) {
      // 絶対ヤード基準で帯の偶奇を決め、ゾーンを跨いでもストライプ位相を一定に保つ。
      if ((band / 5) % 2 !== 0) {
        const yTop = geometry.yForAbsoluteYard(Math.min(band + 5, 100));
        const yBottom = geometry.yForAbsoluteYard(band);
        ctx.fillRect(left, yTop, right - left, yBottom - yTop);
      }
    }
  }

  /** エンドゾーン（-10..0 / 100..110）が窓に映る範囲を単色で塗る。内部に線は引かない。 */
  private drawEndZones(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    left: number,
    right: number,
    theme: FieldTheme,
  ): void {
    const { startYard, endYard } = geometry.window;
    ctx.fillStyle = theme.endzoneColor;
    if (startYard < 0) {
      const yTop = geometry.yForAbsoluteYard(0);
      const yBottom = geometry.yForAbsoluteYard(startYard);
      ctx.fillRect(left, yTop, right - left, yBottom - yTop);
    }
    if (endYard > 100) {
      const yTop = geometry.yForAbsoluteYard(endYard);
      const yBottom = geometry.yForAbsoluteYard(100);
      ctx.fillRect(left, yTop, right - left, yBottom - yTop);
    }
  }

  /**
   * ハッシュ（NCAA: 中央 ±0.125W）とサイドライン 1yd 目盛を描く。リーグ表を引くだけで
   * 切り替えられる。5yd 倍数は横断ラインが覆うため省き、EZ(0..100 外)には引かない。
   */
  private drawHashes(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    left: number,
    right: number,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const offset = HASH_CENTER_OFFSET_YARDS_BY_LEAGUE[DEFAULT_FIELD_LEAGUE];
    const center = FIELD_WIDTH_YARDS / 2;
    const hashLeft = geometry.xForLateralYard(center - offset);
    const hashRight = geometry.xForLateralYard(center + offset);
    const tick = metrics.hashTickLength;
    const half = tick / 2;

    ctx.strokeStyle = theme.lineColor;
    ctx.lineWidth = metrics.yardLineWidth;
    ctx.beginPath();
    for (const yard of yardLinesInWindow(geometry.zone, 1)) {
      if (yard < 0 || yard > 100 || yard % 5 === 0) {
        continue;
      }
      const y = geometry.yForAbsoluteYard(yard);
      ctx.moveTo(left, y);
      ctx.lineTo(left + tick, y);
      ctx.moveTo(right - tick, y);
      ctx.lineTo(right, y);
      ctx.moveTo(hashLeft - half, y);
      ctx.lineTo(hashLeft + half, y);
      ctx.moveTo(hashRight - half, y);
      ctx.lineTo(hashRight + half, y);
    }
    ctx.stroke();
  }

  /**
   * 5yd ヤードライン（0..100）と境界ボックスを太さ階層で描く。
   * 階層: ゴールライン(別色・最太) > センター/境界(気持ち太め) > 通常 5yd。
   */
  private drawYardLines(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    left: number,
    right: number,
    top: number,
    bottom: number,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const goalPath = new Path2D();
    const midPath = new Path2D();
    const minorPath = new Path2D();
    for (const yard of yardLinesInWindow(geometry.zone, 5)) {
      if (yard < 0 || yard > 100) {
        continue;
      }
      const y = geometry.yForAbsoluteYard(yard);
      const target = yard === 0 || yard === 100 ? goalPath : yard === 50 ? midPath : minorPath;
      target.moveTo(left, y);
      target.lineTo(right, y);
    }

    ctx.strokeStyle = theme.lineColor;
    ctx.lineWidth = metrics.yardLineWidth;
    ctx.stroke(minorPath);
    ctx.lineWidth = 1.5 * metrics.yardLineWidth;
    ctx.stroke(midPath);

    // 境界ボックス（サイドライン + 窓上下端）。境界も気持ち太め。
    ctx.lineWidth = metrics.goalLineWidth;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    // ゴールラインは最重要境界として最も目立たせる（別色・最太）。
    ctx.strokeStyle = theme.goalLineColor;
    ctx.lineWidth = metrics.goalLineWidth;
    ctx.stroke(goalPath);
  }

  /**
   * 番号付きヤードライン（10yd 刻み）に数字と方向三角を描く。数字は上下ミラーで
   * 両サイドラインから読め、三角は最寄りゴール方向。EZ・ゴール(0)・センター(50)は
   * 数字/三角の扱いを分ける（displayYardNumber が 0 を返す EZ は描かない）。
   */
  private drawNumbers(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const leftX = geometry.xForLateralYard(NUMBER_FROM_SIDELINE_YARDS);
    const rightX = geometry.xForLateralYard(FIELD_WIDTH_YARDS - NUMBER_FROM_SIDELINE_YARDS);
    const arrowBaseHalfPx = ARROW_HALF_WIDTH_YARDS * geometry.scale;
    const halfArrowLength = ARROW_LENGTH_YARDS / 2;

    // Canvas の ctx.font は CSS var() を解釈できないため、テーマから読んだ実体スタックを書く。
    ctx.font = `600 ${metrics.numberHeight}px ${theme.numberFontFamily}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

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

    for (const yard of yardLinesInWindow(geometry.zone, 10)) {
      const n = displayYardNumber(yard);
      if (n === 0) {
        continue;
      }
      const numberY = geometry.yForAbsoluteYard(yard);
      ctx.fillStyle = theme.numberColor;
      drawRotatedLabel(String(n), leftX, numberY, Math.PI / 2);
      drawRotatedLabel(String(n), rightX, numberY, -Math.PI / 2);

      if (yard === 50) {
        continue;
      }
      const towardGoal = yard < 50 ? -1 : 1;
      const arrowCenterYard = yard + towardGoal * ARROW_OFFSET_FROM_NUMBER_YARDS;
      const tipY = geometry.yForAbsoluteYard(arrowCenterYard + towardGoal * halfArrowLength);
      const baseY = geometry.yForAbsoluteYard(arrowCenterYard - towardGoal * halfArrowLength);
      ctx.fillStyle = theme.lineColor;
      drawArrow(leftX, tipY, baseY);
      drawArrow(rightX, tipY, baseY);
    }
  }

  /** エンドゾーンの 4 隅にパイロン、エンドライン中央にゴールポストを描く。 */
  private drawEndZoneMarkers(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    left: number,
    right: number,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const { startYard, endYard } = geometry.window;
    const pylon = Math.max(3, 0.45 * geometry.scale);
    const drawPylon = (x: number, y: number): void => {
      ctx.fillStyle = theme.pylonColor;
      ctx.fillRect(x - pylon / 2, y - pylon / 2, pylon, pylon);
    };

    if (startYard < 0) {
      const goalY = geometry.yForAbsoluteYard(0);
      const endY = geometry.yForAbsoluteYard(startYard);
      drawPylon(left, goalY);
      drawPylon(right, goalY);
      drawPylon(left, endY);
      drawPylon(right, endY);
      // 自陣 EZ は画面下。ゴールポストの開き（uprights）はフィールド側（上＝-y）へ。
      this.drawGoalpost(ctx, geometry, endY, -1, metrics, theme);
    }
    if (endYard > 100) {
      const goalY = geometry.yForAbsoluteYard(100);
      const endY = geometry.yForAbsoluteYard(endYard);
      drawPylon(left, goalY);
      drawPylon(right, goalY);
      drawPylon(left, endY);
      drawPylon(right, endY);
      // 相手 EZ は画面上。uprights はフィールド側（下＝+y）へ。
      this.drawGoalpost(ctx, geometry, endY, 1, metrics, theme);
    }
  }

  /** エンドライン中央のゴールポスト（crossbar + 2 本の uprights）。dir はフィールド方向の符号。 */
  private drawGoalpost(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    lineY: number,
    dir: 1 | -1,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const cx = geometry.xForLateralYard(FIELD_WIDTH_YARDS / 2);
    const u = geometry.scale;
    const crossHalf = 1.85 * u;
    const uprightLen = 1.2 * u;

    ctx.save();
    ctx.strokeStyle = theme.goalpostColor;
    ctx.lineWidth = Math.max(2, 0.2 * metrics.tokenDiameter);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - crossHalf, lineY);
    ctx.lineTo(cx + crossHalf, lineY);
    ctx.moveTo(cx - crossHalf, lineY);
    ctx.lineTo(cx - crossHalf, lineY + dir * uprightLen);
    ctx.moveTo(cx + crossHalf, lineY);
    ctx.lineTo(cx + crossHalf, lineY + dir * uprightLen);
    ctx.stroke();
    ctx.restore();
  }
}
