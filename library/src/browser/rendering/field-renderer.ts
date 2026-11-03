import {
  DEFAULT_FIELD_LEAGUE,
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  type FieldGeometry,
  type FieldMetrics,
  HASH_CENTER_OFFSET_YARDS_BY_LEAGUE,
  yardLinesInWindow,
} from "../../common/index.js";
import { fieldFont } from "../theme/field-font.js";
import type { ThemeReader } from "../theme/tokens.js";
import type { ILayerRenderer, RenderFrame } from "./layer.js";

interface FieldTheme {
  readonly fieldColor: string;
  /** 5 ヤードおきに交互に敷く、芝の刈り込みの濃い帯。 */
  readonly stripeColor: string;
  /** サイドラインの外と、縦横比が合わない分の余白。 */
  readonly oobColor: string;
  readonly endzoneColor: string;
  readonly lineColor: string;
  readonly goalLineColor: string;
  readonly numberColor: string;
  readonly pylonColor: string;
  readonly goalpostColor: string;
}

/** 窓に映るフィールドの外枠（px）。サイドラインが left と right、窓の上下の端が top と bottom。 */
interface FieldBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** ゴールポストの柱を伸ばす向き。自陣のエンドゾーンは画面の下にあるので上へ、相手のは下へ伸ばす。 */
type UprightDirection = "toward-top" | "toward-bottom";

// ヤードラインと芝の帯の間隔（ヤード）。
const YARD_LINE_INTERVAL_YARDS = 5;
// 数字の横に置く、近いほうのゴールを指す三角の寸法（ヤード）。数字より目立たないよう小さくする。
const ARROW_LENGTH_YARDS = 0.8;
const ARROW_HALF_WIDTH_YARDS = 0.3;
const ARROW_OFFSET_FROM_NUMBER_YARDS = 2.5;
// 数字を置く、サイドラインからの距離。三角も同じ列に置いて縦に揃える。
const NUMBER_FROM_SIDELINE_YARDS = 6;
// 2 桁の数字はヤードラインをまたいで置くので、本物のフィールドと同じく桁の間を空けてラインを通す。
const NUMBER_DIGIT_SPACING_PER_HEIGHT = 0.18;

function fieldTheme(read: ThemeReader): FieldTheme {
  return {
    fieldColor: read("fieldGrass"),
    stripeColor: read("fieldStripe"),
    oobColor: read("fieldOob"),
    endzoneColor: read("fieldEndzone"),
    lineColor: read("fieldLine"),
    goalLineColor: read("fieldGoalLine"),
    numberColor: read("fieldNumber"),
    pylonColor: read("fieldPylon"),
    goalpostColor: read("fieldGoalpost"),
  };
}

export class FieldRenderer implements ILayerRenderer {
  /** geometry の窓に従って、1 フレーム分のフィールドを描く。 */
  draw(ctx: CanvasRenderingContext2D, frame: RenderFrame): void {
    const { geometry, metrics } = frame;
    const theme = fieldTheme(frame.theme);
    const { viewportWidth, viewportHeight, yardWindow } = geometry;

    const bounds: FieldBounds = {
      left: geometry.xForLateralYard(0),
      right: geometry.xForLateralYard(FIELD_WIDTH_YARDS),
      top: geometry.yForAbsoluteYard(yardWindow.endYard),
      bottom: geometry.yForAbsoluteYard(yardWindow.startYard),
    };

    ctx.fillStyle = theme.oobColor;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    ctx.fillStyle = theme.fieldColor;
    ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);

