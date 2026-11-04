// 配置は presets/alignments.ts にあり、隊形のプリセットと共有する。middle ゾーンの窓（LOS の前後
// 15 ヤード）に収まる。ルート、ブロック、モーションを持つのは主役の側だけで、相手の側は選手の
// 配置だけを持つ。
//
// 線の決まり。ブロックの終点は相手の 1 ヤード手前（shortOf）に置き、T 字のバーが相手のマーカーの
// 縁に付く。コンボブロックは一方が相手の手前で止まり、もう一方が相手の肩（beside）を経由して LB の
// 手前へ上がる。穴をリードするプルは相手ではなく穴を狙うので座標で書く。走路とプルは、他の選手の
// マーカーの中心から 1 ヤード以上離す（OL の間隔が 2.5 ヤードなので、ギャップを通る線は縁に
// 触れる）。守備のラッシュは LOS（0）で止め、ゾーンのドロップは LOS から離れる向き（+）へ描く。

import type { Line, LineInterpolation, LineKind } from "../model/line.js";
import { CURRENT_PLAY_DATA_VERSION, fieldStateForZone } from "../model/play-data.js";
import type { FieldPosition, Player } from "../model/player.js";
import {
  beside,
  cornerSpots,
  defense43,
  END_OVER_TE,
  FRONT_4,
  iFormation,
  LB_43,
  LB_NICKEL,
  NICKEL_BASE,
  type NickelShell,
  nickel,
  nickelFront,
  offensiveLine,
  player,
  pt,
  shortOf,
  shotgunSpread,
  singlebackAce,
  trips,
} from "../presets/alignments.js";
import { deepFreeze, type TeamSide } from "../presets/shared.js";
import type { PlayCategory, PlayPreset } from "./play-preset.js";

/** 色は持たせず、テーマの既定の色で描く。攻守の見分けは選手の形とラベルで付ける。 */
function ln(
  id: string,
  kind: LineKind,
  startPlayerId: string,
  waypoints: FieldPosition[],
  end: FieldPosition,
  interpolation: LineInterpolation,
): Line {
  return { id, kind, startPlayerId, waypoints, end, interpolation };
}

function play(
  id: string,
  name: string,
  side: TeamSide,
  category: PlayCategory,
  personnel: string,
  summary: string,
  players: Player[],
  lines: Line[],
): PlayPreset {
  return {
    id,
    name,
    side,
    category,
    personnel,
    summary,
    data: {
      version: CURRENT_PLAY_DATA_VERSION,
      field: fieldStateForZone("middle"),
      players,
      lines,
    },
  };
}

// オフェンスのプレーに添える守備のうち、CB の深さとセイフティの置き方がカバレッジで変わるもの。
const COVER_2_SHELL = { cornerDepth: 5, fs: pt(18, 12), ss: pt(35, 12) } satisfies NickelShell;
const COVER_3_SHELL = { cornerDepth: 7, fs: pt(26.5, 12), ss: pt(34, 6) } satisfies NickelShell;

const INSIDE_ZONE = play(
  "play-inside-zone",
  "Inside Zone",
  "offense",
  "run-zone",
  "11 pers",
  "Zone blocking, hitting inside in one motion. The RB aims inside the RG and cuts to the B gap or the backside A gap off the 3-technique's movement.",
  [
    ...offensiveLine(),
    player("y", "Y", pt(34.5, -1), "square"),
    player("qb", "QB", pt(26.5, -5)),
    player("rb", "RB", pt(24, -5)),
    player("x", "X", pt(6, -1)),
    player("h", "H", pt(40, -2)),
    player("z", "Z", pt(47, -1)),
    ...defense43(),
  ],
  [
    ln("bl-lt", "block", "lt", [], shortOf(FRONT_4.eL), "straight"),
    ln("bl-lg", "block", "lg", [], shortOf(FRONT_4.n), "straight"),
    ln("bl-c", "block", "c", [beside(FRONT_4.n, 1)], shortOf(LB_43.m), "bezier"),
    ln("bl-rg", "block", "rg", [], shortOf(FRONT_4.t), "straight"),
    ln("bl-rt", "block", "rt", [beside(FRONT_4.t, 1.5)], shortOf(LB_43.s), "bezier"),
    ln("bl-y", "block", "y", [], shortOf(END_OVER_TE), "straight"),
    ln("run-rb", "route", "rb", [pt(27.5, -2)], pt(28, 3.5), "bezier"),
  ],
);

