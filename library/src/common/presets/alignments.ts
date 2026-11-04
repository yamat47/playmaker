// Alignments shared by the formation presets and the play presets. Vertical is the position from
// the LOS (the LOS is 0 and the offense's direction is positive), and horizontal puts the center
// at 26.5 yards (the middle of the field). Every position is written on a 0.5-yard grid point.
// They fit in the window of whichever zone they are loaded into. Names are English only; they are
// not localized through the ja dictionary.
//
// The OL sit 1 yard behind the LOS and the defensive line 1.5 yards in front of it, leaving a gap
// so the markers do not overlap. Players on the LOS (OL, TE, outside WRs) are at -1, players off
// the LOS (slot, flanker) at -2, and a QB under center at -3. The defensive line aligns on the
// OL's shoulders (shades), so it is readable which gap each defender has. Against a formation
// with a TE, the front aligns over, with the strong-side E on the TE's outside shoulder
// (9-technique). Every defensive player gets a label.
//
// Players have ids, because play lines refer to their starting player by id. The ids are stripped
// when they are turned into formations.

import type { FieldPosition, Player, PlayerShape } from "../model/player.js";

export function pt(lateralYard: number, downfieldYard: number): FieldPosition {
  return { lateralYard, downfieldYard };
}

export function player(
  id: string,
  label: string,
  position: FieldPosition,
  shape: PlayerShape = "circle",
): Player {
  return { id, position, shape, label };
}

/**
 * 1 yard short of the opponent. Used as a block's end point, so the T bar touches the edge of the
 * opponent's marker. lateral shifts it toward the opponent's shoulder (reach or down block).
 */
export function shortOf(target: FieldPosition, lateral = 0): FieldPosition {
  return pt(target.lateralYard + lateral, target.downfieldYard - 1);
}

/**
 * Beside the opponent's shoulder. In a combo block, the blocker climbing to the LB goes through
 * here. lateral is kept at least 1 yard away.
 */
export function beside(target: FieldPosition, lateral: number): FieldPosition {
  return pt(target.lateralYard + lateral, target.downfieldYard);
}

export const OL = {
  lt: pt(21.5, -1),
  lg: pt(24, -1),
  c: pt(26.5, -1),
  rg: pt(29, -1),
  rt: pt(31.5, -1),
} as const;

// Four-down over front. With the right as the strong side, the E aligns on the LT's outside
// shoulder, the N on the C's weak-side shoulder, and the T on the RG's outside shoulder. With no
// TE, the strong-side E aligns on the RT's outside shoulder.
export const FRONT_4 = {
  eL: pt(20.5, 1.5),
  n: pt(25.5, 1.5),
  t: pt(30, 1.5),
  eR: pt(32.5, 1.5),
} as const;

/** The strong-side E when the TE is on the right: the TE's outside shoulder (9-technique). */
export const END_OVER_TE = pt(35.5, 1.5);

// Three-down odd front. N head up on the C, Es on the inside shoulder of each tackle.
export const FRONT_3 = {
  eL: pt(22.5, 1.5),
  n: pt(26.5, 1.5),
  eR: pt(30.5, 1.5),
} as const;

// 4-3 over LBs. The S aligns head up on the TE.
export const LB_43 = { w: pt(22.5, 5), m: pt(27, 5), s: pt(34.5, 5) } as const;

// The two nickel ILBs and the nickel back covering the slot.
export const LB_NICKEL = { m: pt(24, 5), w: pt(30, 5), nb: pt(14, 5) } as const;

export function cornerSpots(depth: number): { left: FieldPosition; right: FieldPosition } {
  return { left: pt(6.5, depth), right: pt(46.5, depth) };
}

export function offensiveLine(): Player[] {
  return [
    player("lt", "LT", OL.lt, "square"),
    player("lg", "LG", OL.lg, "square"),
    player("c", "C", OL.c, "square"),
    player("rg", "RG", OL.rg, "square"),
    player("rt", "RT", OL.rt, "square"),
  ];
}

export function front4(strongEnd: FieldPosition = FRONT_4.eR): Player[] {
  return [
    player("de-l", "E", FRONT_4.eL),
    player("dt-l", "N", FRONT_4.n),
    player("dt-r", "T", FRONT_4.t),
    player("de-r", "E", strongEnd),
  ];
}

export function front3(): Player[] {
  return [
    player("de-l", "E", FRONT_3.eL),
    player("nt", "N", FRONT_3.n),
    player("de-r", "E", FRONT_3.eR),
  ];
}

export function corners(depth: number): Player[] {
  const { left, right } = cornerSpots(depth);
  return [player("cb-l", "CB", left), player("cb-r", "CB", right)];
}

// ---- Offensive formations ----

export function iFormation(): Player[] {
  return [
    ...offensiveLine(),
    player("y", "Y", pt(34.5, -1), "square"),
    player("qb", "QB", pt(26.5, -3)),
    player("fb", "FB", pt(26.5, -6)),
    player("rb", "RB", pt(26.5, -8.5)),
    player("x", "X", pt(6.5, -1)),
    player("z", "Z", pt(46.5, -2)),
  ];
}

