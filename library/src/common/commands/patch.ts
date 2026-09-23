import type { Line, LineInterpolation, LineKind } from "../model/line.js";
import type { FieldPosition, Player, PlayerShape } from "../model/player.js";

/** 指定したキーだけを差し替える。色と太さは null で値を消し、既定に戻す。 */
export interface LinePatch {
  readonly kind?: LineKind;
  readonly interpolation?: LineInterpolation;
  readonly waypoints?: readonly FieldPosition[];
  readonly end?: FieldPosition;
  readonly color?: string | null;
  readonly thickness?: number | null;
}

/** 指定したキーだけを差し替える。色は null で値を消し、既定に戻す。 */
export interface PlayerPatch {
  readonly position?: FieldPosition;
  readonly label?: string;
  readonly shape?: PlayerShape;
  readonly color?: string | null;
}

/** undefined は今の値を保ち、null は値を消す。 */
function resolveClearable<T>(patched: T | null | undefined, current: T | undefined): T | undefined {
  return patched === undefined ? current : (patched ?? undefined);
}

export function applyLinePatch(current: Line, patch: LinePatch): Line {
  const { color, thickness, ...replaced } = patch;
  const { color: currentColor, thickness: currentThickness, ...base } = current;
  const nextColor = resolveClearable(color, currentColor);
  const nextThickness = resolveClearable(thickness, currentThickness);
  return {
    ...base,
    ...replaced,
    ...(nextColor === undefined ? {} : { color: nextColor }),
    ...(nextThickness === undefined ? {} : { thickness: nextThickness }),
  };
}

export function applyPlayerPatch(current: Player, patch: PlayerPatch): Player {
  const { color, ...replaced } = patch;
  const { color: currentColor, ...base } = current;
  const nextColor = resolveClearable(color, currentColor);
  return {
    ...base,
    ...replaced,
    ...(nextColor === undefined ? {} : { color: nextColor }),
  };
}

/**
 * パッチを当てると値が 1 つでも変わるか。変わらないパッチを履歴に積むと、戻しても何も起きない
 * Undo 段ができる。配列や位置は中身ではなく参照で比べる。
 */
export function patchChangesAnything<T>(
  current: T,
  patch: { readonly [K in keyof T]?: T[K] | null },
): boolean {
  return (Object.keys(patch) as (keyof T)[]).some((key) => {
    const value = patch[key];
    return value !== undefined && resolveClearable(value, current[key]) !== current[key];
  });
}
