// 組み込み済みプリセットプレー図（攻 9・守 7）。現代アメフト（NFL/カレッジ）の代表的な
// ラン/パス/RPO/カバレッジ/プレッシャー概念を 1 枚ずつ収める。DOM 非依存のデータ。
// 縦は LOS からの位置（LOS = 0、攻撃方向が正）、横はセンター lat≈26.7 で置き、middle ゾーンの窓
// （LOS の前後 15 ヤード）に収まる。主役側のみがルート/ブロック/モーションを持ち、相手側は配置マーカーだけ。

import type { Line, LineInterpolation, LineKind } from "../model/line.js";
import { CURRENT_PLAY_DATA_VERSION, fieldStateForZone } from "../model/play-data.js";
import type { FieldPosition, Player, PlayerShape } from "../model/player.js";
import { DEFENSE_COLOR, deepFreeze, type TeamSide } from "../presets/shared.js";
import type { PlayCategory, PlayPreset } from "./play-preset.js";

function pt(lateralYard: number, downfieldYard: number): FieldPosition {
  return { lateralYard, downfieldYard };
}

/** オフェンス選手（色なし＝テーマ既定）。 */
function oP(id: string, label: string, lat: number, down: number, shape: PlayerShape): Player {
  return { id, position: { lateralYard: lat, downfieldYard: down }, shape, label };
}

/** ディフェンス選手（丸・DEFENSE_COLOR）。 */
function dP(id: string, label: string, lat: number, down: number): Player {
  return {
    id,
    position: { lateralYard: lat, downfieldYard: down },
    shape: "circle",
    label,
    color: DEFENSE_COLOR,
  };
}

/** 線 1 本。色は任意（オフェンス=テーマ既定で省略、ディフェンス=DEFENSE_COLOR）。 */
function ln(
  id: string,
  kind: LineKind,
  startPlayerId: string,
  waypoints: FieldPosition[],
  end: FieldPosition,
  interpolation: LineInterpolation,
  color?: string,
): Line {
  return {
    id,
    kind,
    startPlayerId,
    waypoints,
    end,
    interpolation,
    ...(color === undefined ? {} : { color }),
  };
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

// オフェンスライン 5 人（全プレー共通）。
function ol(): Player[] {
  return [
    oP("lt", "LT", 22.1, -0.5, "square"),
    oP("lg", "LG", 24.4, -0.5, "square"),
    oP("c", "C", 26.7, -0.5, "square"),
    oP("rg", "RG", 29, -0.5, "square"),
    oP("rt", "RT", 31.3, -0.5, "square"),
  ];
}

// ニッケル系（4 ダウン＋ILB 2 枚）の共通前 6 枚。CB・ニッケル・セイフティは呼び出し側で足す
// （カバレッジ/プレッシャーごとに DB の置き方が変わるため、変動分だけを各所で明示する）。
function nickelFront(): Player[] {
  return [
    dP("de-l", "", 21.5, 1),
    dP("dt-l", "", 24.4, 1),
    dP("dt-r", "", 29, 1),
    dP("de-r", "", 31.9, 1),
    dP("mlb", "M", 23.5, 4),
    dP("wlb", "W", 31, 4),
  ];
}

// 相手側（脇役）の配置のみ。線は持たせない。攻のプレー図ではこのフロントを添える。
function defLook43(): Player[] {
  return [
    dP("de-l", "", 21.5, 1),
    dP("dt-l", "", 24.4, 1),
    dP("dt-r", "", 29, 1),
    dP("de-r", "", 31.9, 1),
    dP("wlb", "W", 22, 4),
    dP("mlb", "M", 26.7, 4),
    dP("slb", "S", 31.4, 4),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 24, 9),
    dP("ss", "SS", 30, 8),
  ];
}

function defLookNickel(): Player[] {
  return [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 22, 9.5),
    dP("ss", "SS", 31, 9.5),
  ];
}

