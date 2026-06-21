// 組み込み済みプリセットフォーメーション（PRD 5.6「オフェンス・ディフェンスの代表的な隊形」）。
// DOM 非依存のデータ。座標はヤード空間（LOS≈50・センター lat≈26.7・ダウンフィールド=abs 増加）で
// middle ゾーン窓 (abs 35..65) に収まるよう置く。名称は現代アメフトの英語表記で統一する
// （フィールド上の表記＝英語というプロダクト方針）。戦術的厳密性より組み込みやすさ優先（PRD 4.1）。

import type { PlayerShape } from "../model/player.js";
import type { Formation, FormationPlayer } from "./formation.js";

/** ディフェンス選手の既定色（攻守を一目で区別できるよう、くすませた赤）。プレー図プリセットでも共有する。 */
export const DEFENSE_COLOR = "#8f4034";

/** オフェンス選手テンプレート（色なし＝テーマ既定）。 */
function off(
  label: string,
  lateralYard: number,
  absoluteYard: number,
  shape: PlayerShape,
): FormationPlayer {
  return { position: { lateralYard, absoluteYard }, shape, label };
}

/** ディフェンス選手テンプレート（DEFENSE_COLOR で塗る）。 */
function def(
  label: string,
  lateralYard: number,
  absoluteYard: number,
  shape: PlayerShape,
): FormationPlayer {
  return { position: { lateralYard, absoluteYard }, shape, label, color: DEFENSE_COLOR };
}

// オフェンスライン（5 人・LOS 上）は全隊形で共通。
const OFFENSIVE_LINE: FormationPlayer[] = [
  off("LT", 22.1, 49.5, "square"),
  off("LG", 24.4, 49.5, "square"),
  off("C", 26.7, 49.5, "square"),
  off("RG", 29, 49.5, "square"),
  off("RT", 31.3, 49.5, "square"),
];

// 4 ダウンの守備ライン（オーバーフロント）。4-3 系・ニッケル・ダイム・4-2-5 で共通。
const FRONT_4: FormationPlayer[] = [
  def("", 21.5, 51, "circle"),
  def("", 24.4, 51, "circle"),
  def("", 29, 51, "circle"),
  def("", 31.9, 51, "circle"),
];

// 3 ダウンの守備ライン（オッドフロント）。3-4・3-3-5 で共通。
const FRONT_3: FormationPlayer[] = [
  def("", 23, 51, "circle"),
  def("", 26.7, 51, "circle"),
  def("", 30.4, 51, "circle"),
];

const I_FORMATION: Formation = {
  id: "i-formation",
  name: "I-Formation",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("Y", 33.6, 49.5, "square"),
    off("QB", 26.7, 47.5, "circle"),
    off("FB", 26.7, 45, "circle"),
    off("RB", 26.7, 42.5, "circle"),
    off("X", 6.5, 49.5, "circle"),
    off("Z", 46.5, 49, "circle"),
  ],
};

const SINGLEBACK_ACE: Formation = {
  id: "singleback-ace",
  name: "Singleback Ace",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("Y", 33.6, 49.5, "square"),
    off("QB", 26.7, 47.5, "circle"),
    off("RB", 26.7, 43.5, "circle"),
    off("X", 6, 49.5, "circle"),
    off("H", 40, 48.5, "circle"),
    off("Z", 47, 49, "circle"),
  ],
};

const SHOTGUN_SPREAD: Formation = {
  id: "shotgun-spread",
  name: "Shotgun Spread",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, 45, "circle"),
    off("RB", 29.5, 45, "circle"),
    off("X", 5.5, 49.5, "circle"),
    off("Y", 13, 49, "circle"),
    off("H", 40, 49, "circle"),
    off("Z", 47.5, 49.5, "circle"),
  ],
};

const TRIPS: Formation = {
  id: "trips",
  name: "Trips",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, 45, "circle"),
    off("RB", 24, 45, "circle"),
    off("X", 5.5, 49.5, "circle"),
    off("Y", 34.5, 49, "square"),
    off("H", 41, 48.5, "circle"),
    off("Z", 47.5, 49, "circle"),
  ],
};

const EMPTY: Formation = {
  id: "empty",
  name: "Empty",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, 45, "circle"),
    off("X", 5, 49.5, "circle"),
    off("F", 12, 48.5, "circle"),
    off("Y", 34.5, 49, "square"),
    off("H", 41, 48.5, "circle"),
    off("Z", 48, 49, "circle"),
  ],
};

