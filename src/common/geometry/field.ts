// フィールドの論理寸法・ゾーン窓・座標変換。DOM 非依存の純計算（VSCode 流 common）。
// browser の描画/入力はすべてこの層を通してヤード↔ピクセルを扱う。
// 戦術的厳密性より組み込みやすさ優先（PRD 4.1）。実寸は合理的近似でよい。

import type { FieldZone } from "../model/play-data.js";

/** フィールド幅（サイドライン間）= 規定 160 ft = 53.33 yd。 */
export const FIELD_WIDTH_YARDS = 160 / 3;

/** 1 ゾーンで映す縦方向の長さ（PRD 5.1「約 30 ヤード分」）。 */
export const ZONE_WINDOW_LENGTH_YARDS = 30;

/**
 * ハッシュマークのサイドラインからの距離。NCAA（カレッジ）規定の 60 ft = 20 yd。
 * 日本のアメフトはカレッジルール準拠が主流のためこれを採用。厳密値より目安。
 */
export const HASH_FROM_SIDELINE_YARDS = 20;

/** レッドゾーンの奥行き（ゴール前 20 ヤード）。 */
export const RED_ZONE_DEPTH_YARDS = 20;

/**
 * エンドゾーンの奥行き（ゴールラインの外側 10 ヤード）。
 * これにより絶対ヤードの定義域は -10..110（自陣 EZ 〜 相手陣 EZ）に広がる。
 * RED_ZONE_DEPTH_YARDS(20) + END_ZONE_DEPTH_YARDS(10) = ZONE_WINDOW_LENGTH_YARDS(30)。
 */
export const END_ZONE_DEPTH_YARDS = 10;

export interface YardWindow {
  /** 窓の手前側（画面下、攻撃方向の後方）の絶対ヤード。 */
  startYard: number;
  /** 窓の奥側（画面上、攻撃方向の前方）の絶対ヤード。 */
  endYard: number;
}

/**
 * ゾーン → 表示する絶対ヤード窓 [start, end]（常に長さ 30）。
 * 絶対ヤードは -10 = 自陣エンドライン / 0 = 自ゴール / 50 = センター /
 * 100 = 相手ゴール / 110 = 相手エンドライン。攻撃方向は増加方向（= 画面上）。
 * レッドゾーン系は実スコアリング領域（ゴール前 20yd）＋エンドゾーン 10yd を映す。
 */
export function fieldZoneWindow(zone: FieldZone): YardWindow {
  switch (zone) {
    case "own-redzone":
      // 自陣エンドゾーン(-10..0) + 自陣レッドゾーン(0..20)。
      return { startYard: -END_ZONE_DEPTH_YARDS, endYard: RED_ZONE_DEPTH_YARDS };
    case "redzone":
      // 相手レッドゾーン(80..100) + 相手エンドゾーン(100..110)。
      return { startYard: 100 - RED_ZONE_DEPTH_YARDS, endYard: 100 + END_ZONE_DEPTH_YARDS };
    case "middle": {
      // センター(50)を窓の中央に置く。
      const half = ZONE_WINDOW_LENGTH_YARDS / 2;
      return { startYard: 50 - half, endYard: 50 + half };
    }
  }
}

/** フィールド外（エンドゾーン）か。境界のゴールライン 0/100 は含めない。 */
export function isEndZone(absoluteYard: number): boolean {
  return absoluteYard < 0 || absoluteYard > 100;
}

/**
 * 絶対ヤード → フィールド上の表示番号(0..50)。両ゴールから数える（…40,50,40…）。
 * フィールド外（エンドゾーン）は番号を持たないため 0 を返す（描画側は 0 を非表示扱い）。
 */
export function displayYardNumber(absoluteYard: number): number {
  const clamped = Math.min(100, Math.max(0, absoluteYard));
  return 50 - Math.abs(50 - clamped);
}

/**
 * ゾーン窓内にある絶対ヤードラインを刻み幅ごとに列挙する（昇順）。
 * レンダラの薄さを保つため、線/番号の走査位置決定はここに集約しテストする。
 */
export function yardLinesInWindow(zone: FieldZone, stepYards: number): number[] {
  if (stepYards <= 0) {
    throw new Error("Playmaker: stepYards は正の数である必要があります。");
  }
  const { startYard, endYard } = fieldZoneWindow(zone);
  const lines: number[] = [];
  // 浮動小数の取りこぼしを避けるため整数倍で走査する。
  const first = Math.ceil(startYard / stepYards) * stepYards;
  for (let y = first; y <= endYard + 1e-9; y += stepYards) {
    lines.push(y);
  }
  return lines;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

/**
 * 表示窓（フィールド幅 × ゾーン窓 30yd）をビューポートへアスペクト比維持で
 * 中央フィットさせ、ヤード座標と Canvas ピクセル座標を相互変換する。
 *
 * - lateralYard: 0 = 左サイドライン … FIELD_WIDTH_YARDS = 右サイドライン
 * - absoluteYard: -10..110（EZ 含む。窓外も計算可能。可視判定は containsYard）
 * - 大きい absoluteYard ほど画面上（y 小）= 攻撃方向。
 */
export class FieldGeometry {
  readonly window: YardWindow;
  /** px / yard。アスペクト維持のため縦横共通。 */
  readonly scale: number;
  readonly fieldPixelWidth: number;
  readonly fieldPixelHeight: number;
  /** レターボックス余白（フィールド左上の Canvas 座標）。 */
  readonly offsetX: number;
  readonly offsetY: number;

  constructor(
    readonly viewportWidth: number,
    readonly viewportHeight: number,
    readonly zone: FieldZone,
  ) {
    this.window = fieldZoneWindow(zone);
    const w = Math.max(0, viewportWidth);
    const h = Math.max(0, viewportHeight);
    this.scale = Math.min(w / FIELD_WIDTH_YARDS, h / ZONE_WINDOW_LENGTH_YARDS);
    this.fieldPixelWidth = FIELD_WIDTH_YARDS * this.scale;
    this.fieldPixelHeight = ZONE_WINDOW_LENGTH_YARDS * this.scale;
    this.offsetX = (w - this.fieldPixelWidth) / 2;
    this.offsetY = (h - this.fieldPixelHeight) / 2;
  }

  xForLateralYard(lateralYard: number): number {
    return this.offsetX + lateralYard * this.scale;
  }

  yForAbsoluteYard(absoluteYard: number): number {
    // 窓の奥側(endYard)を上端に、手前側(startYard)を下端に対応させる。
    return this.offsetY + (this.window.endYard - absoluteYard) * this.scale;
  }

  toCanvas(lateralYard: number, absoluteYard: number): CanvasPoint {
    return {
      x: this.xForLateralYard(lateralYard),
      y: this.yForAbsoluteYard(absoluteYard),
    };
  }

  /** absoluteYard が現在のゾーン窓に収まるか（端含む）。 */
  containsYard(absoluteYard: number): boolean {
    return absoluteYard >= this.window.startYard && absoluteYard <= this.window.endYard;
  }
}