function defLookCover2(): Player[] {
  return [
    ...nickelFront(),
    dP("nb", "N", 14, 4),
    dP("cb-l", "", 7, 2.5),
    dP("cb-r", "", 46, 2.5),
    dP("fs", "FS", 18, 10),
    dP("ss", "SS", 35, 10),
  ];
}

function defLookCover3(): Player[] {
  return [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 26.7, 10),
    dP("ss", "SS", 33, 5),
  ];
}

// オフェンスの配置のみ（守のプレー図ではこの 2x2 を脇役として添える）。
function offLook(): Player[] {
  return [
    ...ol(),
    oP("qb", "QB", 26.7, -5, "circle"),
    oP("rb", "RB", 29.5, -5, "circle"),
    oP("x", "X", 5.5, -0.5, "circle"),
    oP("y", "Y", 13, -1, "circle"),
    oP("h", "H", 40, -1, "circle"),
    oP("z", "Z", 47.5, -0.5, "circle"),
  ];
}

const INSIDE_ZONE = play(
  "play-inside-zone",
  "Inside Zone",
  "offense",
  "run-zone",
  "11 pers",
  "ゾーンブロックで内側を一気に。RB はバックサイド A ギャップを読んで切る。",
  [
    ...ol(),
    oP("y", "Y", 33.6, -0.5, "square"),
    oP("qb", "QB", 26.7, -5, "circle"),
    oP("rb", "RB", 24, -5, "circle"),
    oP("x", "X", 6, -0.5, "circle"),
    oP("h", "H", 40, -1.5, "circle"),
    oP("z", "Z", 47, -1, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-lt", "block", "lt", [], pt(22.9, 0.8), "straight"),
    ln("bl-lg", "block", "lg", [], pt(25.2, 0.8), "straight"),
    ln("bl-c", "block", "c", [], pt(27.5, 0.8), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30, 0.8), "straight"),
    ln("bl-rt", "block", "rt", [], pt(32.2, 0.8), "straight"),
    ln("bl-y", "block", "y", [], pt(35, 0.8), "straight"),
    ln("run-rb", "route", "rb", [pt(26.5, -1.5)], pt(28.5, 3), "bezier"),
  ],
);

const OUTSIDE_ZONE = play(
  "play-outside-zone",
  "Outside Zone",
  "offense",
  "run-zone",
  "11 pers",
  "ワイドゾーンで横へ伸ばし、エッジを攻めて縦に切り返す。",
  [
    ...ol(),
    oP("y", "Y", 33.6, -0.5, "square"),
    oP("qb", "QB", 26.7, -2.5, "circle"),
    oP("rb", "RB", 26.7, -6.5, "circle"),
    oP("x", "X", 6, -0.5, "circle"),
    oP("h", "H", 40, -1.5, "circle"),
    oP("z", "Z", 47, -1, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-lt", "block", "lt", [], pt(23.5, 0.6), "straight"),
    ln("bl-lg", "block", "lg", [], pt(26, 0.6), "straight"),
    ln("bl-c", "block", "c", [], pt(28, 0.6), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30.5, 0.6), "straight"),
    ln("bl-rt", "block", "rt", [], pt(33, 0.7), "straight"),
    ln("bl-y", "block", "y", [], pt(35.5, 0.6), "straight"),
    ln("run-rb", "route", "rb", [pt(31, -4.5), pt(34, -1.5)], pt(35.5, 3), "bezier"),
  ],
);