const OUTSIDE_ZONE = play(
  "play-outside-zone",
  "Outside Zone",
  "offense",
  "run-zone",
  "11 pers",
  "Wide zone, stretching the defense sideways. The RB aims outside the TE and bounces out or cuts upfield off the E and S.",
  [...singlebackAce(), ...defense43()],
  [
    ln("bl-lt", "block", "lt", [], shortOf(FRONT_4.eL), "straight"),
    ln("bl-lg", "block", "lg", [], shortOf(FRONT_4.n), "straight"),
    ln("bl-c", "block", "c", [beside(FRONT_4.n, 1)], shortOf(LB_43.m, 0.5), "bezier"),
    ln("bl-rg", "block", "rg", [], shortOf(FRONT_4.t, 0.5), "straight"),
    ln("bl-rt", "block", "rt", [beside(FRONT_4.t, 1.5)], shortOf(LB_43.s, 0.5), "bezier"),
    ln("bl-y", "block", "y", [], shortOf(END_OVER_TE, 0.5), "straight"),
    ln("run-rb", "route", "rb", [pt(31, -5), pt(35.5, -2)], pt(37.5, 3), "bezier"),
  ],
);

const POWER = play(
  "play-power",
  "Power",
  "offense",
  "run-gap",
  "21 pers",
  "Down blocks on the play side, the FB kicks out the 9-technique E, and the backside guard pulls to lead through the C gap.",
  [...iFormation(), ...defense43()],
  [
    ln("bl-y", "block", "y", [], shortOf(LB_43.s), "straight"),
    ln("bl-rt", "block", "rt", [], shortOf(FRONT_4.t, 0.5), "straight"),
    ln("bl-rg", "block", "rg", [beside(FRONT_4.t, -1.5)], shortOf(LB_43.m), "bezier"),
    ln("bl-c", "block", "c", [], shortOf(FRONT_4.n), "straight"),
    ln("bl-lt", "block", "lt", [], shortOf(FRONT_4.eL), "straight"),
    ln(
      "lead-fb",
      "block",
      "fb",
      [pt(31, -3.5), pt(33.5, -0.5)],
      shortOf(END_OVER_TE, -0.5),
      "bezier",
    ),
    ln(
      "pull-lg",
      "block",
      "lg",
      [pt(25, -4), pt(31, -4), pt(32.5, -2), pt(32.5, 1)],
      pt(31.5, 3.5),
      "bezier",
    ),
    ln("run-rb", "route", "rb", [pt(30, -6), pt(33, -3)], pt(33.5, 4), "bezier"),
  ],
);

const COUNTER = play(
  "play-counter",
  "Counter (GT)",
  "offense",
  "run-gap",
  "21 pers",
  "The backside guard kicks out the 9-technique E, the tackle wraps through the C gap, and the FB fills where the tackle left (GT counter).",
  [...iFormation(), ...defense43()],
  [
    ln("bl-y", "block", "y", [], shortOf(LB_43.s), "straight"),
    ln("bl-rt", "block", "rt", [], shortOf(FRONT_4.t, 0.5), "straight"),
    ln("bl-rg", "block", "rg", [beside(FRONT_4.t, -1.5)], shortOf(LB_43.m), "bezier"),
    ln("bl-c", "block", "c", [], shortOf(FRONT_4.n), "straight"),
    ln(
      "pull-lg",
      "block",
      "lg",
      [pt(25, -4), pt(32, -4), pt(33.5, -0.5)],
      shortOf(END_OVER_TE, -0.5),
      "straight",
    ),
    ln(
      "pull-lt",
      "block",
      "lt",
      [pt(23, -5), pt(31, -5), pt(32.5, -2), pt(32.5, 1)],
      pt(31.5, 3.5),
      "straight",
    ),
    ln("fill-fb", "block", "fb", [pt(24, -3), pt(22.5, -0.5)], shortOf(FRONT_4.eL, 1), "bezier"),
    ln("run-rb", "route", "rb", [pt(24, -7.5), pt(30, -6.5), pt(33, -3)], pt(33.5, 4), "bezier"),
  ],
);

