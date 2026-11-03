import { isOneOf } from "../model/guards.js";

export const TEAM_SIDE_VALUES = ["offense", "defense"] as const;

export type TeamSide = (typeof TEAM_SIDE_VALUES)[number];

export function isTeamSide(value: unknown): value is TeamSide {
  return isOneOf(value, TEAM_SIDE_VALUES);
}

/**
 * 値とその中のオブジェクトをすべて凍結して返す。プリセットは全利用者が共有するので、
 * 1 人が書き換えると他の読み込み結果まで変わってしまう。
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