const POWER = play(
  "play-power",
  "Power",
  "offense",
  "run-gap",
  "21 pers",
  "プレイサイドはダウンブロック、バックサイドガードがプルしてリードする。",
  [
    ...ol(),
    oP("y", "Y", 33.6, -0.5, "square"),
    oP("qb", "QB", 26.7, -2.5, "circle"),
    oP("fb", "FB", 26.7, -5, "circle"),
    oP("rb", "RB", 26.7, -7.5, "circle"),
    oP("x", "X", 6.5, -0.5, "circle"),
    oP("z", "Z", 46.5, -1, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-rg", "block", "rg", [], pt(30.5, 0.6), "straight"),
    ln("bl-rt", "block", "rt", [], pt(33, 0.6), "straight"),
    ln("bl-y", "block", "y", [], pt(35.5, 0.6), "straight"),
    ln("bl-c", "block", "c", [], pt(25.5, 0.5), "straight"),
    ln("bl-lt", "block", "lt", [], pt(21.5, 0), "straight"),
    ln("pull-lg", "block", "lg", [pt(27, -1.5)], pt(33, 1.5), "bezier"),
    ln("lead-fb", "block", "fb", [], pt(34, 0.5), "straight"),
    ln("run-rb", "route", "rb", [pt(29, -5)], pt(33.5, 1), "bezier"),
  ],
);

const COUNTER = play(
  "play-counter",
  "Counter (GT)",
  "offense",
  "run-gap",
  "21 pers",
  "バックサイドのガードとタックルがプルし、逆方向へ折り返す（GT カウンター）。",
  [
    ...ol(),
    oP("y", "Y", 33.6, -0.5, "square"),
    oP("qb", "QB", 26.7, -2.5, "circle"),
    oP("fb", "FB", 26.7, -5, "circle"),
    oP("rb", "RB", 26.7, -7.5, "circle"),
    oP("x", "X", 6.5, -0.5, "circle"),
    oP("z", "Z", 46.5, -1, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-c", "block", "c", [], pt(28, 0.6), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30.5, 0.6), "straight"),
    ln("bl-rt", "block", "rt", [], pt(33, 0.6), "straight"),
    ln("bl-y", "block", "y", [], pt(35.5, 0.6), "straight"),
    ln("pull-lg", "block", "lg", [pt(28, -1)], pt(34.5, 0.8), "bezier"),
    ln("pull-lt", "block", "lt", [pt(27, -1.5)], pt(33, 2.5), "bezier"),
    ln("fill-fb", "block", "fb", [], pt(24, -0.5), "straight"),
    ln("run-rb", "route", "rb", [pt(24, -6.5), pt(29, -4)], pt(34, 1), "bezier"),
  ],
);

const FOUR_VERTICALS = play(
  "play-four-verticals",
  "Four Verticals",
  "offense",
  "pass-deep",
  "10 pers",
  "トリップスから 4 本の縦。対シングルハイのシームで勝負する。",
  [
    ...ol(),
    oP("qb", "QB", 26.7, -5, "circle"),
    oP("rb", "RB", 24, -5, "circle"),
    oP("x", "X", 5.5, -0.5, "circle"),
    oP("y", "Y", 34.5, -1, "square"),
    oP("h", "H", 41, -1.5, "circle"),
    oP("z", "Z", 47.5, -1, "circle"),
    ...defLookCover3(),
  ],
  [
    ln("go-x", "route", "x", [], pt(6, 13), "straight"),
    ln("seam-y", "route", "y", [pt(33, 5)], pt(31, 13), "bezier"),
    ln("seam-h", "route", "h", [pt(40, 5)], pt(38, 13), "bezier"),
    ln("go-z", "route", "z", [], pt(47.5, 13), "straight"),
    ln("chk-rb", "route", "rb", [], pt(20, -3), "straight"),
  ],
);

const MESH = play(
  "play-mesh",
  "Mesh",
  "offense",
  "pass-dropback",
  "10 pers",
  "浅いクロスの交差。対マン/ゾーン両対応で空いた所へ運ぶ。",
  [
    ...ol(),
    oP("qb", "QB", 26.7, -5, "circle"),
    oP("rb", "RB", 29.5, -5, "circle"),
    oP("x", "X", 5.5, -0.5, "circle"),
    oP("y", "Y", 13, -1, "circle"),
    oP("h", "H", 40, -1, "circle"),
    oP("z", "Z", 47.5, -0.5, "circle"),
    ...defLookNickel(),
  ],
  [
    ln("cross-y", "route", "y", [pt(20, 1.5)], pt(38, 2), "bezier"),
    ln("cross-h", "route", "h", [pt(33, 1)], pt(15, 2), "bezier"),
    ln("corner-x", "route", "x", [pt(5, 5)], pt(2, 9), "bezier"),
    ln("sit-z", "route", "z", [], pt(47, 5), "straight"),
    ln("swing-rb", "route", "rb", [pt(33, -4)], pt(41, -2), "bezier"),
  ],
);

const SMASH = play(
  "play-smash",
  "Smash",
  "offense",
  "pass-dropback",
  "11 pers",
  "コーナー＋ヒッチのハイロー。対カバー 2 のコーナーを攻める。",
  [
    ...ol(),
    oP("y", "Y", 33.6, -0.5, "square"),
    oP("qb", "QB", 26.7, -2.5, "circle"),
    oP("rb", "RB", 26.7, -6.5, "circle"),
    oP("x", "X", 6, -0.5, "circle"),
    oP("h", "H", 40, -1.5, "circle"),
    oP("z", "Z", 47, -1, "circle"),
    ...defLookCover2(),
  ],
  [
    ln("hitch-z", "route", "z", [], pt(47, 3), "straight"),
    ln("corner-h", "route", "h", [pt(41, 4)], pt(46, 10), "bezier"),
    ln("dig-y", "route", "y", [pt(31, 3)], pt(27, 7), "bezier"),
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
  "3 ステップの速攻。スティック（座り）＋フラットで素早く配球する。",
  [
    ...ol(),
    oP("y", "Y", 33.6, -0.5, "square"),
    oP("qb", "QB", 26.7, -2.5, "circle"),
    oP("rb", "RB", 26.7, -6.5, "circle"),
    oP("x", "X", 6, -0.5, "circle"),
    oP("h", "H", 40, -1.5, "circle"),
    oP("z", "Z", 47, -1, "circle"),
    ...defLookNickel(),
  ],
  [
    ln("stick-y", "route", "y", [], pt(33, 3.5), "straight"),
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
  "ボックスの人数を読み、インサイドゾーンかバブルへ分岐する。",
  [
    ...ol(),
    oP("qb", "QB", 26.7, -5, "circle"),
    oP("rb", "RB", 29.5, -5, "circle"),
    oP("x", "X", 5.5, -0.5, "circle"),
    oP("y", "Y", 13, -1, "circle"),
    oP("h", "H", 40, -1, "circle"),
    oP("z", "Z", 47.5, -0.5, "circle"),
    ...defLookNickel(),
  ],
  [
    ln("bl-lt", "block", "lt", [], pt(22.9, 0.8), "straight"),
    ln("bl-lg", "block", "lg", [], pt(25.2, 0.8), "straight"),
    ln("bl-c", "block", "c", [], pt(27.5, 0.8), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30, 0.8), "straight"),
    ln("bl-rt", "block", "rt", [], pt(32.2, 0.8), "straight"),
    ln("run-rb", "route", "rb", [pt(27, -2)], pt(26, 2.5), "bezier"),
    ln("bubble-h", "route", "h", [pt(43, -2)], pt(46, 0.5), "bezier"),
    ln("bl-z", "block", "z", [], pt(45, 2), "straight"),
    ln("glance-y", "route", "y", [pt(15, 1.5)], pt(19, 3), "bezier"),
  ],
);

const PA_BOOT = play(
  "play-pa-boot",
  "PA Boot (Sail)",
  "offense",
  "pa",
  "11 pers",
  "プレイアクションで QB がブートし、フラット/セイル/縦の 3 段で攻める。",
  [
    ...ol(),
    oP("y", "Y", 33.6, -0.5, "square"),
    oP("qb", "QB", 26.7, -2.5, "circle"),
    oP("rb", "RB", 26.7, -6.5, "circle"),
    oP("x", "X", 6, -0.5, "circle"),
    oP("h", "H", 40, -1.5, "circle"),
    oP("z", "Z", 47, -1, "circle"),
    ...defLook43(),
  ],
  [
    ln("fake-rb", "motion", "rb", [pt(24, -5.5)], pt(20, -4), "straight"),
    ln("boot-qb", "route", "qb", [pt(31, -2.5)], pt(36.5, -4), "bezier"),
    ln("bl-c", "block", "c", [], pt(27.5, 0.5), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30, 0.5), "straight"),
    ln("flat-y", "route", "y", [pt(37, -0.5)], pt(43, 0.5), "bezier"),
    ln("sail-h", "route", "h", [pt(41, 3)], pt(47, 6), "bezier"),
    ln("go-z", "route", "z", [], pt(47.5, 12), "straight"),
    ln("comeback-x", "route", "x", [pt(6, 8)], pt(9, 6), "bezier"),
  ],
);

const COVER_1 = play(
  "play-cover-1",
  "Cover 1 (Man Free)",
  "defense",
  "coverage",
  "Nickel",
  "1 ディープのフリーセイフティを残し、残りは全マン。",
  [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 26.7, 11),
    dP("ss", "SS", 33, 5),
    ...offLook(),
  ],
  [
    ln("man-cbl", "motion", "cb-l", [], pt(5.5, 0.5), "straight", DEFENSE_COLOR),
    ln("man-cbr", "motion", "cb-r", [], pt(47.5, 0.5), "straight", DEFENSE_COLOR),
    ln("man-nb", "motion", "nb", [], pt(13, 0), "straight", DEFENSE_COLOR),
    ln("man-ss", "motion", "ss", [pt(36, 2)], pt(40, 0), "straight", DEFENSE_COLOR),
    ln("man-mlb", "motion", "mlb", [], pt(26.5, -3), "straight", DEFENSE_COLOR),
    ln("free-fs", "motion", "fs", [], pt(26.7, 13), "straight", DEFENSE_COLOR),
  ],
);

const COVER_2 = play(
  "play-cover-2",
  "Cover 2",
  "defense",
  "coverage",
  "Nickel",
  "2 ディープ 5 アンダーのゾーン。深いハーフを 2 人で分ける。",
  [
    ...nickelFront(),
    dP("nb", "N", 14, 4),
    dP("cb-l", "", 7, 2.5),
    dP("cb-r", "", 46, 2.5),
    dP("fs", "FS", 15, 10),
    dP("ss", "SS", 38, 10),
    ...offLook(),
  ],
  [
    ln("half-fs", "motion", "fs", [], pt(13, 12), "straight", DEFENSE_COLOR),
    ln("half-ss", "motion", "ss", [], pt(40, 12), "straight", DEFENSE_COLOR),
    ln("flat-cbl", "motion", "cb-l", [], pt(10, 2), "straight", DEFENSE_COLOR),
    ln("flat-cbr", "motion", "cb-r", [], pt(43, 2), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 2), "straight", DEFENSE_COLOR),
    ln("hook-wlb", "motion", "wlb", [], pt(33, 2), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(16, 3), "straight", DEFENSE_COLOR),
  ],
);