    this.drawStripes(ctx, geometry, bounds, theme);
    this.drawEndZones(ctx, geometry, bounds, theme);
    this.drawHashes(ctx, geometry, bounds, metrics, theme);
    this.drawYardLines(ctx, geometry, bounds, metrics, theme);
    this.drawNumbers(ctx, geometry, metrics, theme);
    this.drawEndZoneMarkers(ctx, geometry, bounds, metrics, theme);
  }

  /** エンドゾーンには敷かない。 */
  private drawStripes(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    { left, right }: FieldBounds,
    theme: FieldTheme,
  ): void {
    const { startYard, endYard } = geometry.yardWindow;
    const step = YARD_LINE_INTERVAL_YARDS;
    const from = Math.max(0, Math.floor(startYard / step) * step);
    const to = Math.min(100, endYard);
    ctx.fillStyle = theme.stripeColor;
    for (let band = from; band < to; band += step) {
      // 帯の偶奇を絶対ヤードで決め、ゾーンを切り替えても同じヤードに同じ濃さの帯が来るようにする。
      if ((band / step) % 2 !== 0) {
        const yTop = geometry.yForAbsoluteYard(Math.min(band + step, 100));
        const yBottom = geometry.yForAbsoluteYard(band);
        ctx.fillRect(left, yTop, right - left, yBottom - yTop);
      }
    }
  }

  /** エンドゾーンのうち窓に映る範囲を塗る。中に線は引かない。 */
  private drawEndZones(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    { left, right }: FieldBounds,
    theme: FieldTheme,
  ): void {
    const { startYard, endYard } = geometry.yardWindow;
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
   * 1 ヤードごとのハッシュと、サイドラインの目盛を描く。5 ヤードの倍数はヤードラインが覆うので省き、
   * エンドゾーンには引かない。
   */
  private drawHashes(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    { left, right }: FieldBounds,
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
      if (yard < 0 || yard > 100 || yard % YARD_LINE_INTERVAL_YARDS === 0) {
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

  /** 5 ヤードごとのヤードラインと、窓の外枠を描く。ゴールラインは外枠と同じ太さで、色で見分ける。 */
  private drawYardLines(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    { left, right, top, bottom }: FieldBounds,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const goalPath = new Path2D();
    const midPath = new Path2D();
    const minorPath = new Path2D();
    for (const yard of yardLinesInWindow(geometry.zone, YARD_LINE_INTERVAL_YARDS)) {
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
    ctx.lineWidth = metrics.midfieldLineWidth;
    ctx.stroke(midPath);

    // サイドラインと、窓の上下の端。
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

    ctx.strokeStyle = theme.goalLineColor;
    ctx.lineWidth = metrics.goalLineWidth;
    ctx.stroke(goalPath);
  }

  /**
   * 10 ヤードごとのヤードラインに数字と方向の三角を描く。数字は両サイドラインから読めるよう
   * 上下を反転させ、三角は近いほうのゴールを指す。センターの 50 には三角を描かず、
   * displayYardNumber が null を返すゴールラインとエンドゾーンには何も描かない。
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

    ctx.font = fieldFont(metrics.numberHeight);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // 桁の間の隙間の中心をヤードラインに合わせ、各桁は測った幅で隙間の端から置く。
    // ctx.letterSpacing で空けないのは、末尾の字の後ろにも間隔が付き、中央揃えが片側へずれるため。
    const gap = metrics.numberHeight * NUMBER_DIGIT_SPACING_PER_HEIGHT;
    const drawRotatedLabel = (label: string, x: number, y: number, rotation: number): void => {
      const [head, tail] = [...label];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      if (label.length === 2 && head !== undefined && tail !== undefined) {
        ctx.fillText(head, -gap / 2 - ctx.measureText(head).width / 2, 0);
        ctx.fillText(tail, gap / 2 + ctx.measureText(tail).width / 2, 0);
      } else {
        ctx.fillText(label, 0, 0);
      }
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
      if (n === null) {
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
    { left, right }: FieldBounds,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const { startYard, endYard } = geometry.yardWindow;
    const pylon = metrics.pylonSize;
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
      this.drawGoalpost(ctx, geometry, endY, "toward-top", metrics, theme);
    }
    if (endYard > 100) {
      const goalY = geometry.yForAbsoluteYard(100);
      const endY = geometry.yForAbsoluteYard(endYard);
      drawPylon(left, goalY);
      drawPylon(right, goalY);
      drawPylon(left, endY);
      drawPylon(right, endY);
      this.drawGoalpost(ctx, geometry, endY, "toward-bottom", metrics, theme);
    }
  }

  /** エンドラインの中央に、横木と 2 本の柱を描く。柱はフィールドの側へ伸ばす。 */
  private drawGoalpost(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    lineY: number,
    uprights: UprightDirection,
    metrics: FieldMetrics,
    theme: FieldTheme,
  ): void {
    const cx = geometry.xForLateralYard(FIELD_WIDTH_YARDS / 2);
    const crossHalf = metrics.goalpostCrossbarHalfLength;
    const uprightLen = metrics.goalpostUprightLength;
    const dir = uprights === "toward-top" ? -1 : 1;

    ctx.save();
    ctx.strokeStyle = theme.goalpostColor;
    ctx.lineWidth = metrics.goalpostStroke;
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
