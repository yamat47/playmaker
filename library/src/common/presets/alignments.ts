// 隊形とプレーのプリセットで共有する配置。縦は LOS からの位置（LOS が 0 で、攻撃方向が正）で、
// 横はセンターを 26.5 ヤード（フィールドの中央）に置く。位置はすべて 0.5 ヤードの格子点で書く。
// どのゾーンで読み込んでも窓に収まる。名称は英語で書く。フィールド上の表記を英語に揃えるため。
//
// OL は LOS の 1 ヤード後ろ、守備ラインは 1.5 ヤード前に置き、マーカーが重ならない隙間を空ける。
// LOS 上の選手（OL、TE、外側の WR）は -1、LOS から下がる選手（スロット、フランカー）は -2、
// センター直下の QB は -3。守備ラインは OL の肩に付ける（シェード）ので、どのギャップを誰が
// 守るかが読める。守備の選手には全員ラベルを付ける。
//
// 選手は id を持つ。プレーの線が起点の選手を id で指すためで、隊形にするときは id を外す。

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
 * 相手の 1 ヤード手前。ブロックの終点に使い、T 字のバーが相手のマーカーの縁に付く。
 * lateral で相手の肩の側へずらす（リーチやダウンブロック）。
 */
export function shortOf(target: FieldPosition, lateral = 0): FieldPosition {
  return pt(target.lateralYard + lateral, target.downfieldYard - 1);
}

/** 相手の肩の横。コンボブロックで LB へ上がる側が経由する。lateral は 1 ヤード以上離す。 */
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

// 4 ダウンのオーバーフロント。右を強い側として、E は LT の外側の肩、N は C の弱い側の肩、
// T は RG の外側の肩、E は RT の外側の肩に付ける。
export const FRONT_4 = {
  eL: pt(20.5, 1.5),
  n: pt(25.5, 1.5),
  t: pt(30, 1.5),
  eR: pt(32.5, 1.5),
} as const;

// 3 ダウンのオッドフロント。N は C の真上、E は両タックルの内側の肩。
export const FRONT_3 = {
  eL: pt(22.5, 1.5),
  n: pt(26.5, 1.5),
  eR: pt(30.5, 1.5),
} as const;

// 4-3 の LB。S は TE の外側に付ける。
export const LB_43 = { w: pt(22.5, 5), m: pt(27, 5), s: pt(36, 5) } as const;

// ニッケルの ILB 2 人と、スロットに付くニッケルバック。
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

export function front4(): Player[] {
  return [
    player("de-l", "E", FRONT_4.eL),
    player("dt-l", "N", FRONT_4.n),
    player("dt-r", "T", FRONT_4.t),
    player("de-r", "E", FRONT_4.eR),
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

// ---- 攻撃の隊形 ----

export function iFormation(): Player[] {
  return [
    ...offensiveLine(),
    player("y", "Y", pt(34, -1), "square"),
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
    player("y", "Y", pt(34, -1), "square"),
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
    player("y", "Y", pt(34, -1), "square"),
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

// ---- 守備の隊形 ----

export function defense43(): Player[] {
  return [
    ...front4(),
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

/** ニッケルの前の 6 人（4 ダウンと ILB 2 人）。 */
export function nickelFront(): Player[] {
  return [...front4(), player("mlb", "M", LB_NICKEL.m), player("wlb", "W", LB_NICKEL.w)];
}

/** ニッケルの後ろの 5 人の置き方。カバレッジやプレッシャーごとに変わる。 */
export interface NickelShell {
  readonly cornerDepth: number;
  readonly fs: FieldPosition;
  readonly ss: FieldPosition;
}

/** CB 6 ヤード、セイフティ 11 ヤードの 2 ハイ。 */
export const NICKEL_BASE: NickelShell = { cornerDepth: 6, fs: pt(22, 11), ss: pt(31, 11) };

export function nickel(shell: NickelShell): Player[] {
  return [
    ...nickelFront(),
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