const COVER_3 = play(
  "play-cover-3",
  "Cover 3",
  "defense",
  "coverage",
  "Nickel",
  "3 ディープ 4 アンダー。現代の基準となるシングルハイのゾーン。",
  [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 26.7, 10),
    dP("ss", "SS", 34, 5),
    ...offLook(),
  ],
  [
    ln("deep-cbl", "motion", "cb-l", [pt(7, 7)], pt(7, 12), "straight", DEFENSE_COLOR),
    ln("deep-cbr", "motion", "cb-r", [], pt(46, 12), "straight", DEFENSE_COLOR),
    ln("deep-fs", "motion", "fs", [], pt(26.7, 13), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(15, 3), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 2), "straight", DEFENSE_COLOR),
    ln("hook-wlb", "motion", "wlb", [], pt(33, 2), "straight", DEFENSE_COLOR),
    ln("flat-ss", "motion", "ss", [], pt(38, 3), "straight", DEFENSE_COLOR),
  ],
);

const COVER_4 = play(
  "play-cover-4",
  "Cover 4 (Quarters)",
  "defense",
  "coverage",
  "Nickel",
  "4 ディープのクォーターズ。縦パスを上から踏み潰す。",
  [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 20, 9.5),
    dP("ss", "SS", 33, 9.5),
    ...offLook(),
  ],
  [
    ln("qtr-cbl", "motion", "cb-l", [], pt(6, 12), "straight", DEFENSE_COLOR),
    ln("qtr-cbr", "motion", "cb-r", [], pt(47, 12), "straight", DEFENSE_COLOR),
    ln("qtr-fs", "motion", "fs", [], pt(18, 12), "straight", DEFENSE_COLOR),
    ln("qtr-ss", "motion", "ss", [], pt(35, 12), "straight", DEFENSE_COLOR),
    ln("under-nb", "motion", "nb", [], pt(15, 2), "straight", DEFENSE_COLOR),
    ln("under-mlb", "motion", "mlb", [], pt(24, 2), "straight", DEFENSE_COLOR),
    ln("under-wlb", "motion", "wlb", [], pt(31, 2), "straight", DEFENSE_COLOR),
  ],
);

