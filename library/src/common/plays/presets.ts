// 組み込み済みプリセットプレー図（攻 9・守 7）。現代アメフト（NFL/カレッジ）の代表的な
// ラン/パス/RPO/カバレッジ/プレッシャー概念を 1 枚ずつ収める。DOM 非依存のデータ。
// 座標はヤード空間（LOS≈50・ダウンフィールド=abs 増加・センター lat≈26.7）で middle ゾーン窓
// (abs 35..65) に収まる。主役側のみがルート/ブロック/モーションを持ち、相手側は配置マーカーだけ。

import type { FormationSide } from "../formations/formation.js";
import { DEFENSE_COLOR } from "../formations/presets.js";
import type { Line, LineInterpolation, LineKind } from "../model/line.js";
import { CURRENT_PLAY_DATA_VERSION } from "../model/play-data.js";
import type { FieldPosition, Player, PlayerShape } from "../model/player.js";
import type { PlayCategory, PlayPreset } from "./play-preset.js";

function pt(lateralYard: number, absoluteYard: number): FieldPosition {
  return { lateralYard, absoluteYard };
}

/** オフェンス選手（色なし＝テーマ既定）。 */
function oP(id: string, label: string, lat: number, abs: number, shape: PlayerShape): Player {
  return { id, position: { lateralYard: lat, absoluteYard: abs }, shape, label };
}

/** ディフェンス選手（丸・DEFENSE_COLOR）。 */
function dP(id: string, label: string, lat: number, abs: number): Player {
  return {
    id,
    position: { lateralYard: lat, absoluteYard: abs },
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
  const line: Line = { id, kind, startPlayerId, waypoints, end, interpolation };
  if (color !== undefined) {
    line.color = color;
  }
  return line;
}

function play(
  id: string,
  name: string,
  side: FormationSide,
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
    data: { version: CURRENT_PLAY_DATA_VERSION, field: { zone: "middle" }, players, lines },
  };
}

// オフェンスライン 5 人（全プレー共通）。
function ol(): Player[] {
  return [
    oP("lt", "LT", 22.1, 49.5, "square"),
    oP("lg", "LG", 24.4, 49.5, "square"),
    oP("c", "C", 26.7, 49.5, "square"),
    oP("rg", "RG", 29, 49.5, "square"),
    oP("rt", "RT", 31.3, 49.5, "square"),
  ];
}

// ニッケル系（4 ダウン＋ILB 2 枚）の共通前 6 枚。CB・ニッケル・セイフティは呼び出し側で足す
// （カバレッジ/プレッシャーごとに DB の置き方が変わるため、変動分だけを各所で明示する）。
function nickelFront(): Player[] {
  return [
    dP("de-l", "", 21.5, 51),
    dP("dt-l", "", 24.4, 51),
    dP("dt-r", "", 29, 51),
    dP("de-r", "", 31.9, 51),
    dP("mlb", "M", 23.5, 54),
    dP("wlb", "W", 31, 54),
  ];
}

// 相手側（脇役）の配置のみ。線は持たせない。攻のプレー図ではこのフロントを添える。
function defLook43(): Player[] {
  return [
    dP("de-l", "", 21.5, 51),
    dP("dt-l", "", 24.4, 51),
    dP("dt-r", "", 29, 51),
    dP("de-r", "", 31.9, 51),
    dP("wlb", "W", 22, 54),
    dP("mlb", "M", 26.7, 54),
    dP("slb", "S", 31.4, 54),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 24, 59),
    dP("ss", "SS", 30, 58),
  ];
}

function defLookNickel(): Player[] {
  return [
    ...nickelFront(),
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 22, 59.5),
    dP("ss", "SS", 31, 59.5),
  ];
}

function defLookCover2(): Player[] {
  return [
    ...nickelFront(),
    dP("nb", "N", 14, 54),
    dP("cb-l", "", 7, 52.5),
    dP("cb-r", "", 46, 52.5),
    dP("fs", "FS", 18, 60),
    dP("ss", "SS", 35, 60),
  ];
}

