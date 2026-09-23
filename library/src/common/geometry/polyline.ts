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
 * 終点から折れ線に沿って distance だけ戻った点で終わる、新しい折れ線を返す。
 * 最後の区間だけで戻らないのは、細かく刻んだ曲線では 1 区間が distance より短いため。
 * maxFraction は削る長さの上限で、全長に対する割合で渡す。既定の 1 では上限が無く、
 * distance が全長以上なら始点 1 点だけを返す。
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