const FIRE_ZONE = play(
  "play-fire-zone",
  "Fire Zone",
  "defense",
  "pressure",
  "Nickel",
  "5 人ブリッツ＋ライン 1 枚をドロップ、3 ディープ 3 アンダーで覆う。",
  [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 26.7, 10),
    dP("ss", "SS", 34, 5),
    ...offLook(),
  ],
  [
    ln("rush-dtl", "route", "dt-l", [], pt(24, -1), "straight", DEFENSE_COLOR),
    ln("rush-dtr", "route", "dt-r", [], pt(29.5, -1), "straight", DEFENSE_COLOR),
    ln("rush-der", "route", "de-r", [], pt(32.5, -1), "straight", DEFENSE_COLOR),
    ln("blz-wlb", "route", "wlb", [pt(30, 2)], pt(29, -0.5), "bezier", DEFENSE_COLOR),
    ln("blz-nb", "route", "nb", [pt(16, 2)], pt(20, -0.5), "bezier", DEFENSE_COLOR),
    ln("drop-del", "motion", "de-l", [pt(20, 3)], pt(18, 5), "straight", DEFENSE_COLOR),
    ln("deep-cbl", "motion", "cb-l", [], pt(7, 11), "straight", DEFENSE_COLOR),
    ln("deep-cbr", "motion", "cb-r", [], pt(46, 11), "straight", DEFENSE_COLOR),
    ln("deep-fs", "motion", "fs", [], pt(26.7, 13), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(24, 2), "straight", DEFENSE_COLOR),
    ln("flat-ss", "motion", "ss", [], pt(37, 3), "straight", DEFENSE_COLOR),
  ],
);

