import type { LineInterpolation } from "../model/line.js";
import type { FieldPosition } from "../model/player.js";
import { segments } from "./polyline.js";

/** ベジェの 1 区間を何分割するか。プレー図の大きさでは、これで角が見えない。 */
export const DEFAULT_BEZIER_SAMPLES_PER_SEGMENT = 16;

/** p0 から p1 へ、制御点 c1 と c2 で曲げた 3 次ベジェの、t（0 以上 1 以下）での位置。 */
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
    downfieldYard:
      a * p0.downfieldYard + b * c1.downfieldYard + c * c2.downfieldYard + d * p1.downfieldYard,
  };
}

/**
 * p1 から p2 への区間を、前後の点 p0 と p3 から決まる向きで通す 3 次ベジェの制御点 [c1, c2]。
 * 一様な Catmull-Rom 曲線と同じ形になる。端の区間では、無い側の点に端の点そのものを渡す。
 * waypoint をそのままベジェの制御点にしないのは、曲線が waypoint を通らなくなるため。
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
      downfieldYard: p1.downfieldYard + (p2.downfieldYard - p0.downfieldYard) / 6,
    },
    {
      lateralYard: p2.lateralYard - (p3.lateralYard - p1.lateralYard) / 6,
      downfieldYard: p2.downfieldYard - (p3.downfieldYard - p1.downfieldYard) / 6,
    },
  ];
}

/** 同じ座標が続くと向きが 0 になり曲線が崩れるので、1 つに畳む。 */
function dedupeConsecutive(points: readonly FieldPosition[]): FieldPosition[] {
  const out: FieldPosition[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (
      last === undefined ||
      last.lateralYard !== p.lateralYard ||
      last.downfieldYard !== p.downfieldYard
    ) {
      out.push({ lateralYard: p.lateralYard, downfieldYard: p.downfieldYard });
    }
  }
  return out;
}

/**
 * 制御点の列を、描くときと当たり判定に使う折れ線にする。`straight` と、同じ座標を畳んで
 * 2 点以下になる列は、制御点をそのまま結ぶ。返り値は新しい配列。samplesPerSegment は 1 以上に丸める。
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

  const result: FieldPosition[] = pts.slice(0, 1);
  for (const [i, [p1, p2]] of [...segments(pts)].entries()) {
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const [c1, c2] = catmullRomBezierControls(p0, p1, p2, p3);
    // t=0 の点は前の区間の終点と同じなので、t は 0 を除いて 1 まで刻む。
    for (let s = 1; s <= steps; s++) {
      result.push(cubicBezierPoint(p1, c1, c2, p2, s / steps));
    }
  }
  return result;
}
