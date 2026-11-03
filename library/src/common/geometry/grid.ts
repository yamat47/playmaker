import type { FieldPosition } from "../model/player.js";

/**
 * 位置を置ける格子の刻み（ヤード）。横はサイドライン、縦は LOS を原点にする。
 * 図の中の位置はすべてこの格子点にあるので、要素同士を揃える操作が無くても縦横が揃う。
 */
export const GRID_STEP_YARDS = 0.5;

function snapYard(yard: number): number {
  // -0.2 を丸めると -0 になり、Object.is で比べる toEqual が 0 と区別するので 0 に寄せる。
  return Math.round(yard / GRID_STEP_YARDS) * GRID_STEP_YARDS + 0;
}

/** 位置を最も近い格子点へ寄せる。読み込んだ値と、ドラッグやクリックで決めた値の両方に使う。 */
export function snapToGrid(position: FieldPosition): FieldPosition {
  return {
    lateralYard: snapYard(position.lateralYard),
    downfieldYard: snapYard(position.downfieldYard),
  };
}
