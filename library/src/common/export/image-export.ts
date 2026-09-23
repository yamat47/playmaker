import { fieldWindowAspect } from "../geometry/field.js";
import { isFiniteNumber } from "../model/guards.js";
import type { FieldZone } from "../model/play-data.js";

/** 幅を指定しないときの PNG の幅（px）。資料に貼っても粗く見えない大きさ。 */
export const DEFAULT_EXPORT_WIDTH = 1600;

/**
 * 書き出す幅の上限（px）。縦に長いレッドゾーンの窓でも約 1100 万画素に収まり、
 * canvas の面積を約 1678 万画素までに制限するブラウザ（iOS の Safari）でも描ける。
 */
export const MAX_EXPORT_WIDTH = 4096;

export interface ImageExportOptions {
  /**
   * PNG の幅（px）。高さはゾーンの窓の縦横比から決める。
   * 未指定、有限でない値、1 未満は 1600 にし、4096 を超える幅は 4096 に切り詰める。
   */
  width?: number | undefined;
}

export interface ImageExportSize {
  width: number;
  height: number;
}

/**
 * 外から渡された幅を整数の px にする。有限でない値と 1 未満は既定の幅にし、上限を超える幅は上限に切り詰める。
 */
export function resolveImageExportWidth(width: number | undefined): number {
  if (!isFiniteNumber(width) || width < 1) {
    return DEFAULT_EXPORT_WIDTH;
  }
  return Math.min(Math.round(width), MAX_EXPORT_WIDTH);
}

/**
 * 高さをゾーンの窓の縦横比から決めるので、画像に余白は付かない。
 * 窓の縦横比は 2 未満なので、幅が 1 以上なら四捨五入した高さも 1 以上になる。
 */
export function resolveImageExportSize(
  zone: FieldZone,
  options: ImageExportOptions = {},
): ImageExportSize {
  const width = resolveImageExportWidth(options.width);
  return { width, height: Math.round(width / fieldWindowAspect(zone)) };
}