const FOUR_VERTICALS = play(
  "play-four-verticals",
  "Four Verticals",
  "offense",
  "pass-deep",
  "10 pers",
  "Four verticals from trips, attacking the seams against a single-high safety.",
  [...trips(), ...nickel(COVER_3_SHELL, END_OVER_TE)],
  [
    ln("go-x", "route", "x", [pt(4, 4)], pt(4, 13), "straight"),
    ln("seam-y", "route", "y", [pt(33, 5)], pt(31, 13), "bezier"),
    ln("seam-h", "route", "h", [pt(40, 5)], pt(38, 13), "bezier"),
    ln("go-z", "route", "z", [pt(49, 4)], pt(49, 13), "straight"),
    ln("chk-rb", "route", "rb", [], pt(20, -3), "straight"),
  ],
);

const MESH = play(
  "play-mesh",
  "Mesh",
  "offense",
  "pass-dropback",
  "10 pers",
  "Shallow crossers that mesh. Works against man and zone by running to the open spot.",
  [...shotgunSpread(), ...nickel(NICKEL_BASE)],
  [
    ln("cross-y", "route", "y", [pt(20, 3.5)], pt(38, 4), "straight"),
    ln("cross-h", "route", "h", [pt(33, 3)], pt(15, 3.5), "straight"),
    ln("corner-x", "route", "x", [pt(5, 5)], pt(2, 9), "bezier"),
    ln("sit-z", "route", "z", [], pt(47, 5), "straight"),
    ln("swing-rb", "route", "rb", [pt(33, -4)], pt(41, -3), "straight"),
  ],
);

const SMASH = play(
  "play-smash",
  "Smash",
  "offense",
  "pass-dropback",
  "11 pers",
  "A corner and hitch high-low that attacks the corner against Cover 2.",
  [...singlebackAce(), ...nickel(COVER_2_SHELL, END_OVER_TE)],
  [
    ln("hitch-z", "route", "z", [], pt(47, 3), "straight"),
    ln("corner-h", "route", "h", [pt(41, 4)], pt(46, 10), "bezier"),
    ln("dig-y", "route", "y", [pt(34.5, 8)], pt(27, 9), "straight"),
    ln("hitch-x", "route", "x", [], pt(6, 3), "straight"),
    ln("flat-rb", "route", "rb", [], pt(22, -4), "straight"),
  ],
);

const STICK = play(
  "play-stick",
  "Stick",
  "offense",
  "pass-quick",
  "11 pers",
  "A three-step quick game. Stick (sit down) and flat for a fast distribution.",
  [...singlebackAce(), ...nickel(NICKEL_BASE, END_OVER_TE)],
  [
    ln("stick-y", "route", "y", [], pt(34.5, 4), "straight"),
    ln("flat-h", "route", "h", [], pt(45, 0), "straight"),
    ln("hitch-z", "route", "z", [], pt(47, 3), "straight"),
    ln("slant-x", "route", "x", [pt(6, 2)], pt(10, 3), "bezier"),
    ln("chk-rb", "route", "rb", [], pt(21, -5), "straight"),
  ],
);

const RPO_BUBBLE = play(
  "play-rpo-bubble",
  "RPO (IZ + Bubble)",
  "offense",
  "rpo",
  "11 pers",
  "Reads the W on the bubble side: bubble if the W enters the box, inside zone if he stays.",
  [...shotgunSpread(), ...nickel(NICKEL_BASE)],
  [
    ln("bl-lt", "block", "lt", [], shortOf(FRONT_4.eL), "straight"),
    ln("bl-lg", "block", "lg", [beside(FRONT_4.n, -1)], shortOf(LB_NICKEL.m), "bezier"),
    ln("bl-c", "block", "c", [], shortOf(FRONT_4.n), "straight"),
    ln("bl-rg", "block", "rg", [], shortOf(FRONT_4.t), "straight"),
    ln("bl-rt", "block", "rt", [], shortOf(FRONT_4.eR), "straight"),
    ln("run-rb", "route", "rb", [pt(26, -2.5)], pt(23, 3), "straight"),
    ln("bubble-h", "route", "h", [pt(43, -3)], pt(46, -0.5), "bezier"),
    ln("bl-z", "block", "z", [], shortOf(cornerSpots(NICKEL_BASE.cornerDepth).right), "straight"),
    ln("glance-y", "route", "y", [pt(15, 1)], pt(19, 3), "bezier"),
  ],
);

