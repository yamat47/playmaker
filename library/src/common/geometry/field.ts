import type { FieldState, FieldZone } from "../model/play-data.js";
import type { FieldPosition } from "../model/player.js";

/** サイドラインの間の幅。規定の 160 フィート。 */
export const FIELD_WIDTH_YARDS = 160 / 3;

/**
 * middle ゾーンで映す縦の長さ。レッドゾーンの窓は、ヤード数字が端で見切れないよう
 * これより深い。窓ごとの長さは zoneWindowLength で得る。
 */
export const ZONE_WINDOW_LENGTH_YARDS = 30;

/**
 * リーグごとの、フィールドの中央からハッシュマークまでの距離（ヤード）。
 * 左右のハッシュの間隔は NCAA が 40 フィート、NFL が約 18.5 フィート、NFHS が 53⅓ フィート。
 * 利用者がリーグを選ぶ API は無く、DEFAULT_FIELD_LEAGUE で描く。
 */
export const HASH_CENTER_OFFSET_YARDS_BY_LEAGUE = {
  ncaa: FIELD_WIDTH_YARDS * 0.125,
  nfl: FIELD_WIDTH_YARDS * 0.0578,
  nfhs: FIELD_WIDTH_YARDS * 0.1667,
} as const;

export type FieldLeague = keyof typeof HASH_CENTER_OFFSET_YARDS_BY_LEAGUE;

/** 日本のフィールドは NCAA のハッシュの間隔で引かれていることが多い。 */
export const DEFAULT_FIELD_LEAGUE: FieldLeague = "ncaa";

/**
 * レッドゾーンの窓に映す、ゴールラインから手前への奥行き。本来のレッドゾーン（20 ヤード）より
 * 広いのは、20 ヤードラインが窓の端に乗って数字が見切れるのを避けるため。
 */
export const RED_ZONE_DEPTH_YARDS = 25;

/** エンドゾーンの奥行き。絶対ヤードは自陣のエンドラインの -10 から相手のエンドラインの 110 まで取る。 */
export const END_ZONE_DEPTH_YARDS = 10;

export interface YardWindow {
  /** 窓の手前側（画面下、攻撃方向の後方）の絶対ヤード。 */
  readonly startYard: number;
  /** 窓の奥側（画面上、攻撃方向の前方）の絶対ヤード。 */
  readonly endYard: number;
}

/**
 * ゾーンで映す絶対ヤードの範囲。絶対ヤードは自陣のゴールラインを 0、相手のゴールラインを 100 とし、
 * 大きいほど攻撃方向（画面の上）になる。レッドゾーンの窓はエンドゾーンまで映す。
 */
export function fieldZoneWindow(zone: FieldZone): YardWindow {
  switch (zone) {
    case "own-redzone":
      return { startYard: -END_ZONE_DEPTH_YARDS, endYard: RED_ZONE_DEPTH_YARDS };
    case "redzone":
      return { startYard: 100 - RED_ZONE_DEPTH_YARDS, endYard: 100 + END_ZONE_DEPTH_YARDS };
    case "middle": {
      const half = ZONE_WINDOW_LENGTH_YARDS / 2;
      return { startYard: 50 - half, endYard: 50 + half };
    }
  }
}

export function zoneWindowLength(zone: FieldZone): number {
  const { startYard, endYard } = fieldZoneWindow(zone);
  return endYard - startYard;
}

/** ゾーンの窓の幅と縦の長さの比。レッドゾーンの窓は middle より縦に長い。 */
export function fieldWindowAspect(zone: FieldZone): number {
  return FIELD_WIDTH_YARDS / zoneWindowLength(zone);
}

/**
 * 位置をゾーン窓の中（左右はサイドライン間、縦は窓の端から端）へ寄せる。
 * 画面の外で離したドラッグや余白へのクリックで、見えない位置に選手や点を置かないためのもの。
 */
export function clampToZoneWindow(position: FieldPosition, field: FieldState): FieldPosition {
  const { startYard, endYard } = fieldZoneWindow(field.zone);
  return {
    lateralYard: Math.min(Math.max(position.lateralYard, 0), FIELD_WIDTH_YARDS),
    downfieldYard: Math.min(
      Math.max(position.downfieldYard, startYard - field.losYard),
      endYard - field.losYard,
    ),
  };
}

/**
 * 絶対ヤードに対応する、フィールドに書く番号（1..50）。両ゴールから数える（…40、50、40…）。
 * ゴールラインとエンドゾーンには番号を書かないので null を返す。
 */
export function displayYardNumber(absoluteYard: number): number | null {
  if (absoluteYard <= 0 || absoluteYard >= 100) {
    return null;
  }
  return 50 - Math.abs(50 - absoluteYard);
}

/** ゾーンの窓の中にある、stepYards の倍数の絶対ヤードを小さい順に返す。 */
export function yardLinesInWindow(zone: FieldZone, stepYards: number): number[] {
  if (stepYards <= 0) {
    throw new Error("Playmaker: stepYards は正の数である必要があります。");
  }
  const { startYard, endYard } = fieldZoneWindow(zone);
  const lines: number[] = [];
  // stepYards が整数でないと足し算を重ねた誤差が出るので、
  // 窓の奥の端にあるラインを落とさないよう少し余裕を持たせる。
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
 * ゾーンの窓を縦横比を保ったままビューポートの中央に収め、ヤードと Canvas の px を変換する。
 * フィールドの線や番号は絶対ヤードで、選手と線は LOS からの位置（FieldPosition）で扱う。
 */
export class FieldGeometry {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly zone: FieldZone;
  /** LOS の絶対ヤード。FieldPosition の downfieldYard はここからの距離。 */
  readonly losYard: number;
  readonly yardWindow: YardWindow;
  /** 1 ヤードあたりの px。縦横で同じ値。 */
  readonly scale: number;
  readonly fieldPixelWidth: number;
  readonly fieldPixelHeight: number;
  /** フィールドの左上の Canvas 座標。縦横比が合わない分の余白になる。 */
  readonly offsetX: number;
  readonly offsetY: number;

  constructor(viewportWidth: number, viewportHeight: number, field: FieldState) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.zone = field.zone;
    this.losYard = field.losYard;
    this.yardWindow = fieldZoneWindow(field.zone);
    const windowLength = this.yardWindow.endYard - this.yardWindow.startYard;
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
    return this.offsetY + (this.yardWindow.endYard - absoluteYard) * this.scale;
  }

  toCanvas(position: FieldPosition): CanvasPoint {
    return {
      x: this.xForLateralYard(position.lateralYard),
      y: this.yForAbsoluteYard(this.losYard + position.downfieldYard),
    };
  }

  // 大きさ 0 のビューポートでは scale が 0 で割れないので、フィールドの左上の位置を返して NaN を出さない。
  lateralYardForX(x: number): number {
    return this.scale > 0 ? (x - this.offsetX) / this.scale : 0;
  }

  absoluteYardForY(y: number): number {
    return this.scale > 0
      ? this.yardWindow.endYard - (y - this.offsetY) / this.scale
      : this.yardWindow.endYard;
  }

  fromCanvas(point: CanvasPoint): FieldPosition {
    return {
      lateralYard: this.lateralYardForX(point.x),
      downfieldYard: this.absoluteYardForY(point.y) - this.losYard,
    };
  }

  /** 端も含む。 */
  containsYard(absoluteYard: number): boolean {
    return absoluteYard >= this.yardWindow.startYard && absoluteYard <= this.yardWindow.endYard;
  }
}
