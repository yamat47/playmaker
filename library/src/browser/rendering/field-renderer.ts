import {
  DEFAULT_FIELD_LEAGUE,
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  type FieldGeometry,
  type FieldMetrics,
  HASH_CENTER_OFFSET_YARDS_BY_LEAGUE,
  YARD_LINE_INTERVAL_YARDS,
  yardLinesInWindow,
} from "../../common/index.js";
import { fieldFont } from "../theme/field-font.js";
import type { ThemeReader } from "../theme/tokens.js";
import type { ILayerRenderer, RenderFrame } from "./layer.js";

interface FieldTheme {
  readonly fieldColor: string;
  /** Outside the sidelines, and the margin left over when the aspect ratio does not match. */
  readonly oobColor: string;
  readonly endzoneColor: string;
  readonly lineColor: string;
  readonly goalLineColor: string;
  readonly numberColor: string;
  readonly pylonColor: string;
  readonly goalpostColor: string;
}

/**
 * The outer frame (px) of the field shown in the window. The sidelines are left and right, and the
 * top and bottom edges of the window are top and bottom.
 */
interface FieldBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * The direction the goalpost uprights extend. The own end zone is at the bottom of the screen, so
 * its uprights extend upward, and the opponent's extend downward.
 */
type UprightDirection = "toward-top" | "toward-bottom";

// Size (yards) of the triangle beside each number that points to the nearer goal. It is kept small
// so that it stands out less than the number.
const ARROW_LENGTH_YARDS = 0.8;
const ARROW_HALF_WIDTH_YARDS = 0.3;
const ARROW_OFFSET_FROM_NUMBER_YARDS = 2.5;
// Distance of the numbers from the sideline. The triangles share the column to line up vertically.
const NUMBER_FROM_SIDELINE_YARDS = 6;
// Two-digit numbers straddle the yard line, so the digits are spaced apart to let the line pass
// between them, as on a real field.
const NUMBER_DIGIT_SPACING_PER_HEIGHT = 0.18;

function fieldTheme(read: ThemeReader): FieldTheme {
  return {
    fieldColor: read("fieldGrass"),
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
  /** Draws one frame of the field according to the window of geometry. */
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

    this.drawEndZones(ctx, geometry, bounds, theme);
    this.drawHashes(ctx, geometry, bounds, metrics, theme);
    this.drawYardLines(ctx, geometry, bounds, metrics, theme);
    this.drawNumbers(ctx, geometry, metrics, theme);
    this.drawEndZoneMarkers(ctx, geometry, bounds, metrics, theme);
  }

  /** Fills the part of the end zones that falls in the window. No lines are drawn inside them. */
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
   * Draws the hash marks at every yard and the ticks on the sidelines. Multiples of 5 yards are
   * skipped because the yard lines cover them, and nothing is drawn in the end zones.
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

  /**
   * Draws the yard lines every 5 yards and the outer frame of the window. The goal lines are as
   * thick as the frame and are told apart by color.
   */
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

    // The sidelines and the top and bottom edges of the window.
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
   * Draws the number and the direction triangle at every 10-yard line. The numbers are flipped so
   * they read from both sidelines, and the triangles point to the nearer goal. No triangle is drawn
   * at the 50, and nothing at the goal lines and end zones, where displayYardNumber returns null.
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

    // The center of the gap between the digits sits on the yard line, and each digit is placed from
    // the edge of the gap by its measured width. ctx.letterSpacing is not used for the gap because
    // it also adds space after the last glyph, which shifts the centering to one side.
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

  /** Draws pylons at the end zone's four corners and a goalpost at the center of the end line. */
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

  /** Draws the crossbar and two uprights centered on the end line, uprights toward the field. */
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
