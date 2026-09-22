// フィールド描画の寸法トークン。固定 px を散らさず、フィールド幅 W(px) と
// 1 ヤード U(px) から比率で算出する＝表示サイズ・ゾーン・端末が変わっても破綻しない。
// DOM 非依存の純計算（VSCode 流 common）。色は CSS 変数側に集約し、ここは寸法のみ。
//
// 2 つの層で基準が違う:
//  - マーキング層（ライン・数字・ハッシュ）: 実寸比率に忠実（W/U 基準）。本物らしさを決める。
//  - 注釈層（選手トークン・プレー線）: 視認性優先で 1 基準直径 D から派生。実寸より誇張してよい。
// D は実マーカー直径（= 2·PLAYER_RADIUS_YARDS·U）を採用する。レンダラの描画半径と
// hit-test 半径が一致する不変条件（player.ts）を保つため、トークンはヤード基準を維持し、
// プレー線・矢印・T 字キャップをこの D 比で揃える。

import { PLAYER_RADIUS_YARDS } from "../model/player.js";

// マーキング層（実寸比率）。
const MIN_LINE_PX = 1; // 細いラインでも 1px は確保し消えないようにする。
const YARD_LINE_WIDTH_PER_W = 0.0021; // 実寸 4in / 160ft。
const HASH_TICK_LENGTH_PER_U = 0.375; // 実寸 24in を U 比で。
const NUMBER_HEIGHT_PER_U = 2.4; // 実寸 6ft(=2yd) を視認用に拡大（2.3〜2.6U の範囲内）。
const NUMBER_MIN_PX = 10;

// 注釈層（D 基準・視認性優先）。
const MARKER_STROKE_PER_D = 1 / 14; // D/16〜D/12 の範囲。芝に対し細すぎず太すぎず。
const MARKER_STROKE_MIN_PX = 1;
const MARKER_LABEL_PER_D = 0.5; // D×0.45〜0.55。マーカー内にちょうど収まる字面。
const MARKER_LABEL_MIN_PX = 8;
const ROUTE_WIDTH_PER_D = 0.11;
const ROUTE_WIDTH_MIN_PX = 1.5;
const BLOCK_CAP_LENGTH_PER_D = 0.4; // T 字キャップ長。ルート矢印と一目で見分く大きさ。
// 矢じりは鋭く整った塗り三角。底辺幅(2·halfWidth ≈ 0.48D)を線幅(0.11D)より十分広く取り
// 「棘」に見せない。全角 ≈ 37°（halfWidth / length = tan(18.4°)）で鋭さと視認性を両立。
// 描画側は矢じり根元で線を止め、線が三角内へ潜って先端が潰れるのを防ぐ。
const ARROW_LENGTH_PER_D = 0.72;
const ARROW_HALF_WIDTH_PER_D = 0.24;
const MOTION_DASH_ON_PER_U = 1.1;
const MOTION_DASH_OFF_PER_U = 0.7;

/** W(フィールド幅px)・U(1ヤードpx) から導く描画寸法（px）。 */
export interface FieldMetrics {
  /** マーキング層。 */
  yardLineWidth: number;
  /** ゴールライン・境界は最重要なので通常ラインの 2 倍。 */
  goalLineWidth: number;
  hashTickLength: number;
  numberHeight: number;
  /** 注釈層の基準直径 D（実マーカー直径）。 */
  tokenDiameter: number;
  /** 選手マーカーの枠線幅（D 比）。固定 px を散らさず表示サイズに追従する。 */
  markerStroke: number;
  /** 選手ラベルのフォント px（D 比）。マーカー内に収まる。 */
  markerLabelFont: number;
  routeWidth: number;
  /** block も route と同じ太さ。記法（T 字）で区別する。 */
  blockWidth: number;
  blockCapLength: number;
  arrowLength: number;
  arrowHalfWidth: number;
  /** モーション破線パターン [on, off]（px）。 */
  motionDash: readonly [number, number];
}

/**
 * フィールド幅 W と 1 ヤード U（= geometry.scale）から描画寸法トークンを導く。
 * 縮退ビューポート（W=U=0）でもラインは MIN_LINE_PX を返し NaN を流さない。
 */
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
