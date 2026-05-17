// 組み込み済みプリセットフォーメーション（PRD 5.6「オフェンス・ディフェンスの代表的な隊形」）。
// DOM 非依存のデータ。座標はヤード空間（LOS≈50・センター lat≈26.7）で middle ゾーン窓
// (abs 35..65) に収まるよう置く。戦術的厳密性より組み込みやすさ優先（PRD 4.1）＝代表例に絞る。

import type { PlayerShape } from "../model/player.js";
import type { Formation, FormationPlayer } from "./formation.js";

/** ディフェンス選手の既定色（攻守を一目で区別できるよう赤系）。 */
const DEFENSE_COLOR = "#c62828";

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

// オフェンスライン（5 人・LOS 上）は両隊形で共通。
const OFFENSIVE_LINE: FormationPlayer[] = [
  off("LT", 22.1, 49.5, "square"),
  off("LG", 24.4, 49.5, "square"),
  off("C", 26.7, 49.5, "square"),
  off("RG", 29, 49.5, "square"),
  off("RT", 31.3, 49.5, "square"),
];

// ディフェンスライン（4 人）は両隊形で共通。
const DEFENSIVE_LINE: FormationPlayer[] = [
  def("", 21, 51, "pentagon"),
  def("", 24.5, 51, "pentagon"),
  def("", 29, 51, "pentagon"),
  def("", 32.5, 51, "pentagon"),
];

const I_FORMATION: Formation = {
  id: "i-formation",
  name: "I フォーメーション",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("TE", 33.6, 49.5, "triangle"),
    off("QB", 26.7, 47.5, "circle"),
    off("FB", 26.7, 45, "diamond"),
    off("RB", 26.7, 42.5, "diamond"),
    off("X", 7, 49.5, "circle"),
    off("Z", 46, 49.5, "circle"),
  ],
};

const SHOTGUN_SPREAD: Formation = {
  id: "shotgun-spread",
  name: "ショットガン スプレッド",
  side: "offense",
  players: [
    ...OFFENSIVE_LINE,
    off("QB", 26.7, 45, "circle"),
    off("RB", 29.7, 45, "diamond"),
    off("X", 6, 49.5, "circle"),
    off("Y", 13, 49, "circle"),
    off("H", 40, 49, "circle"),
    off("Z", 47, 49.5, "circle"),
  ],
};

const DEFENSE_4_3: Formation = {
  id: "defense-4-3",
  name: "4-3 ディフェンス",
  side: "defense",
  players: [
    ...DEFENSIVE_LINE,
    def("S", 20, 54.5, "hexagon"),
    def("M", 26.7, 54.5, "hexagon"),
    def("W", 33, 54.5, "hexagon"),
    def("", 7, 53, "hexagon"),
    def("", 46, 53, "hexagon"),
    def("FS", 22, 60, "diamond"),
    def("SS", 31, 60, "diamond"),
  ],
};

const DEFENSE_NICKEL: Formation = {
  id: "defense-nickel",
  name: "ニッケル ディフェンス",
  side: "defense",
  players: [
    ...DEFENSIVE_LINE,
    def("M", 23, 54.5, "hexagon"),
    def("W", 31, 54.5, "hexagon"),
    def("N", 14, 55, "hexagon"),
    def("", 7, 53, "hexagon"),
    def("", 46, 53, "hexagon"),
    def("FS", 22, 60, "diamond"),
    def("SS", 31, 60, "diamond"),
  ],
};

/**
 * 組み込みプリセット一覧（攻 2・守 2）。Toolbar はこれを攻守でグループ表示し、
 * 商用ソフトはこの配列を起点に独自テンプレートを足せる（PRD 5.6）。
 */
export const FORMATION_PRESETS: readonly Formation[] = [
  I_FORMATION,
  SHOTGUN_SPREAD,
  DEFENSE_4_3,
  DEFENSE_NICKEL,
];

/** id でプリセットを引く。未知 id は undefined（呼び出し側で無視する）。 */
export function getFormationPreset(id: string): Formation | undefined {
  return FORMATION_PRESETS.find((f) => f.id === id);
}