function defLookCover3(): Player[] {
  return [
    ...nickelFront(),
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 26.7, 60),
    dP("ss", "SS", 33, 55),
  ];
}

// オフェンスの配置のみ（守のプレー図ではこの 2x2 を脇役として添える）。
function offLook(): Player[] {
  return [
    ...ol(),
    oP("qb", "QB", 26.7, 45, "circle"),
    oP("rb", "RB", 29.5, 45, "circle"),
    oP("x", "X", 5.5, 49.5, "circle"),
    oP("y", "Y", 13, 49, "circle"),
    oP("h", "H", 40, 49, "circle"),
    oP("z", "Z", 47.5, 49.5, "circle"),
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
    oP("y", "Y", 33.6, 49.5, "square"),
    oP("qb", "QB", 26.7, 45, "circle"),
    oP("rb", "RB", 24, 45, "circle"),
    oP("x", "X", 6, 49.5, "circle"),
    oP("h", "H", 40, 48.5, "circle"),
    oP("z", "Z", 47, 49, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-lt", "block", "lt", [], pt(22.9, 50.8), "straight"),
    ln("bl-lg", "block", "lg", [], pt(25.2, 50.8), "straight"),
    ln("bl-c", "block", "c", [], pt(27.5, 50.8), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30, 50.8), "straight"),
    ln("bl-rt", "block", "rt", [], pt(32.2, 50.8), "straight"),
    ln("bl-y", "block", "y", [], pt(35, 50.8), "straight"),
    ln("run-rb", "route", "rb", [pt(26.5, 48.5)], pt(28.5, 53), "bezier"),
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
    oP("y", "Y", 33.6, 49.5, "square"),
    oP("qb", "QB", 26.7, 47.5, "circle"),
    oP("rb", "RB", 26.7, 43.5, "circle"),
    oP("x", "X", 6, 49.5, "circle"),
    oP("h", "H", 40, 48.5, "circle"),
    oP("z", "Z", 47, 49, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-lt", "block", "lt", [], pt(23.5, 50.6), "straight"),
    ln("bl-lg", "block", "lg", [], pt(26, 50.6), "straight"),
    ln("bl-c", "block", "c", [], pt(28, 50.6), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30.5, 50.6), "straight"),
    ln("bl-rt", "block", "rt", [], pt(33, 50.7), "straight"),
    ln("bl-y", "block", "y", [], pt(35.5, 50.6), "straight"),
    ln("run-rb", "route", "rb", [pt(31, 45.5), pt(34, 48.5)], pt(35.5, 53), "bezier"),
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
    oP("y", "Y", 33.6, 49.5, "square"),
    oP("qb", "QB", 26.7, 47.5, "circle"),
    oP("fb", "FB", 26.7, 45, "circle"),
    oP("rb", "RB", 26.7, 42.5, "circle"),
    oP("x", "X", 6.5, 49.5, "circle"),
    oP("z", "Z", 46.5, 49, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-rg", "block", "rg", [], pt(30.5, 50.6), "straight"),
    ln("bl-rt", "block", "rt", [], pt(33, 50.6), "straight"),
    ln("bl-y", "block", "y", [], pt(35.5, 50.6), "straight"),
    ln("bl-c", "block", "c", [], pt(25.5, 50.5), "straight"),
    ln("bl-lt", "block", "lt", [], pt(21.5, 50), "straight"),
    ln("pull-lg", "block", "lg", [pt(27, 48.5)], pt(33, 51.5), "bezier"),
    ln("lead-fb", "block", "fb", [], pt(34, 50.5), "straight"),
    ln("run-rb", "route", "rb", [pt(29, 45)], pt(33.5, 51), "bezier"),
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
    oP("y", "Y", 33.6, 49.5, "square"),
    oP("qb", "QB", 26.7, 47.5, "circle"),
    oP("fb", "FB", 26.7, 45, "circle"),
    oP("rb", "RB", 26.7, 42.5, "circle"),
    oP("x", "X", 6.5, 49.5, "circle"),
    oP("z", "Z", 46.5, 49, "circle"),
    ...defLook43(),
  ],
  [
    ln("bl-c", "block", "c", [], pt(28, 50.6), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30.5, 50.6), "straight"),
    ln("bl-rt", "block", "rt", [], pt(33, 50.6), "straight"),
    ln("bl-y", "block", "y", [], pt(35.5, 50.6), "straight"),
    ln("pull-lg", "block", "lg", [pt(28, 49)], pt(34.5, 50.8), "bezier"),
    ln("pull-lt", "block", "lt", [pt(27, 48.5)], pt(33, 52.5), "bezier"),
    ln("fill-fb", "block", "fb", [], pt(24, 49.5), "straight"),
    ln("run-rb", "route", "rb", [pt(24, 43.5), pt(29, 46)], pt(34, 51), "bezier"),
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
    oP("qb", "QB", 26.7, 45, "circle"),
    oP("rb", "RB", 24, 45, "circle"),
    oP("x", "X", 5.5, 49.5, "circle"),
    oP("y", "Y", 34.5, 49, "square"),
    oP("h", "H", 41, 48.5, "circle"),
    oP("z", "Z", 47.5, 49, "circle"),
    ...defLookCover3(),
  ],
  [
    ln("go-x", "route", "x", [], pt(6, 63), "straight"),
    ln("seam-y", "route", "y", [pt(33, 55)], pt(31, 63), "bezier"),
    ln("seam-h", "route", "h", [pt(40, 55)], pt(38, 63), "bezier"),
    ln("go-z", "route", "z", [], pt(47.5, 63), "straight"),
    ln("chk-rb", "route", "rb", [], pt(20, 47), "straight"),
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
    oP("qb", "QB", 26.7, 45, "circle"),
    oP("rb", "RB", 29.5, 45, "circle"),
    oP("x", "X", 5.5, 49.5, "circle"),
    oP("y", "Y", 13, 49, "circle"),
    oP("h", "H", 40, 49, "circle"),
    oP("z", "Z", 47.5, 49.5, "circle"),
    ...defLookNickel(),
  ],
  [
    ln("cross-y", "route", "y", [pt(20, 51.5)], pt(38, 52), "bezier"),
    ln("cross-h", "route", "h", [pt(33, 51)], pt(15, 52), "bezier"),
    ln("corner-x", "route", "x", [pt(5, 55)], pt(2, 59), "bezier"),
    ln("sit-z", "route", "z", [], pt(47, 55), "straight"),
    ln("swing-rb", "route", "rb", [pt(33, 46)], pt(41, 48), "bezier"),
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
    oP("y", "Y", 33.6, 49.5, "square"),
    oP("qb", "QB", 26.7, 47.5, "circle"),
    oP("rb", "RB", 26.7, 43.5, "circle"),
    oP("x", "X", 6, 49.5, "circle"),
    oP("h", "H", 40, 48.5, "circle"),
    oP("z", "Z", 47, 49, "circle"),
    ...defLookCover2(),
  ],
  [
    ln("hitch-z", "route", "z", [], pt(47, 53), "straight"),
    ln("corner-h", "route", "h", [pt(41, 54)], pt(46, 60), "bezier"),
    ln("dig-y", "route", "y", [pt(31, 53)], pt(27, 57), "bezier"),
    ln("hitch-x", "route", "x", [], pt(6, 53), "straight"),
    ln("flat-rb", "route", "rb", [], pt(22, 46), "straight"),
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
    oP("y", "Y", 33.6, 49.5, "square"),
    oP("qb", "QB", 26.7, 47.5, "circle"),
    oP("rb", "RB", 26.7, 43.5, "circle"),
    oP("x", "X", 6, 49.5, "circle"),
    oP("h", "H", 40, 48.5, "circle"),
    oP("z", "Z", 47, 49, "circle"),
    ...defLookNickel(),
  ],
  [
    ln("stick-y", "route", "y", [], pt(33, 53.5), "straight"),
    ln("flat-h", "route", "h", [], pt(45, 50), "straight"),
    ln("hitch-z", "route", "z", [], pt(47, 53), "straight"),
    ln("slant-x", "route", "x", [pt(6, 52)], pt(10, 53), "bezier"),
    ln("chk-rb", "route", "rb", [], pt(21, 45), "straight"),
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
    oP("qb", "QB", 26.7, 45, "circle"),
    oP("rb", "RB", 29.5, 45, "circle"),
    oP("x", "X", 5.5, 49.5, "circle"),
    oP("y", "Y", 13, 49, "circle"),
    oP("h", "H", 40, 49, "circle"),
    oP("z", "Z", 47.5, 49.5, "circle"),
    ...defLookNickel(),
  ],
  [
    ln("bl-lt", "block", "lt", [], pt(22.9, 50.8), "straight"),
    ln("bl-lg", "block", "lg", [], pt(25.2, 50.8), "straight"),
    ln("bl-c", "block", "c", [], pt(27.5, 50.8), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30, 50.8), "straight"),
    ln("bl-rt", "block", "rt", [], pt(32.2, 50.8), "straight"),
    ln("run-rb", "route", "rb", [pt(27, 48)], pt(26, 52.5), "bezier"),
    ln("bubble-h", "route", "h", [pt(43, 48)], pt(46, 50.5), "bezier"),
    ln("bl-z", "block", "z", [], pt(45, 52), "straight"),
    ln("glance-y", "route", "y", [pt(15, 51.5)], pt(19, 53), "bezier"),
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
    oP("y", "Y", 33.6, 49.5, "square"),
    oP("qb", "QB", 26.7, 47.5, "circle"),
    oP("rb", "RB", 26.7, 43.5, "circle"),
    oP("x", "X", 6, 49.5, "circle"),
    oP("h", "H", 40, 48.5, "circle"),
    oP("z", "Z", 47, 49, "circle"),
    ...defLook43(),
  ],
  [
    ln("fake-rb", "motion", "rb", [pt(24, 44.5)], pt(20, 46), "straight"),
    ln("boot-qb", "route", "qb", [pt(31, 47.5)], pt(36.5, 46), "bezier"),
    ln("bl-c", "block", "c", [], pt(27.5, 50.5), "straight"),
    ln("bl-rg", "block", "rg", [], pt(30, 50.5), "straight"),
    ln("flat-y", "route", "y", [pt(37, 49.5)], pt(43, 50.5), "bezier"),
    ln("sail-h", "route", "h", [pt(41, 53)], pt(47, 56), "bezier"),
    ln("go-z", "route", "z", [], pt(47.5, 62), "straight"),
    ln("comeback-x", "route", "x", [pt(6, 58)], pt(9, 56), "bezier"),
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
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 26.7, 61),
    dP("ss", "SS", 33, 55),
    ...offLook(),
  ],
  [
    ln("man-cbl", "motion", "cb-l", [], pt(5.5, 50.5), "straight", DEFENSE_COLOR),
    ln("man-cbr", "motion", "cb-r", [], pt(47.5, 50.5), "straight", DEFENSE_COLOR),
    ln("man-nb", "motion", "nb", [], pt(13, 50), "straight", DEFENSE_COLOR),
    ln("man-ss", "motion", "ss", [pt(36, 52)], pt(40, 50), "straight", DEFENSE_COLOR),
    ln("man-mlb", "motion", "mlb", [], pt(26.5, 47), "straight", DEFENSE_COLOR),
    ln("free-fs", "motion", "fs", [], pt(26.7, 63), "straight", DEFENSE_COLOR),
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
    dP("nb", "N", 14, 54),
    dP("cb-l", "", 7, 52.5),
    dP("cb-r", "", 46, 52.5),
    dP("fs", "FS", 15, 60),
    dP("ss", "SS", 38, 60),
    ...offLook(),
  ],
  [
    ln("half-fs", "motion", "fs", [], pt(13, 62), "straight", DEFENSE_COLOR),
    ln("half-ss", "motion", "ss", [], pt(40, 62), "straight", DEFENSE_COLOR),
    ln("flat-cbl", "motion", "cb-l", [], pt(10, 52), "straight", DEFENSE_COLOR),
    ln("flat-cbr", "motion", "cb-r", [], pt(43, 52), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 52), "straight", DEFENSE_COLOR),
    ln("hook-wlb", "motion", "wlb", [], pt(33, 52), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(16, 53), "straight", DEFENSE_COLOR),
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
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 26.7, 60),
    dP("ss", "SS", 34, 55),
    ...offLook(),
  ],
  [
    ln("deep-cbl", "motion", "cb-l", [pt(7, 57)], pt(7, 62), "straight", DEFENSE_COLOR),
    ln("deep-cbr", "motion", "cb-r", [], pt(46, 62), "straight", DEFENSE_COLOR),
    ln("deep-fs", "motion", "fs", [], pt(26.7, 63), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(15, 53), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 52), "straight", DEFENSE_COLOR),
    ln("hook-wlb", "motion", "wlb", [], pt(33, 52), "straight", DEFENSE_COLOR),
    ln("flat-ss", "motion", "ss", [], pt(38, 53), "straight", DEFENSE_COLOR),
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
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 20, 59.5),
    dP("ss", "SS", 33, 59.5),
    ...offLook(),
  ],
  [
    ln("qtr-cbl", "motion", "cb-l", [], pt(6, 62), "straight", DEFENSE_COLOR),
    ln("qtr-cbr", "motion", "cb-r", [], pt(47, 62), "straight", DEFENSE_COLOR),
    ln("qtr-fs", "motion", "fs", [], pt(18, 62), "straight", DEFENSE_COLOR),
    ln("qtr-ss", "motion", "ss", [], pt(35, 62), "straight", DEFENSE_COLOR),
    ln("under-nb", "motion", "nb", [], pt(15, 52), "straight", DEFENSE_COLOR),
    ln("under-mlb", "motion", "mlb", [], pt(24, 52), "straight", DEFENSE_COLOR),
    ln("under-wlb", "motion", "wlb", [], pt(31, 52), "straight", DEFENSE_COLOR),
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
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 26.7, 60),
    dP("ss", "SS", 34, 55),
    ...offLook(),
  ],
  [
    ln("rush-dtl", "route", "dt-l", [], pt(24, 49), "straight", DEFENSE_COLOR),
    ln("rush-dtr", "route", "dt-r", [], pt(29.5, 49), "straight", DEFENSE_COLOR),
    ln("rush-der", "route", "de-r", [], pt(32.5, 49), "straight", DEFENSE_COLOR),
    ln("blz-wlb", "route", "wlb", [pt(30, 52)], pt(29, 49.5), "bezier", DEFENSE_COLOR),
    ln("blz-nb", "route", "nb", [pt(16, 52)], pt(20, 49.5), "bezier", DEFENSE_COLOR),
    ln("drop-del", "motion", "de-l", [pt(20, 53)], pt(18, 55), "straight", DEFENSE_COLOR),
    ln("deep-cbl", "motion", "cb-l", [], pt(7, 61), "straight", DEFENSE_COLOR),
    ln("deep-cbr", "motion", "cb-r", [], pt(46, 61), "straight", DEFENSE_COLOR),
    ln("deep-fs", "motion", "fs", [], pt(26.7, 63), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(24, 52), "straight", DEFENSE_COLOR),
    ln("flat-ss", "motion", "ss", [], pt(37, 53), "straight", DEFENSE_COLOR),
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
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 52.5),
    dP("cb-r", "", 46, 52.5),
    dP("fs", "FS", 22, 59.5),
    dP("ss", "SS", 31, 59.5),
    ...offLook(),
  ],
  [
    ln("rush-del", "route", "de-l", [], pt(21, 49), "straight", DEFENSE_COLOR),
    ln("rush-dtl", "route", "dt-l", [], pt(24, 49), "straight", DEFENSE_COLOR),
    ln("rush-dtr", "route", "dt-r", [], pt(29.5, 49), "straight", DEFENSE_COLOR),
    ln("rush-der", "route", "de-r", [], pt(32.5, 49), "straight", DEFENSE_COLOR),
    ln("blz-mlb", "route", "mlb", [pt(25, 51)], pt(26.5, 49), "bezier", DEFENSE_COLOR),
    ln("blz-wlb", "route", "wlb", [pt(28, 52)], pt(28.5, 49.5), "bezier", DEFENSE_COLOR),
    ln("man-cbl", "motion", "cb-l", [], pt(5.5, 50.5), "straight", DEFENSE_COLOR),
    ln("man-cbr", "motion", "cb-r", [], pt(47.5, 50.5), "straight", DEFENSE_COLOR),
    ln("man-nb", "motion", "nb", [], pt(13, 50), "straight", DEFENSE_COLOR),
    ln("man-fs", "motion", "fs", [pt(26, 54)], pt(29, 48), "straight", DEFENSE_COLOR),
    ln("man-ss", "motion", "ss", [], pt(40, 50), "straight", DEFENSE_COLOR),
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
    dP("nb", "N", 14, 54.5),
    dP("cb-l", "", 7, 53),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 26.7, 60),
    dP("ss", "SS", 34, 55),
    ...offLook(),
  ],
  [
    ln("aim-mlb", "route", "mlb", [pt(25, 52)], pt(25.8, 49.5), "bezier", DEFENSE_COLOR),
    ln("aim-wlb", "route", "wlb", [pt(28, 52)], pt(27.6, 49.5), "bezier", DEFENSE_COLOR),
    ln("rush-del", "route", "de-l", [], pt(21, 49), "straight", DEFENSE_COLOR),
    ln("rush-dtl", "route", "dt-l", [], pt(24, 49), "straight", DEFENSE_COLOR),
    ln("rush-dtr", "route", "dt-r", [], pt(29.5, 49), "straight", DEFENSE_COLOR),
    ln("rush-der", "route", "de-r", [], pt(32.5, 49), "straight", DEFENSE_COLOR),
    ln("bail-cbl", "motion", "cb-l", [], pt(7, 60), "straight", DEFENSE_COLOR),
    ln("bail-cbr", "motion", "cb-r", [], pt(46, 60), "straight", DEFENSE_COLOR),
    ln("deep-fs", "motion", "fs", [], pt(26.7, 62), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(16, 53), "straight", DEFENSE_COLOR),
    ln("flat-ss", "motion", "ss", [], pt(37, 53), "straight", DEFENSE_COLOR),
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
    dP("nb", "N", 39, 54),
    dP("cb-l", "", 7, 52.5),
    dP("cb-r", "", 46, 53),
    dP("fs", "FS", 15, 59.5),
    dP("ss", "SS", 35, 55),
    ...offLook(),
  ],
  [
    ln("flat-cbl", "motion", "cb-l", [], pt(11, 52), "straight", DEFENSE_COLOR),
    ln("half-fs", "motion", "fs", [], pt(12, 62), "straight", DEFENSE_COLOR),
    ln("qtr-cbr", "motion", "cb-r", [], pt(47, 62), "straight", DEFENSE_COLOR),
    ln("qtr-ss", "motion", "ss", [], pt(38, 62), "straight", DEFENSE_COLOR),
    ln("curl-nb", "motion", "nb", [], pt(42, 53), "straight", DEFENSE_COLOR),
    ln("hook-mlb", "motion", "mlb", [], pt(22, 52), "straight", DEFENSE_COLOR),
    ln("hook-wlb", "motion", "wlb", [], pt(33, 52), "straight", DEFENSE_COLOR),
  ],
);

/**
 * 組み込みプレー図一覧（攻 10・守 8）。demo はこれを攻守・タイプで束ねて一覧表示し、
 * 商用ソフトはこの配列を起点に独自プレーを足せる。
 */
export const PLAY_PRESETS: readonly PlayPreset[] = [
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
];

/** id でプレー図プリセットを引く。未知 id は undefined（呼び出し側で無視する）。 */
export function getPlayPreset(id: string): PlayPreset | undefined {
  return PLAY_PRESETS.find((p) => p.id === id);
}