const PA_BOOT = play(
  "play-pa-boot",
  "PA Boot (Sail)",
  "offense",
  "pa",
  "11 pers",
  "Play action with the QB booting out, attacking in three levels: flat, sail, and vertical.",
  [...singlebackAce(), ...defense43()],
  [
    ln("fake-rb", "motion", "rb", [pt(24, -6)], pt(20.5, -4.5), "straight"),
    ln("boot-qb", "route", "qb", [pt(31, -4)], pt(36.5, -5), "bezier"),
    ln("bl-lt", "block", "lt", [], shortOf(FRONT_4.eL), "straight"),
    ln("bl-c", "block", "c", [], shortOf(FRONT_4.n), "straight"),
    ln("bl-rg", "block", "rg", [], shortOf(FRONT_4.t), "straight"),
    ln("flat-y", "route", "y", [pt(37, -0.5)], pt(43, 0.5), "bezier"),
    ln("sail-h", "route", "h", [pt(41, 3)], pt(46, 8), "bezier"),
    ln("go-z", "route", "z", [pt(49, 3)], pt(49, 13), "straight"),
    ln("comeback-x", "route", "x", [pt(5, 9)], pt(7.5, 7.5), "bezier"),
  ],
);

const COVER_1 = play(
  "play-cover-1",
  "Cover 1 (Man Free)",
  "defense",
  "coverage",
  "Nickel",
  "One deep free safety, everyone else in man. The W waits in the hole (rat).",
  [...nickel({ cornerDepth: 6, fs: pt(26.5, 11), ss: pt(38, 6) }), ...shotgunSpread()],
  [
    ln("man-cbl", "motion", "cb-l", [], pt(5.5, 0.5), "straight"),
    ln("man-cbr", "motion", "cb-r", [], pt(47.5, 0.5), "straight"),
    ln("man-nb", "motion", "nb", [], pt(13, -0.5), "straight"),
    ln("man-ss", "motion", "ss", [], pt(40, -0.5), "straight"),
    ln("man-mlb", "motion", "mlb", [pt(27.5, 2.5), pt(27.5, -2.5)], pt(29, -3.5), "straight"),
    ln("rat-wlb", "motion", "wlb", [], pt(27.5, 3.5), "straight"),
    ln("free-fs", "motion", "fs", [], pt(26.5, 13), "straight"),
  ],
);

const COVER_2 = play(
  "play-cover-2",
  "Cover 2",
  "defense",
  "coverage",
  "Nickel",
  "Two-deep, five-under zone. Two safeties split the deep halves, and the CBs sit in the flats.",
  [...nickel({ cornerDepth: 5, fs: pt(15, 11), ss: pt(38, 11) }), ...shotgunSpread()],
  [
    ln("half-fs", "motion", "fs", [], pt(13, 14), "straight"),
    ln("half-ss", "motion", "ss", [], pt(40, 14), "straight"),
    ln("flat-cbl", "motion", "cb-l", [], pt(9.5, 4), "straight"),
    ln("flat-cbr", "motion", "cb-r", [], pt(43.5, 4), "straight"),
    ln("hook-mlb", "motion", "mlb", [], pt(21.5, 10), "straight"),
    ln("hook-wlb", "motion", "wlb", [], pt(32.5, 10), "straight"),
    ln("curl-nb", "motion", "nb", [], pt(16, 9), "straight"),
  ],
);

