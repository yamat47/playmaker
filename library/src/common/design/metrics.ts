// 寸法は px で決めず、フィールドの幅 W と 1 ヤードの px U からの比で出す。
// フィールドの白線、ハッシュ、数字は本物の寸法の比に合わせる。
// 選手とプレーの線は見やすさを優先して本物より大きく描き、選手マーカーの直径 D からの比で揃える。

import { PLAYER_RADIUS_YARDS } from "../model/player.js";

// 小さく描いたときにラインが消えないよう、1 px は残す。
const MIN_LINE_PX = 1;
// 本物のラインの幅 4 インチを、フィールドの幅 160 フィートで割った値。
const YARD_LINE_WIDTH_PER_W = 0.0021;
// 本物のハッシュの長さ 24 インチ。
const HASH_TICK_LENGTH_PER_U = 0.375;
// 本物の数字の高さは 6 フィート（2 ヤード）だが、小さく描いたときにも読めるよう少し大きくする。
const NUMBER_HEIGHT_PER_U = 2.4;
const NUMBER_MIN_PX = 10;

const MARKER_STROKE_PER_D = 1 / 14;
const MARKER_STROKE_MIN_PX = 1;
// 2 文字のラベルがマーカーの内側に収まる大きさ。
const MARKER_LABEL_PER_D = 0.5;
const MARKER_LABEL_MIN_PX = 8;
const ROUTE_WIDTH_PER_D = 0.11;
const ROUTE_WIDTH_MIN_PX = 1.5;
const BLOCK_CAP_LENGTH_PER_D = 0.4;
// 矢じりの底辺を線の幅の 4 倍ほどにし、線の先の棘ではなく矢印に見せる。先端の角はおよそ 37 度。
const ARROW_LENGTH_PER_D = 0.72;
const ARROW_HALF_WIDTH_PER_D = 0.24;
const MOTION_DASH_ON_PER_U = 1.1;
const MOTION_DASH_OFF_PER_U = 0.7;

/** 描くときの寸法（px）。 */
export interface FieldMetrics {
  readonly yardLineWidth: number;
  /** ゴールラインと、サイドラインを含む窓の外枠の太さ。 */
  readonly goalLineWidth: number;
  readonly hashTickLength: number;
  readonly numberHeight: number;
  /** 選手マーカーの直径 D。選手とプレーの線の寸法はこの値からの比で決める。 */
  readonly tokenDiameter: number;
  readonly markerStroke: number;
  readonly markerLabelFont: number;
  readonly routeWidth: number;
  readonly blockWidth: number;
  readonly blockCapLength: number;
  readonly arrowLength: number;
  readonly arrowHalfWidth: number;
  /** motion の破線の [描く長さ, 空ける長さ]。 */
  readonly motionDash: readonly [number, number];
}

/** 大きさ 0 のビューポートでも NaN を返さない。 */
export function computeFieldMetrics(fieldPixelWidth: number, unitPx: number): FieldMetrics {
  const w = Math.max(0, fieldPixelWidth);
  const u = Math.max(0, unitPx);
  const yardLineWidth = Math.max(MIN_LINE_PX, YARD_LINE_WIDTH_PER_W * w);
  const d = 2 * PLAYER_RADIUS_YARDS * u;
  const routeWidth = Math.max(ROUTE_WIDTH_MIN_PX, ROUTE_WIDTH_PER_D * d);
  return {
    yardLineWidth,
    goalLineWidth: 2 * yardLineWidth,
    hashTickLength: HASH_TICK_LENGTH_PER_U * u,
    numberHeight: Math.max(NUMBER_MIN_PX, NUMBER_HEIGHT_PER_U * u),
    tokenDiameter: d,
    markerStroke: Math.max(MARKER_STROKE_MIN_PX, MARKER_STROKE_PER_D * d),
    markerLabelFont: Math.max(MARKER_LABEL_MIN_PX, MARKER_LABEL_PER_D * d),
    routeWidth,
    blockWidth: routeWidth,
    blockCapLength: BLOCK_CAP_LENGTH_PER_D * d,
    arrowLength: ARROW_LENGTH_PER_D * d,
    arrowHalfWidth: ARROW_HALF_WIDTH_PER_D * d,
    motionDash: [MOTION_DASH_ON_PER_U * u, MOTION_DASH_OFF_PER_U * u],
  };
}
