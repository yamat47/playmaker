// 縦は LOS からの位置（LOS が 0 で、攻撃方向が正）で、横はセンターを 26.7 ヤード付近に置く。
// どのゾーンで読み込んでも窓に収まる。名称は英語で書く。フィールド上の表記を英語に揃えるため。

import type { PlayerShape } from "../model/player.js";
import { DEFENSE_COLOR, deepFreeze } from "../presets/shared.js";
import type { Formation, FormationPlayer } from "./formation.js";

/** オフェンス選手テンプレート（色なし＝テーマ既定）。 */
function off(
  label: string,
  lateralYard: number,
  downfieldYard: number,
  shape: PlayerShape,
): FormationPlayer {
  return { position: { lateralYard, downfieldYard }, shape, label };
}

/** ディフェンス選手テンプレート（DEFENSE_COLOR で塗る）。 */
function def(
  label: string,
  lateralYard: number,
  downfieldYard: number,
  shape: PlayerShape,
): FormationPlayer {
  return { position: { lateralYard, downfieldYard }, shape, label, color: DEFENSE_COLOR };
}

// オフェンスライン（5 人・LOS 上）は全隊形で共通。
const OFFENSIVE_LINE: FormationPlayer[] = [
  off("LT", 22.1, -0.5, "square"),
  off("LG", 24.4, -0.5, "square"),
  off("C", 26.7, -0.5, "square"),
  off("RG", 29, -0.5, "square"),
  off("RT", 31.3, -0.5, "square"),
];

// 4 ダウンの守備ライン（オーバーフロント）。4-3 系・ニッケル・ダイム・4-2-5 で共通。
const FRONT_4: FormationPlayer[] = [
  def("", 21.5, 1, "circle"),
  def("", 24.4, 1, "circle"),
  def("", 29, 1, "circle"),
  def("", 31.9, 1, "circle"),
];

// 3 ダウンの守備ライン（オッドフロント）。3-4・3-3-5 で共通。
const FRONT_3: FormationPlayer[] = [
  def("", 23, 1, "circle"),
  def("", 26.7, 1, "circle"),
  def("", 30.4, 1, "circle"),
];

const I_FORMATION: Formation = {
  id: "i-formation",
  name: "I-Formation",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("Y", 33.6, -0.5, "square"),
    off("QB", 26.7, -2.5, "circle"),
    off("FB", 26.7, -5, "circle"),
    off("RB", 26.7, -7.5, "circle"),
    off("X", 6.5, -0.5, "circle"),
    off("Z", 46.5, -1, "circle"),
  ],
};

const SINGLEBACK_ACE: Formation = {
  id: "singleback-ace",
  name: "Singleback Ace",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("Y", 33.6, -0.5, "square"),
    off("QB", 26.7, -2.5, "circle"),
    off("RB", 26.7, -6.5, "circle"),
    off("X", 6, -0.5, "circle"),
    off("H", 40, -1.5, "circle"),
    off("Z", 47, -1, "circle"),
  ],
};

const SHOTGUN_SPREAD: Formation = {
  id: "shotgun-spread",
  name: "Shotgun Spread",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, -5, "circle"),
    off("RB", 29.5, -5, "circle"),
    off("X", 5.5, -0.5, "circle"),
    off("Y", 13, -1, "circle"),
    off("H", 40, -1, "circle"),
    off("Z", 47.5, -0.5, "circle"),
  ],
};

const TRIPS: Formation = {
  id: "trips",
  name: "Trips",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, -5, "circle"),
    off("RB", 24, -5, "circle"),
    off("X", 5.5, -0.5, "circle"),
    off("Y", 34.5, -1, "square"),
    off("H", 41, -1.5, "circle"),
    off("Z", 47.5, -1, "circle"),
  ],
};

const EMPTY: Formation = {
  id: "empty",
  name: "Empty",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, -5, "circle"),
    off("X", 5, -0.5, "circle"),
    off("F", 12, -1.5, "circle"),
    off("Y", 34.5, -1, "square"),
    off("H", 41, -1.5, "circle"),
    off("Z", 48, -1, "circle"),
  ],
};

