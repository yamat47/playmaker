// ポリラインの純幾何（弧長・端の切り詰め）。DOM 非依存。
// 描画前のサンプル済みパスを扱うため、座標は Canvas px 空間（CanvasPoint）で受ける。

import type { CanvasPoint } from "./field.js";

/** 隣り合う 2 点の組を先頭から順に返す。2 点未満なら何も返さない。 */
export function* segments<T>(points: readonly T[]): Generator<readonly [T, T]> {
  // 前の点を箱に入れて持つ。T が undefined を含んでも「前の点が無い」と区別できる。
  let previous: { readonly point: T } | undefined;
  for (const point of points) {
    if (previous !== undefined) {
      yield [previous.point, point];
    }
    previous = { point };
  }
}

/** 隣接点間の距離を足し上げた全長。2 点未満なら 0。 */
export function polylineLength(path: readonly CanvasPoint[]): number {
  let total = 0;
  for (const [a, b] of segments(path)) {
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * 終点から弧長 distance だけ遡った点で終わる新しいポリラインを返す（元配列は変更しない）。
 *
 * 遡りは **累積長** で行う。最終区間だけを見ると、密にサンプルされた曲線では区間が短すぎて
 * 指定距離ぶん戻れない（終端に矢じりを置く用途では、線が先端まで伸びきって破綻する）。
 *
 * maxFraction は削りすぎて線が消えるのを防ぐ上限（全長に対する割合）。既定 1 は上限なし
 * ＝ distance が全長以上なら始点 1 点だけになる。
 */
export function trimPolylineEnd(
  path: readonly CanvasPoint[],
  distance: number,
  maxFraction = 1,
): CanvasPoint[] {
  if (path.length < 2 || distance <= 0) {
    return [...path];
  }
  let remaining =
    maxFraction >= 1 ? distance : Math.min(distance, polylineLength(path) * maxFraction);
  if (remaining <= 0) {
    return [...path];
  }

  // 矢じりの長さは全長よりずっと短く、たいてい終点側の数区間で止まるので、配列を複製せずに遡る。
  for (let i = path.length - 1; i > 0; i--) {
    const a = path[i - 1];
    const b = path[i];
    /* v8 ignore start -- i は 1 から path.length - 1 までなので、a も b も範囲の内側にある。 */
    if (a === undefined || b === undefined) {
      break;
    }
    /* v8 ignore stop */
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    // 等号で切ると a と同じ座標を足し、長さ 0 の区間が末尾に残る（丸キャップが点を描く）。
    if (segLen > remaining) {
      const t = (segLen - remaining) / segLen;
      return [...path.slice(0, i), { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }];
    }
    remaining -= segLen;
  }
  return path.slice(0, 1);
}
