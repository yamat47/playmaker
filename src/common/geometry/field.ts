// フィールドの論理寸法・ゾーン窓・座標変換。DOM 非依存の純計算（VSCode 流 common）。
// browser の描画/入力はすべてこの層を通してヤード↔ピクセルを扱う。
// 戦術的厳密性より組み込みやすさ優先（PRD 4.1）。実寸は合理的近似でよい。

import type { FieldZone } from "../model/play-data.js";
import type { FieldPosition } from "../model/player.js";

/** フィールド幅（サイドライン間）= 規定 160 ft = 53.33 yd。 */
export const FIELD_WIDTH_YARDS = 160 / 3;

/**
 * middle ゾーンで映す縦長（PRD 5.1「約 30 ヤード分」）。
 * レッドゾーン窓は数字の見切れ回避でこれより深い（RED_ZONE_DEPTH + END_ZONE = 35）。
 * 窓ごとの実長は zoneWindowLength で得る。
 */
export const ZONE_WINDOW_LENGTH_YARDS = 30;

/**
 * ハッシュマークのサイドラインからの距離。NCAA（カレッジ）規定の 60 ft = 20 yd。
 * 日本のアメフトはカレッジルール準拠が主流のためこれを採用。厳密値より目安。
 */
export const HASH_FROM_SIDELINE_YARDS = 20;

/**
 * リーグ別ハッシュ位置（中央からの片側オフセット, yd）。レンダラはこの表を引くだけで
 * 切り替えられるよう定数化する（NCAA は左右間 40ft、NFL は約 18.5ft、NFHS は 53⅓ft）。
 * 既定は日本で主流の NCAA。runtime 切替の API 化は将来課題（PRD 4.1 で範囲を絞る）。
 */
export const HASH_CENTER_OFFSET_YARDS_BY_LEAGUE = {
  ncaa: FIELD_WIDTH_YARDS * 0.125,
  nfl: FIELD_WIDTH_YARDS * 0.0578,
  nfhs: FIELD_WIDTH_YARDS * 0.1667,
} as const;

export type FieldLeague = keyof typeof HASH_CENTER_OFFSET_YARDS_BY_LEAGUE;

/** 既定リーグ。NCAA のハッシュ間 40ft が日本の標準。 */
export const DEFAULT_FIELD_LEAGUE: FieldLeague = "ncaa";

/**
 * 「9 ヤードマーク」（short hash）のサイドラインからの距離。
 * 実フィールドでサイドライン際の球位置を素早く判定するための補助目盛。
 */
export const NEAR_SIDELINE_TICK_YARDS = 9;

/** 1 ヤード刻みティックの目盛り長（ヤード）。実フィールドの 1 ヤード刻みを再現。 */
export const HASH_TICK_YARDS = 0.8;

/**
 * レッドゾーン窓に映す奥行き（25 ヤードライン〜ゴール）。実レッドゾーン（ゴール前 20yd）
 * より広いのは、20yd ラインが窓端に乗って数字が見切れるのを避けるため。
 */
export const RED_ZONE_DEPTH_YARDS = 25;

/**
 * エンドゾーンの奥行き（ゴールラインの外側 10 ヤード）。
 * これにより絶対ヤードの定義域は -10..110（自陣 EZ 〜 相手陣 EZ）に広がる。
 * RED_ZONE_DEPTH_YARDS(25) + END_ZONE_DEPTH_YARDS(10) = レッドゾーン窓 35yd
 * （中央窓 ZONE_WINDOW_LENGTH_YARDS=30 より深い）。
 */
export const END_ZONE_DEPTH_YARDS = 10;

export interface YardWindow {
  /** 窓の手前側（画面下、攻撃方向の後方）の絶対ヤード。 */
  startYard: number;
  /** 窓の奥側（画面上、攻撃方向の前方）の絶対ヤード。 */
  endYard: number;
}

/**
 * ゾーン → 表示する絶対ヤード窓 [start, end]。middle は 30yd、レッドゾーン系は 35yd。
 * 絶対ヤードは -10 = 自陣エンドライン / 0 = 自ゴール / 50 = センター /
 * 100 = 相手ゴール / 110 = 相手エンドライン。攻撃方向は増加方向（= 画面上）。
 * レッドゾーン系は 25 ヤードライン〜ゴール＋エンドゾーン 10yd を映す。
 */
export function fieldZoneWindow(zone: FieldZone): YardWindow {
  switch (zone) {
    case "own-redzone":
      // 自陣エンドゾーン(-10..0) + 自陣 25yd まで(0..25)。
      return { startYard: -END_ZONE_DEPTH_YARDS, endYard: RED_ZONE_DEPTH_YARDS };
    case "redzone":
      // 相手 25yd まで(75..100) + 相手エンドゾーン(100..110)。
      return { startYard: 100 - RED_ZONE_DEPTH_YARDS, endYard: 100 + END_ZONE_DEPTH_YARDS };
    case "middle": {
      // センター(50)を窓の中央に置く。
      const half = ZONE_WINDOW_LENGTH_YARDS / 2;
      return { startYard: 50 - half, endYard: 50 + half };
    }
  }
}

/** ゾーン窓の縦長（yd）。middle は 30、レッドゾーン系は 35。geometry / export 共用。 */
export function zoneWindowLength(zone: FieldZone): number {
  const { startYard, endYard } = fieldZoneWindow(zone);
  return endYard - startYard;
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
    const windowLength = this.window.endYard - this.window.startYard;
    const w = Math.max(0, viewportWidth);
    const h = Math.max(0, viewportHeight);
    this.scale = Math.min(w / FIELD_WIDTH_YARDS, h / windowLength);
    this.fieldPixelWidth = FIELD_WIDTH_YARDS * this.scale;
    this.fieldPixelHeight = windowLength * this.scale;
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

  // 逆変換（Canvas px → ヤード）。入力 → hit-test の土台。
  // 縮退ビューポート（scale=0）では割り算が発散するため、forward と対称な
  // 安全値（原点 / 窓奥）へ丸めて NaN を上流に流さない。

  lateralYardForX(x: number): number {
    return this.scale > 0 ? (x - this.offsetX) / this.scale : 0;
  }

  absoluteYardForY(y: number): number {
    return this.scale > 0
      ? this.window.endYard - (y - this.offsetY) / this.scale
      : this.window.endYard;
  }

  fromCanvas(point: CanvasPoint): FieldPosition {
    return {
      lateralYard: this.lateralYardForX(point.x),
      absoluteYard: this.absoluteYardForY(point.y),
    };
  }

  /** absoluteYard が現在のゾーン窓に収まるか（端含む）。 */
  containsYard(absoluteYard: number): boolean {
    return absoluteYard >= this.window.startYard && absoluteYard <= this.window.endYard;
  }
}