export function singlebackAce(): Player[] {
  return [
    ...offensiveLine(),
    player("y", "Y", pt(34.5, -1), "square"),
    player("qb", "QB", pt(26.5, -3)),
    player("rb", "RB", pt(26.5, -7.5)),
    player("x", "X", pt(6, -1)),
    player("h", "H", pt(40, -2)),
    player("z", "Z", pt(47, -1)),
  ];
}

export function shotgunSpread(): Player[] {
  return [
    ...offensiveLine(),
    player("qb", "QB", pt(26.5, -5)),
    player("rb", "RB", pt(29.5, -5)),
    player("x", "X", pt(5.5, -1)),
    player("y", "Y", pt(13, -2)),
    player("h", "H", pt(40, -2)),
    player("z", "Z", pt(47.5, -1)),
  ];
}

export function trips(): Player[] {
  return [
    ...offensiveLine(),
    player("qb", "QB", pt(26.5, -5)),
    player("rb", "RB", pt(24, -5)),
    player("x", "X", pt(5.5, -1)),
    player("y", "Y", pt(34.5, -1), "square"),
    player("h", "H", pt(41, -2)),
    player("z", "Z", pt(47.5, -1)),
  ];
}

export function empty(): Player[] {
  return [
    ...offensiveLine(),
    player("qb", "QB", pt(26.5, -5)),
    player("x", "X", pt(5, -1)),
    player("f", "F", pt(12, -2)),
    player("y", "Y", pt(34.5, -1), "square"),
    player("h", "H", pt(41, -2)),
    player("z", "Z", pt(48, -1)),
  ];
}

export function pistol(): Player[] {
  return [
    ...offensiveLine(),
    player("y", "Y", pt(34.5, -1), "square"),
    player("qb", "QB", pt(26.5, -4.5)),
    player("rb", "RB", pt(26.5, -7.5)),
    player("x", "X", pt(6, -1)),
    player("h", "H", pt(40, -2)),
    player("z", "Z", pt(47, -1)),
  ];
}

export function bunch(): Player[] {
  return [
    ...offensiveLine(),
    player("qb", "QB", pt(26.5, -5)),
    player("rb", "RB", pt(24, -5)),
    player("x", "X", pt(5.5, -1)),
    player("z", "Z", pt(37, -1)),
    player("h", "H", pt(34.5, -2)),
    player("y", "Y", pt(39.5, -2)),
  ];
}

// ---- Defensive formations ----

/** 4-3 over. Aligned against a formation with the TE on the right. */
export function defense43(): Player[] {
  return [
    ...front4(END_OVER_TE),
    player("wlb", "W", LB_43.w),
    player("mlb", "M", LB_43.m),
    player("slb", "S", LB_43.s),
    ...corners(6),
    player("fs", "FS", pt(23, 11)),
    player("ss", "SS", pt(32, 9)),
  ];
}

export function defense34(): Player[] {
  return [
    ...front3(),
    player("wlb", "W", pt(19, 2.5)),
    player("mlb", "M", pt(24.5, 5)),
    player("tlb", "T", pt(29, 5)),
    player("slb", "S", pt(34.5, 2.5)),
    ...corners(6),
    player("fs", "FS", pt(23, 11)),
    player("ss", "SS", pt(30, 11)),
  ];
}

/** The six front players of the nickel (four down linemen and two ILBs). */
export function nickelFront(strongEnd: FieldPosition = FRONT_4.eR): Player[] {
  return [...front4(strongEnd), player("mlb", "M", LB_NICKEL.m), player("wlb", "W", LB_NICKEL.w)];
}

/** How the five back-end players of the nickel are placed. Varies by coverage and pressure. */
export interface NickelShell {
  readonly cornerDepth: number;
  readonly fs: FieldPosition;
  readonly ss: FieldPosition;
}

/** Two-high shell with the CBs at 6 yards and the safeties at 11. */
export const NICKEL_BASE: NickelShell = { cornerDepth: 6, fs: pt(22, 11), ss: pt(31, 11) };

export function nickel(shell: NickelShell, strongEnd: FieldPosition = FRONT_4.eR): Player[] {
  return [
    ...nickelFront(strongEnd),
    player("nb", "NB", LB_NICKEL.nb),
    ...corners(shell.cornerDepth),
    player("fs", "FS", shell.fs),
    player("ss", "SS", shell.ss),
  ];
}

export function dime(): Player[] {
  return [
    ...front4(),
    player("mlb", "M", pt(27, 5)),
    player("nb", "NB", LB_NICKEL.nb),
    player("db", "$", pt(39, 5)),
    ...corners(6),
    player("fs", "FS", pt(22, 11)),
    player("ss", "SS", pt(31, 11)),
  ];
}

export function defense425(): Player[] {
  return [
    ...front4(),
    player("mlb", "M", pt(24.5, 5)),
    player("wlb", "W", LB_NICKEL.w),
    player("nb", "NB", pt(39, 5)),
    ...corners(6),
    player("fs", "FS", pt(23, 11)),
    player("ss", "SS", pt(31, 9)),
  ];
}

export function defense335(): Player[] {
  return [
    ...front3(),
    player("wlb", "W", pt(20.5, 5)),
    player("mlb", "M", pt(26.5, 5)),
    player("slb", "S", pt(32.5, 5)),
    player("nb", "NB", LB_NICKEL.nb),
    ...corners(6),
    player("fs", "FS", pt(23, 11)),
    player("ss", "SS", pt(31, 9)),
  ];
}