const COVER_0 = play(
  "play-cover-0",
  "Cover 0 Blitz",
  "defense",
  "pressure",
  "Nickel",
  "セイフティを残さず全マン、6 人で最大限の圧力をかける。",
  [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 2.5),
    dP("cb-r", "", 46, 2.5),
    dP("fs", "FS", 22, 9.5),
    dP("ss", "SS", 31, 9.5),
    ...offLook(),
  ],
  [
    ln("rush-del", "route", "de-l", [], pt(21, -1), "straight", DEFENSE_COLOR),
    ln("rush-dtl", "route", "dt-l", [], pt(24, -1), "straight", DEFENSE_COLOR),
    ln("rush-dtr", "route", "dt-r", [], pt(29.5, -1), "straight", DEFENSE_COLOR),
    ln("rush-der", "route", "de-r", [], pt(32.5, -1), "straight", DEFENSE_COLOR),
    ln("blz-mlb", "route", "mlb", [pt(25, 1)], pt(26.5, -1), "bezier", DEFENSE_COLOR),
    ln("blz-wlb", "route", "wlb", [pt(28, 2)], pt(28.5, -0.5), "bezier", DEFENSE_COLOR),
    ln("man-cbl", "motion", "cb-l", [], pt(5.5, 0.5), "straight", DEFENSE_COLOR),
    ln("man-cbr", "motion", "cb-r", [], pt(47.5, 0.5), "straight", DEFENSE_COLOR),
    ln("man-nb", "motion", "nb", [], pt(13, 0), "straight", DEFENSE_COLOR),
    ln("man-fs", "motion", "fs", [pt(26, 4)], pt(29, -2), "straight", DEFENSE_COLOR),
    ln("man-ss", "motion", "ss", [], pt(40, 0), "straight", DEFENSE_COLOR),
  ],
);

