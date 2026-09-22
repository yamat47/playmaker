// 線の曲線サンプリング（PRD 5.3 ルート線の「直線とベジェ曲線の両方をサポート」）。
// DOM 非依存の純計算。レンダラを薄く保ち hit-test と同じ幾何を共有するため、
// 曲線はここで「ヤード空間のポリライン」へサンプリングしてから描画/当たり判定する。

import type { LineInterpolation } from "../model/line.js";
import type { FieldPosition } from "../model/player.js";

/** ベジェ 1 区間あたりのサンプル分割数。図用途では十分滑らかで安価。 */
export const DEFAULT_BEZIER_SAMPLES_PER_SEGMENT = 16;

/**
 * 3 次ベジェ B(t)（0 ≤ t ≤ 1）。p0→p1 を制御点 c1,c2 で曲げる基本プリミティブ。
 * Catmull-Rom から変換した制御点と組み合わせて waypoint を通る曲線を作る。
 */
export function cubicBezierPoint(
  p0: FieldPosition,
  c1: FieldPosition,
  c2: FieldPosition,
  p1: FieldPosition,
  t: number,
): FieldPosition {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    lateralYard: a * p0.lateralYard + b * c1.lateralYard + c * c2.lateralYard + d * p1.lateralYard,
    absoluteYard:
      a * p0.absoluteYard + b * c1.absoluteYard + c * c2.absoluteYard + d * p1.absoluteYard,
  };
}

/**
 * p1→p2 区間を、隣接点 p0/p3 の接線で滑らかに通す Catmull-Rom 相当の
 * 3 次ベジェ制御点 [c1, c2] を返す（一様パラメタ化・標準の 1/6 係数）。
 * 端では p0=p1 / p3=p2 を渡す（呼び出し側で複製）。曲線は全制御点を必ず通る
 * ＝ route が waypoint を確実に経由する、図作成に望ましい性質。
 */
export function catmullRomBezierControls(
  p0: FieldPosition,
  p1: FieldPosition,
  p2: FieldPosition,
  p3: FieldPosition,
): [FieldPosition, FieldPosition] {
  return [
    {
      lateralYard: p1.lateralYard + (p2.lateralYard - p0.lateralYard) / 6,
      absoluteYard: p1.absoluteYard + (p2.absoluteYard - p0.absoluteYard) / 6,
    },
    {
      lateralYard: p2.lateralYard - (p3.lateralYard - p1.lateralYard) / 6,
      absoluteYard: p2.absoluteYard - (p3.absoluteYard - p1.absoluteYard) / 6,
    },
  ];
}

/** 連続する同一点を畳む（接線が 0 になり曲線が破綻するのを防ぐ）。 */
function dedupeConsecutive(points: readonly FieldPosition[]): FieldPosition[] {
  const out: FieldPosition[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (
      last === undefined ||
      last.lateralYard !== p.lateralYard ||
      last.absoluteYard !== p.absoluteYard
    ) {
      out.push({ lateralYard: p.lateralYard, absoluteYard: p.absoluteYard });
    }
  }
  return out;
}

/**
 * 制御点列を描画/hit-test 用のポリライン（ヤード空間）へ変換する。
 * - `straight` または実質 2 点以下: 制御点をそのまま結ぶ（コピー）
 * - `bezier`: 全点を通る Catmull-Rom 曲線を区間ごとにサンプリング
 * 返り値は常に新規配列。samplesPerSegment は 1 以上に丸める。
 */
export function sampleLinePath(
  points: readonly FieldPosition[],
  interpolation: LineInterpolation,
  samplesPerSegment: number = DEFAULT_BEZIER_SAMPLES_PER_SEGMENT,
): FieldPosition[] {
  const pts = dedupeConsecutive(points);
  if (interpolation === "straight" || pts.length < 3) {
    return pts;
  }
  const steps = Math.max(1, Math.floor(samplesPerSegment));

  // 端点は自身を複製して接線の参照に使う（曲線が端点を通るようにする）。
  const first = pts[0] as FieldPosition;
  const result: FieldPosition[] = [{ ...first }];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? (pts[i] as FieldPosition);
    const p1 = pts[i] as FieldPosition;
    const p2 = pts[i + 1] as FieldPosition;
    const p3 = pts[i + 2] ?? p2;
    const [c1, c2] = catmullRomBezierControls(p0, p1, p2, p3);
    // t=0 は前区間の終端と重複するので (0,1] を刻む。
    for (let s = 1; s <= steps; s++) {
      result.push(cubicBezierPoint(p1, c1, c2, p2, s / steps));
    }
  }
  return result;
}
