import type { CanvasPoint } from "./field.js";
import { trimPolylineEnd } from "./polyline.js";

// 線が矢じりより短くても消えないよう、切り詰めは全長のこの割合までに留める（残りは矢じりが覆う）。
const ARROW_TRIM_MAX_FRACTION = 0.9;

interface LineEnd {
  readonly tip: CanvasPoint;
  /** 終点へ向かう単位ベクトル。 */
  readonly ux: number;
  readonly uy: number;
}

/**
 * 終点と、終点へ向かう向き。曲線の末尾には終点と同じ座標の点が並ぶことがあるので、
 * 終点と座標の違う直近の点から向きを求める。すべての点が同じ座標なら undefined。
 */
function lineEnd(path: readonly CanvasPoint[]): LineEnd | undefined {
  const tip = path.at(-1);
  if (tip === undefined) {
    return undefined;
  }
  // 毎フレーム線ごとに呼ぶので、配列を複製せずに終点側から探す。
  for (let i = path.length - 2; i >= 0; i--) {
    const from = path[i];
    if (from !== undefined && (from.x !== tip.x || from.y !== tip.y)) {
      const dx = tip.x - from.x;
      const dy = tip.y - from.y;
      const length = Math.hypot(dx, dy);
      return { tip, ux: dx / length, uy: dy / length };
    }
  }
  return undefined;
}

/** 矢じりの根元で止めた線。矢じりより短い線も、全長の 1 割は残す。 */
export function trimForArrowHead(path: readonly CanvasPoint[], arrowLength: number): CanvasPoint[] {
  return trimPolylineEnd(path, arrowLength, ARROW_TRIM_MAX_FRACTION);
}

/**
 * 終点を先端にして進行方向へ向けた、矢じりの三角形の頂点（先端、根元の両端）。
 * 向きが決まらない線では undefined。
 */
export function arrowHeadVertices(
  path: readonly CanvasPoint[],
  arrowLength: number,
  halfWidth: number,
): readonly [CanvasPoint, CanvasPoint, CanvasPoint] | undefined {
  const end = lineEnd(path);
  if (end === undefined) {
    return undefined;
  }
  const { tip, ux, uy } = end;
  const baseX = tip.x - arrowLength * ux;
  const baseY = tip.y - arrowLength * uy;
  return [
    tip,
    { x: baseX - halfWidth * uy, y: baseY + halfWidth * ux },
    { x: baseX + halfWidth * uy, y: baseY - halfWidth * ux },
  ];
}

/** 終点を中点にして進行方向と直交する、T 字の横棒の両端。向きが決まらない線では undefined。 */
export function blockCapEndpoints(
  path: readonly CanvasPoint[],
  capLength: number,
): readonly [CanvasPoint, CanvasPoint] | undefined {
  const end = lineEnd(path);
  if (end === undefined) {
    return undefined;
  }
  const { tip, ux, uy } = end;
  const half = capLength / 2;
  return [
    { x: tip.x + half * uy, y: tip.y - half * ux },
    { x: tip.x - half * uy, y: tip.y + half * ux },
  ];
}
