// フォーメーションテンプレートのデータ表現（PRD 5.6）。DOM 非依存。
// プリセット（presets.ts）と外部（商用ソフト）から渡るカスタム隊形の双方をこの型で扱う。
// 戦術的厳密性より組み込みやすさ優先（PRD 4.1）: 隊形 = 選手テンプレートの名前付き集合。

import { normalizePlayers, type Player } from "../model/player.js";

/**
 * 攻守の区別。プリセット一覧の UI グルーピングに使うメタ情報で、
 * 読み込み（配置）ロジックには影響しない（Model に side 概念は持ち込まない＝PRD 4.1 範囲を絞る）。
 */
export type FormationSide = "offense" | "defense";

/**
 * 隊形に含まれる 1 人の選手テンプレート。`id` は持たない
 * （読み込み時に IdFactory で採番し直す＝既存選手・Undo 復活と衝突しない）。
 */
export type FormationPlayer = Omit<Player, "id">;

/**
 * フォーメーションテンプレート。読み込むと players を現在のプレー図へ自動配置する。
 * 商用ソフトはこの形でカスタム隊形を渡せる（PRD 5.6 外部受け入れ）。
 */
export interface Formation {
  /** 安定識別子（プリセットキー or 外部指定）。UI の選択値に使う。 */
  id: string;
  /** 表示名（日本語・UI 用）。 */
  name: string;
  side: FormationSide;
  /** 配置する選手テンプレート（1 つ以上）。 */
  players: FormationPlayer[];
}

const FORMATION_SIDES: readonly FormationSide[] = ["offense", "defense"];

export function isFormationSide(value: unknown): value is FormationSide {
  return typeof value === "string" && (FORMATION_SIDES as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Player から id を落として FormationPlayer 化する（テンプレートは id を持たない）。 */
function toFormationPlayer(player: Player): FormationPlayer {
  const fp: FormationPlayer = {
    position: { ...player.position },
    shape: player.shape,
    label: player.label,
  };
  if (player.color !== undefined) {
    fp.color = player.color;
  }
  return fp;
}

/**
 * 外部（商用ソフト）から渡るカスタム隊形を内部で安全な Formation へ正規化する。
 * 選手の正規化は normalizePlayers を再利用し（位置不正は除外・既定補完）、
 * id を落として FormationPlayer 化する。配置可能な選手が 1 人も無ければ復元不能として null。
 * id/name/side は欠落・不正でも落とさず既定で補完する（PRD 6.6 の堅牢性）。
 * 返り値は常に新規オブジェクトで入力を共有しない。
 */
export function normalizeFormation(raw: unknown): Formation | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const players = normalizePlayers(source.players).map(toFormationPlayer);
  if (players.length === 0) {
    return null;
  }
  return {
    id: isNonEmptyString(source.id) ? source.id : "formation",
    name: isNonEmptyString(source.name) ? source.name : "フォーメーション",
    side: isFormationSide(source.side) ? source.side : "offense",
    players,
  };
}