const PISTOL: Formation = {
  id: "pistol",
  name: "Pistol",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("Y", 33.6, 49.5, "square"),
    off("QB", 26.7, 45.5, "circle"),
    off("RB", 26.7, 42.5, "circle"),
    off("X", 6, 49.5, "circle"),
    off("H", 40, 48.5, "circle"),
    off("Z", 47, 49, "circle"),
  ],
};

const BUNCH: Formation = {
  id: "bunch",
  name: "Bunch",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, 45, "circle"),
    off("RB", 24, 45, "circle"),
    off("X", 5.5, 49.5, "circle"),
    off("Z", 37, 49, "circle"),
    off("H", 34.3, 47.8, "circle"),
    off("Y", 39.7, 47.8, "circle"),
  ],
};

const DEFENSE_4_3: Formation = {
  id: "defense-4-3",
  name: "4-3",
  side: "defense",
  players: [
    ...FRONT_4,
    def("W", 22, 54, "circle"),
    def("M", 26.7, 54, "circle"),
    def("S", 31.4, 54, "circle"),
    def("", 7, 53, "circle"),
    def("", 46, 53, "circle"),
    def("FS", 24, 59, "circle"),
    def("SS", 30, 58, "circle"),
  ],
};

const DEFENSE_3_4: Formation = {
  id: "defense-3-4",
  name: "3-4",
  side: "defense",
  players: [
    ...FRONT_3,
    def("W", 19, 53, "circle"),
    def("M", 24.5, 54, "circle"),
    def("T", 29, 54, "circle"),
    def("S", 34.5, 53, "circle"),
    def("", 7, 53, "circle"),
    def("", 46, 53, "circle"),
    def("FS", 24, 59, "circle"),
    def("SS", 30, 59, "circle"),
  ],
};

const DEFENSE_NICKEL: Formation = {
  id: "defense-nickel",
  name: "Nickel",
  side: "defense",
  players: [
    ...FRONT_4,
    def("M", 23.5, 54, "circle"),
    def("W", 31, 54, "circle"),
    def("N", 14, 54.5, "circle"),
    def("", 7, 53, "circle"),
    def("", 46, 53, "circle"),
    def("FS", 22, 59.5, "circle"),
    def("SS", 31, 59.5, "circle"),
  ],
};

const DEFENSE_DIME: Formation = {
  id: "defense-dime",
  name: "Dime",
  side: "defense",
  players: [
    ...FRONT_4,
    def("M", 26.7, 54, "circle"),
    def("N", 14, 54, "circle"),
    def("$", 39, 54, "circle"),
    def("", 7, 53, "circle"),
    def("", 46, 53, "circle"),
    def("FS", 22, 59, "circle"),
    def("SS", 31, 59, "circle"),
  ],
};

const DEFENSE_4_2_5: Formation = {
  id: "defense-4-2-5",
  name: "4-2-5",
  side: "defense",
  players: [
    ...FRONT_4,
    def("M", 24.5, 54, "circle"),
    def("W", 30, 54, "circle"),
    def("N", 39, 54.5, "circle"),
    def("", 7, 53, "circle"),
    def("", 46, 53, "circle"),
    def("FS", 24, 59, "circle"),
    def("SS", 30, 58, "circle"),
  ],
};

const DEFENSE_3_3_5: Formation = {
  id: "defense-3-3-5",
  name: "3-3-5",
  side: "defense",
  players: [
    ...FRONT_3,
    def("W", 20, 54, "circle"),
    def("M", 26.7, 54, "circle"),
    def("S", 33, 54, "circle"),
    def("N", 14, 54.5, "circle"),
    def("", 7, 53, "circle"),
    def("", 46, 53, "circle"),
    def("FS", 24, 59, "circle"),
    def("SS", 30, 58, "circle"),
  ],
};

/**
 * 組み込みプリセット一覧（攻 7・守 6）。Toolbar はこれを攻守でグループ表示し、
 * 商用ソフトはこの配列を起点に独自テンプレートを足せる（PRD 5.6）。
 */
export const FORMATION_PRESETS: readonly Formation[] = [
  I_FORMATION,
  SINGLEBACK_ACE,
  SHOTGUN_SPREAD,
  TRIPS,
  EMPTY,
  PISTOL,
  BUNCH,
  DEFENSE_4_3,
  DEFENSE_3_4,
  DEFENSE_NICKEL,
  DEFENSE_DIME,
  DEFENSE_4_2_5,
  DEFENSE_3_3_5,
];

/** id でプリセットを引く。未知 id は undefined（呼び出し側で無視する）。 */
export function getFormationPreset(id: string): Formation | undefined {
  return FORMATION_PRESETS.find((f) => f.id === id);
}