const PISTOL: Formation = {
  id: "pistol",
  name: "Pistol",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("Y", 33.6, -0.5, "square"),
    off("QB", 26.7, -4.5, "circle"),
    off("RB", 26.7, -7.5, "circle"),
    off("X", 6, -0.5, "circle"),
    off("H", 40, -1.5, "circle"),
    off("Z", 47, -1, "circle"),
  ],
};

const BUNCH: Formation = {
  id: "bunch",
  name: "Bunch",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, -5, "circle"),
    off("RB", 24, -5, "circle"),
    off("X", 5.5, -0.5, "circle"),
    off("Z", 37, -1, "circle"),
    off("H", 34.3, -2.2, "circle"),
    off("Y", 39.7, -2.2, "circle"),
  ],
};

const DEFENSE_4_3: Formation = {
  id: "defense-4-3",
  name: "4-3",
  side: "defense",
  players: [
    ...FRONT_4,
    def("W", 22, 4, "circle"),
    def("M", 26.7, 4, "circle"),
    def("S", 31.4, 4, "circle"),
    def("", 7, 3, "circle"),
    def("", 46, 3, "circle"),
    def("FS", 24, 9, "circle"),
    def("SS", 30, 8, "circle"),
  ],
};

const DEFENSE_3_4: Formation = {
  id: "defense-3-4",
  name: "3-4",
  side: "defense",
  players: [
    ...FRONT_3,
    def("W", 19, 3, "circle"),
    def("M", 24.5, 4, "circle"),
    def("T", 29, 4, "circle"),
    def("S", 34.5, 3, "circle"),
    def("", 7, 3, "circle"),
    def("", 46, 3, "circle"),
    def("FS", 24, 9, "circle"),
    def("SS", 30, 9, "circle"),
  ],
};

const DEFENSE_NICKEL: Formation = {
  id: "defense-nickel",
  name: "Nickel",
  side: "defense",
  players: [
    ...FRONT_4,
    def("M", 23.5, 4, "circle"),
    def("W", 31, 4, "circle"),
    def("N", 14, 4.5, "circle"),
    def("", 7, 3, "circle"),
    def("", 46, 3, "circle"),
    def("FS", 22, 9.5, "circle"),
    def("SS", 31, 9.5, "circle"),
  ],
};

const DEFENSE_DIME: Formation = {
  id: "defense-dime",
  name: "Dime",
  side: "defense",
  players: [
    ...FRONT_4,
    def("M", 26.7, 4, "circle"),
    def("N", 14, 4, "circle"),
    def("$", 39, 4, "circle"),
    def("", 7, 3, "circle"),
    def("", 46, 3, "circle"),
    def("FS", 22, 9, "circle"),
    def("SS", 31, 9, "circle"),
  ],
};

const DEFENSE_4_2_5: Formation = {
  id: "defense-4-2-5",
  name: "4-2-5",
  side: "defense",
  players: [
    ...FRONT_4,
    def("M", 24.5, 4, "circle"),
    def("W", 30, 4, "circle"),
    def("N", 39, 4.5, "circle"),
    def("", 7, 3, "circle"),
    def("", 46, 3, "circle"),
    def("FS", 24, 9, "circle"),
    def("SS", 30, 8, "circle"),
  ],
};

const DEFENSE_3_3_5: Formation = {
  id: "defense-3-3-5",
  name: "3-3-5",
  side: "defense",
  players: [
    ...FRONT_3,
    def("W", 20, 4, "circle"),
    def("M", 26.7, 4, "circle"),
    def("S", 33, 4, "circle"),
    def("N", 14, 4.5, "circle"),
    def("", 7, 3, "circle"),
    def("", 46, 3, "circle"),
    def("FS", 24, 9, "circle"),
    def("SS", 30, 8, "circle"),
  ],
};

/**
 * 組み込みプリセット一覧（攻 7・守 6）。Toolbar はこれを攻守でグループ表示し、
 * 商用ソフトはこの配列を起点に独自テンプレートを足せる（PRD 5.6）。
 */
export const FORMATION_PRESETS: readonly Formation[] = /* @__PURE__ */ deepFreeze([
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
]);

/** id でプリセットを引く。未知 id は undefined（呼び出し側で無視する）。 */
export function getFormationPreset(id: string): Formation | undefined {
  return FORMATION_PRESETS.find((f) => f.id === id);
}