const COVER_3 = play(
  "play-cover-3",
  "Cover 3",
  "defense",
  "coverage",
  "Nickel",
  "Three-deep, four-under. The single-high zone that is today's baseline.",
  [...nickel(COVER_3_SHELL), ...shotgunSpread()],
  [
    ln("deep-cbl", "motion", "cb-l", [], pt(7, 13), "straight"),
    ln("deep-cbr", "motion", "cb-r", [], pt(46, 13), "straight"),
    ln("deep-fs", "motion", "fs", [], pt(26.5, 14), "straight"),
    ln("curl-nb", "motion", "nb", [], pt(15.5, 9), "straight"),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 10), "straight"),
    ln("hook-wlb", "motion", "wlb", [], pt(31, 10), "straight"),
    ln("flat-ss", "motion", "ss", [], pt(39, 4), "straight"),
  ],
);

const COVER_4 = play(
  "play-cover-4",
  "Cover 4 (Quarters)",
  "defense",
  "coverage",
  "Nickel",
  "Four-deep quarters, stamping out vertical passes from above.",
  [...nickel({ cornerDepth: 7, fs: pt(20, 11), ss: pt(33, 11) }), ...shotgunSpread()],
  [
    ln("qtr-cbl", "motion", "cb-l", [], pt(6, 13), "straight"),
    ln("qtr-cbr", "motion", "cb-r", [], pt(47, 13), "straight"),
    ln("qtr-fs", "motion", "fs", [], pt(18, 14), "straight"),
    ln("qtr-ss", "motion", "ss", [], pt(35, 14), "straight"),
    ln("under-nb", "motion", "nb", [], pt(16, 8), "straight"),
    ln("under-mlb", "motion", "mlb", [], pt(23, 9), "straight"),
    ln("under-wlb", "motion", "wlb", [], pt(31, 9), "straight"),
  ],
);

const FIRE_ZONE = play(
  "play-fire-zone",
  "Fire Zone",
  "defense",
  "pressure",
  "Nickel",
  "A five-man blitz with one lineman dropping, covered by three-deep, three-under.",
  [...nickel(COVER_3_SHELL), ...shotgunSpread()],
  [
    ln("rush-dtl", "route", "dt-l", [], pt(25, 0), "straight"),
    ln("rush-dtr", "route", "dt-r", [], pt(28.5, 0), "straight"),
    ln("rush-der", "route", "de-r", [], pt(33, 0), "straight"),
    ln("blz-wlb", "route", "wlb", [pt(31.5, 2.5)], pt(31, 0), "bezier"),
    ln("blz-nb", "route", "nb", [pt(17, 2.5)], pt(20, 0), "bezier"),
    ln("drop-del", "motion", "de-l", [pt(19, 4)], pt(17, 7), "straight"),
    ln("deep-cbl", "motion", "cb-l", [], pt(7, 13), "straight"),
    ln("deep-cbr", "motion", "cb-r", [], pt(46, 13), "straight"),
    ln("deep-fs", "motion", "fs", [], pt(26.5, 14), "straight"),
    ln("hook-mlb", "motion", "mlb", [], pt(23, 9), "straight"),
    ln("flat-ss", "motion", "ss", [], pt(39, 4), "straight"),
  ],
);

const COVER_0 = play(
  "play-cover-0",
  "Cover 0 Blitz",
  "defense",
  "pressure",
  "Nickel",
  "All-out man with no safety deep, six rushers for maximum pressure. The FS takes the RB in man.",
  [...nickel({ cornerDepth: 5, fs: pt(22, 9), ss: pt(31, 9) }), ...shotgunSpread()],
  [
    ln("rush-del", "route", "de-l", [], pt(20, 0), "straight"),
    ln("rush-dtl", "route", "dt-l", [], pt(25, 0), "straight"),
    ln("rush-dtr", "route", "dt-r", [], pt(30.5, 0), "straight"),
    ln("rush-der", "route", "de-r", [], pt(33, 0), "straight"),
    ln("blz-mlb", "route", "mlb", [pt(27, 2.5)], pt(27.5, 0), "bezier"),
    ln("blz-wlb", "route", "wlb", [pt(31.5, 2.5)], pt(31, 0), "bezier"),
    ln("man-cbl", "motion", "cb-l", [], pt(5.5, 0.5), "straight"),
    ln("man-cbr", "motion", "cb-r", [], pt(47.5, 0.5), "straight"),
    ln("man-nb", "motion", "nb", [], pt(13, -0.5), "straight"),
    ln("man-fs", "motion", "fs", [pt(22, 2.5), pt(23, -2.5)], pt(28, -4), "straight"),
    ln("man-ss", "motion", "ss", [pt(37, 4)], pt(39.5, -0.5), "straight"),
  ],
);