const DOUBLE_A = play(
  "play-double-a",
  "Double-A Gap",
  "defense",
  "pressure",
  "Nickel",
  "両 A ギャップに 2 人を提示。実行・シム（見せ）どちらにも化ける。",
  [
    ...nickelFront(),
    dP("nb", "N", 14, 4.5),
    dP("cb-l", "", 7, 3),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 26.7, 10),
    dP("ss", "SS", 34, 5),
    ...offLook(),
  ],
  [
    ln("aim-mlb", "route", "mlb", [pt(25, 2)], pt(25.8, -0.5), "bezier", DEFENSE_COLOR),
    ln("aim-wlb", "route", "wlb", [pt(28, 2)], pt(27.6, -0.5), "bezier", DEFENSE_COLOR),
    ln("rush-del", "route", "de-l", [], pt(21, -1), "straight", DEFENSE_COLOR),
    ln("rush-dtl", "route", "dt-l", [], pt(24, -1), "straight", DEFENSE_COLOR),
    ln("rush-dtr", "route", "dt-r", [], pt(29.5, -1), "straight", DEFENSE_COLOR),
    ln("rush-der", "route", "de-r", [], pt(32.5, -1), "straight", DEFENSE_COLOR),
    ln("bail-cbl", "motion", "cb-l", [], pt(7, 10), "straight", DEFENSE_COLOR),
    ln("bail-cbr", "motion", "cb-r", [], pt(46, 10), "straight", DEFENSE_COLOR),
    ln("deep-fs", "motion", "fs", [], pt(26.7, 12), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(16, 3), "straight", DEFENSE_COLOR),
    ln("flat-ss", "motion", "ss", [], pt(37, 3), "straight", DEFENSE_COLOR),
  ],
);

const COVER_6 = play(
  "play-cover-6",
  "Cover 6",
  "defense",
  "coverage",
  "Nickel",
  "クォーター×2＋ハーフの分割カバー。フィールドはクォーターズ、バウンダリは 2。",
  [
    ...nickelFront(),
    dP("nb", "N", 39, 4),
    dP("cb-l", "", 7, 2.5),
    dP("cb-r", "", 46, 3),
    dP("fs", "FS", 15, 9.5),
    dP("ss", "SS", 35, 5),
    ...offLook(),
  ],
  [
    ln("flat-cbl", "motion", "cb-l", [], pt(11, 2), "straight", DEFENSE_COLOR),
    ln("half-fs", "motion", "fs", [], pt(12, 12), "straight", DEFENSE_COLOR),
    ln("qtr-cbr", "motion", "cb-r", [], pt(47, 12), "straight", DEFENSE_COLOR),
    ln("qtr-ss", "motion", "ss", [], pt(38, 12), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(42, 3), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 2), "straight", DEFENSE_COLOR),
    ln("hook-wlb", "motion", "wlb", [], pt(33, 2), "straight", DEFENSE_COLOR),
  ],
);

/**
 * 組み込みプレー図一覧（攻 10・守 8）。demo はこれを攻守・タイプで束ねて一覧表示し、
 * 商用ソフトはこの配列を起点に独自プレーを足せる。
 */
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

/** id でプレー図プリセットを引く。未知 id は undefined（呼び出し側で無視する）。 */
export function getPlayPreset(id: string): PlayPreset | undefined {
  return PLAY_PRESETS.find((p) => p.id === id);
}
