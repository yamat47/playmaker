// PNG エクスポートの寸法決定（DOM 非依存の純計算・VSCode 流 common）。
// 実際の Canvas 描画・toBlob は browser に置き、ここは「外部から渡された
// エクスポート設定を安全な出力ピクセル寸法へ正規化する」ロジックだけを持つ
// → node 単体テストで全網羅でき、browser は薄い殻に保てる（PRD 5.7 / 4.1）。
//
// 外部受け入れの作法は resolvePlayData / normalizeFormation と揃える：
// 公開境界で不正値を既定へ丸め、復元不能なら投げずに安全側へ倒す（PRD 6.6 流）。

import { FIELD_WIDTH_YARDS, zoneWindowLength } from "../geometry/field.js";
import type { FieldZone } from "../model/play-data.js";

/**
 * フィールド窓（幅 FIELD_WIDTH_YARDS × 縦＝ゾーン窓長）のアスペクト比。
 * レッドゾーン窓は middle より縦長なのでゾーンごとに異なる。出力高さをこの比から
 * 導けば、エクスポート画像はレターボックス余白なしでフィールド窓ぴったりになる
 * （FieldGeometry の offset がほぼ 0 になる）。
 */
export function fieldWindowAspect(zone: FieldZone): number {
  return FIELD_WIDTH_YARDS / zoneWindowLength(zone);
}

/** width 未指定/不正時の既定出力幅(px)。組み込み先が十分な解像度を得られる目安。 */
export const DEFAULT_EXPORT_WIDTH = 1600;

export interface ImageExportOptions {
  /**
   * 出力 PNG の横幅(px)。高さはゾーン窓のアスペクト比から導く。
   * 未指定・非有限・1 未満は DEFAULT_EXPORT_WIDTH に丸める（外部入力の防御）。
   */
  width?: number;
}

export interface ImageExportSize {
  width: number;
  height: number;
}

/** 外部由来の幅を安全な整数 px へ正規化する（非有限・1 未満は既定値）。 */
export function resolveImageExportWidth(width: number | undefined): number {
  return typeof width === "number" && Number.isFinite(width) && width >= 1
    ? Math.round(width)
    : DEFAULT_EXPORT_WIDTH;
}

/**
 * エクスポート設定 → 出力ピクセル寸法。幅は正規化し、高さはゾーン窓の
 * アスペクト比から導く。width >= 1 なので height も必ず 1 以上になる
 * （冗長な下限ガードは置かない＝common 100% を素直に保つ方針）。
 */
export function resolveImageExportSize(
  zone: FieldZone,
  options: ImageExportOptions = {},
): ImageExportSize {
  const width = resolveImageExportWidth(options.width);
  return { width, height: Math.round(width / fieldWindowAspect(zone)) };
}
