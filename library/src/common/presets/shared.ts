import { isOneOf } from "../model/guards.js";

export const TEAM_SIDE_VALUES = ["offense", "defense"] as const;

export type TeamSide = (typeof TEAM_SIDE_VALUES)[number];

export function isTeamSide(value: unknown): value is TeamSide {
  return isOneOf(value, TEAM_SIDE_VALUES);
}

/**
 * Freezes the value and every object inside it, then returns it. The presets are shared by all
 * consumers, so one of them modifying a preset would change what the others load as well.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
