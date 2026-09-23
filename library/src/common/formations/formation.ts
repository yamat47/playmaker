import { isNonEmptyString, isRecord } from "../model/guards.js";
import type { IIdFactory } from "../model/id-factory.js";
import { normalizePlayers, type Player } from "../model/player.js";
import { isTeamSide, type TeamSide } from "../presets/shared.js";

/**
 * 隊形の 1 人。`id` は持たず、読み込むたびに振る。同じ隊形を 2 回読んでも、
 * 図にいる選手とも Undo で戻る選手とも id がぶつからない。
 */
export type FormationPlayer = Omit<Player, "id">;

/** 読み込むと、players を今の図に足す。プリセットのほかに、利用者が作った隊形も渡せる。 */
export interface Formation {
  readonly id: string;
  readonly name: string;
  /** 読み込んだときの選手の配置には影響しない。 */
  readonly side: TeamSide;
  /** 1 人以上。 */
  readonly players: readonly FormationPlayer[];
}

function toFormationPlayer(player: Player): FormationPlayer {
  return {
    position: player.position,
    shape: player.shape,
    label: player.label,
    ...(player.color === undefined ? {} : { color: player.color }),
  };
}

/**
 * 外から受け取った隊形を Formation に正規化する。選手は図の選手と同じ規則で正規化し、
 * 置ける選手が 1 人もいなければ null を返す。id、name、side が欠けていても既定で補う。
 * 返り値は新しいオブジェクトで、入力と参照を共有しない。
 */
export function normalizeFormation(raw: unknown): Formation | null {
  if (!isRecord(raw)) {
    return null;
  }
  const players = normalizePlayers(raw.players).map(toFormationPlayer);
  if (players.length === 0) {
    return null;
  }
  return {
    id: isNonEmptyString(raw.id) ? raw.id : "formation",
    name: isNonEmptyString(raw.name) ? raw.name : "フォーメーション",
    side: isTeamSide(raw.side) ? raw.side : "offense",
    players,
  };
}

/**
 * 隊形の選手に id を振って Player にする。id は takenIds とも、同じ隊形のほかの選手とも重ならない。
 */
export function instantiateFormation(
  formation: Formation,
  ids: IIdFactory,
  takenIds: Iterable<string>,
): Player[] {
  const taken = new Set(takenIds);
  return formation.players.map((template) => {
    const id = ids.next("player", taken);
    taken.add(id);
    return { ...template, id };
  });
}
