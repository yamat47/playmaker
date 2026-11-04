import type { FieldPosition } from "../model/player.js";

/**
 * Step of the grid (in yards) that positions can be placed on. The origin is the sideline
 * laterally and the LOS vertically. Every position in the diagram sits on a grid point, so
 * elements line up vertically and horizontally without an explicit align operation.
 */
export const GRID_STEP_YARDS = 0.5;

function snapYard(yard: number): number {
  // Rounding -0.2 gives -0, which toEqual (Object.is) distinguishes from 0, so coerce it to 0.
  return Math.round(yard / GRID_STEP_YARDS) * GRID_STEP_YARDS + 0;
}

/** Snaps a position to the nearest grid point, for loaded values and drag or click positions. */
export function snapToGrid(position: FieldPosition): FieldPosition {
  return {
    lateralYard: snapYard(position.lateralYard),
    downfieldYard: snapYard(position.downfieldYard),
  };
}