// 両 A ギャップに LB を立てるので、DT は 2 人とも 3 テクに広がる。
const DOUBLE_A = play(
  "play-double-a",
  "Double-A Gap",
  "defense",
  "pressure",
  "Nickel",
  "Two defenders shown in both A gaps. It can turn into a real pressure or a simulated one.",
  [
    player("de-l", "E", FRONT_4.eL),
    player("dt-l", "T", pt(23, 1.5)),
    player("dt-r", "T", FRONT_4.t),
    player("de-r", "E", FRONT_4.eR),
    player("mlb", "M", pt(25.5, 3)),
    player("wlb", "W", pt(27.5, 3)),
    player("nb", "NB", LB_NICKEL.nb),
    player("cb-l", "CB", cornerSpots(7).left),
    player("cb-r", "CB", cornerSpots(7).right),
    player("fs", "FS", COVER_3_SHELL.fs),
    player("ss", "SS", COVER_3_SHELL.ss),
    ...shotgunSpread(),
  ],
  [
    ln("aim-mlb", "route", "mlb", [], pt(25.5, 0.5), "straight"),
    ln("aim-wlb", "route", "wlb", [], pt(27.5, 0.5), "straight"),
    ln("rush-del", "route", "de-l", [], pt(20, 0), "straight"),
    ln("rush-dtl", "route", "dt-l", [], pt(22.5, 0), "straight"),
    ln("rush-dtr", "route", "dt-r", [], pt(30.5, 0), "straight"),
    ln("rush-der", "route", "de-r", [], pt(33, 0), "straight"),
    ln("bail-cbl", "motion", "cb-l", [], pt(7, 12), "straight"),
    ln("bail-cbr", "motion", "cb-r", [], pt(46, 12), "straight"),
    ln("deep-fs", "motion", "fs", [], pt(26.5, 14), "straight"),
    ln("curl-nb", "motion", "nb", [], pt(15.5, 9), "straight"),
    ln("flat-ss", "motion", "ss", [], pt(39, 4), "straight"),
  ],
);

// フィールド側（右）はクォーターズ、バウンダリ側（左）はカバー 2 なので、CB の深さが左右で違い、
// ニッケルバックはフィールド側のスロットに付く。
const COVER_6 = play(
  "play-cover-6",
  "Cover 6",
  "defense",
  "coverage",
  "Nickel",
  "Split coverage: two quarters plus a half. Quarters to the field, Cover 2 to the boundary.",
  [
    ...nickelFront(),
    player("nb", "NB", pt(39, 5)),
    player("cb-l", "CB", cornerSpots(5).left),
    player("cb-r", "CB", cornerSpots(7).right),
    player("fs", "FS", pt(15, 11)),
    player("ss", "SS", pt(35, 10)),
    ...shotgunSpread(),
  ],
  [
    ln("flat-cbl", "motion", "cb-l", [], pt(10, 4), "straight"),
    ln("half-fs", "motion", "fs", [], pt(12, 14), "straight"),
    ln("qtr-cbr", "motion", "cb-r", [], pt(47, 13), "straight"),
    ln("qtr-ss", "motion", "ss", [], pt(38, 14), "straight"),
    ln("curl-nb", "motion", "nb", [], pt(41, 9), "straight"),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 10), "straight"),
    ln("hook-wlb", "motion", "wlb", [], pt(31, 10), "straight"),
  ],
);

export const PLAY_PRESETS: readonly PlayPreset[] = /* @__PURE__ */ deepFreeze([
  INSIDE_ZONE,
  OUTSIDE_ZONE,
  POWER,
  COUNTER,
  FOUR_VERTICALS,
  MESH,
  SMASH,
  STICK,
  RPO_BUBBLE,
  PA_BOOT,
  COVER_1,
  COVER_2,
  COVER_3,
  COVER_4,
  FIRE_ZONE,
  COVER_0,
  DOUBLE_A,
  COVER_6,
]);

export function getPlayPreset(id: string): PlayPreset | undefined {
  return PLAY_PRESETS.find((p) => p.id === id);
}
