// PNG エクスポートの寸法決定（DOM 非依存の純計算・VSCode 流 common）。
// 実際の Canvas 描画・toBlob は browser に置き、ここは「外部から渡された
// エクスポート設定を安全な出力ピクセル寸法へ正規化する」ロジックだけを持つ
// → node 単体テストで全網羅でき、browser は薄い殻に保てる（PRD 5.7 / 4.1）。
//
// 外部受け入れの作法は resolvePlayData / normalizeFormation と揃える：
// 公開境界で不正値を既定へ丸め、復元不能なら投げずに安全側へ倒す（PRD 6.6 流）。

import { fieldWindowAspect } from "../geometry/field.js";
import { isFiniteNumber } from "../model/guards.js";
import type { FieldZone } from "../model/play-data.js";

/** width 未指定/不正時の既定出力幅(px)。組み込み先が十分な解像度を得られる目安。 */
export const DEFAULT_EXPORT_WIDTH = 1600;

/**
 * 書き出す幅の上限(px)。縦に長いレッドゾーンの窓でも約 1100 万画素に収まり、
 * canvas の面積を約 1678 万画素までに制限するブラウザ（iOS の Safari）でも描ける。
 */
export const MAX_EXPORT_WIDTH = 4096;

export interface ImageExportOptions {
  /**
   * 出力 PNG の横幅(px)。高さはゾーン窓のアスペクト比から導く。
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
 * 幅を正規化し、高さはゾーン窓の縦横比から求めるので、画像は余白なしでフィールド窓に収まる。
 * 窓の縦横比は 2 未満なので、幅が 1 以上なら四捨五入した高さも 1 以上になる。
 */
export function resolveImageExportSize(
  zone: FieldZone,
  options: ImageExportOptions = {},
): ImageExportSize {
  const width = resolveImageExportWidth(options.width);
  return { width, height: Math.round(width / fieldWindowAspect(zone)) };
}
