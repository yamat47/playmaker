// プレー図の唯一の状態保持者（Model–View 分離の Model）。DOM 非依存。
// 変更のたびに onDidChange で PlayData のスナップショットを発火する（PRD 5.8 の onChange 土台）。
// 選手↔線の整合（起点選手が消えたら従属線も消える）はこの Model が所有する不変条件。

import { Emitter, type Event } from "../event/emitter.js";
import { cloneLine, type Line } from "./line.js";
import { migratePlayData } from "./migration.js";
import { clonePlayData, type FieldZone, type PlayData } from "./play-data.js";
import { clonePlayer, type Player } from "./player.js";

/**
 * 選手 1 人の削除を後から正確に巻き戻すためのメメント。
 * カスケード除去した従属線を「元の配列インデックス付き」で保持し、復元時に同じ並びへ戻す。
 */
export interface PlayerRemoval {
  player: Player;
  index: number;
  removedLines: { line: Line; index: number }[];
}

/** 線 1 本の削除を巻き戻すためのメメント（元のインデックス付き）。 */
export interface LineRemoval {
  line: Line;
  index: number;
}

/**
 * Model の公開面。コマンド層（common）と View 層（browser）はこの IF にのみ依存し、
 * 具象 PlayModel を差し替え・モックできる（インターフェース抽出）。
 * 変更系メソッドは戻り値で「巻き戻しに必要な直前状態」を返し、コマンドの undo を支える。
 */
export interface IPlayModel {
  /** いずれかの変更後に最新 PlayData のスナップショットを 1 回発火する。 */
  readonly onDidChange: Event<PlayData>;
  /** 現在状態の深いスナップショット（内部状態とは別オブジェクト）。 */
  getData(): PlayData;
  /** 現在のフィールドゾーン（値型なので getData の深いコピーを伴わない軽量読取）。 */
  getFieldZone(): FieldZone;
  /** id に一致する選手の複製。無ければ undefined。 */
  findPlayer(id: string): Player | undefined;
  /** id に一致する線の複製。無ければ undefined。 */
  findLine(id: string): Line | undefined;
  setFieldZone(zone: FieldZone): void;
  addPlayer(player: Player): void;
  /** 複数選手を一括追加し、変更は最後に 1 回だけ発火する（1 操作 = 1 onChange の契約を一括時も保つ）。 */
  addPlayers(players: readonly Player[]): void;
  /** 選手を削除し、起点がその選手の線もカスケード除去する。巻き戻し用メメントを返す。 */
  removePlayer(id: string): PlayerRemoval;
  /** 複数選手を一括削除し（各々従属線をカスケード）、変更を 1 回だけ発火する。 */
  removePlayers(ids: readonly string[]): PlayerRemoval[];
  /** removePlayer の逆操作。選手と従属線を元の並びへ戻す。 */
  restorePlayer(removal: PlayerRemoval): void;
  /** 同 id の選手を差し替え、差し替え前の選手（複製）を返す。 */
  updatePlayer(player: Player): Player;
  addLine(line: Line): void;
  insertLine(line: Line, index: number): void;
  /** 線を削除し、巻き戻し用メメントを返す。 */
  removeLine(id: string): LineRemoval;
  /** 同 id の線を差し替え、差し替え前の線（複製）を返す。 */
  updateLine(line: Line): Line;
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  const at = clampIndex(index, items.length);
  return [...items.slice(0, at), item, ...items.slice(at)];
}

/**
 * 状態を専有し変更を発火する純粋な Model。
 * すべての変更系メソッドは「入力を複製して取り込み」「変更後に onDidChange を 1 回だけ発火」する。
 * 復元不能な参照（未知 id への操作）は契約違反としてその場で throw する（UI は実在対象のみ操作する前提）。
 */
export class PlayModel implements IPlayModel {
  private readonly _onDidChange = new Emitter<PlayData>();
  readonly onDidChange = this._onDidChange.event;
  // migratePlayData が版検出→段適用→構造正規化した深い新規オブジェクトを返す
  // ＝外部入力（旧版・破損含む）と完全に切り離した内部状態（PRD 6.6 の唯一の入口）。
  private state: PlayData;

  constructor(initialData?: PlayData) {
    this.state = migratePlayData(initialData);
  }

  getData(): PlayData {
    return clonePlayData(this.state);
  }

  getFieldZone(): FieldZone {
    return this.state.field.zone;
  }

  findPlayer(id: string): Player | undefined {
    const found = this.state.players.find((p) => p.id === id);
    return found === undefined ? undefined : clonePlayer(found);
  }

  findLine(id: string): Line | undefined {
    const found = this.state.lines.find((l) => l.id === id);
    return found === undefined ? undefined : cloneLine(found);
  }

  setFieldZone(zone: FieldZone): void {
    // no-op（同値）抑止はコマンド/UI 層の責務。Model は決定的に set して発火する。
    this.state = { ...this.state, field: { ...this.state.field, zone } };
    this.emitChange();
  }

  // 変更を発火しない純粋なミューテーション。単発（emit 付き）と一括（最後に 1 回 emit）の
  // 両方からこのコアを共有し、「1 操作 = onChange 1 回」を一括時も保つ。
  private addPlayerCore(player: Player): void {
    this.state = { ...this.state, players: [...this.state.players, clonePlayer(player)] };
  }

  addPlayer(player: Player): void {
    this.addPlayerCore(player);
    this.emitChange();
  }

  addPlayers(players: readonly Player[]): void {
    for (const player of players) {
      this.addPlayerCore(player);
    }
    this.emitChange();
  }

  private removePlayerCore(id: string): PlayerRemoval {
    const target = this.state.players.find((p) => p.id === id);
    if (target === undefined) {
      throw new Error(`PlayModel.removePlayer: unknown player id "${id}"`);
    }
    const index = this.state.players.indexOf(target);
    const removedLines: { line: Line; index: number }[] = [];
    const lines: Line[] = [];
    this.state.lines.forEach((line, i) => {
      if (line.startPlayerId === id) {
        // 起点を失う線は dangling になる＝整合のため一緒に除去（復元用に位置を控える）。
        removedLines.push({ line: cloneLine(line), index: i });
      } else {
        lines.push(line);
      }
    });
    this.state = {
      ...this.state,
      players: this.state.players.filter((p) => p !== target),
      lines,
    };
    return { player: clonePlayer(target), index, removedLines };
  }

  removePlayer(id: string): PlayerRemoval {
    const removal = this.removePlayerCore(id);
    this.emitChange();
    return removal;
  }

  removePlayers(ids: readonly string[]): PlayerRemoval[] {
    const removals = ids.map((id) => this.removePlayerCore(id));
    this.emitChange();
    return removals;
  }

  restorePlayer(removal: PlayerRemoval): void {
    const players = insertAt(this.state.players, removal.index, clonePlayer(removal.player));
    // 昇順に元インデックスへ挿し戻すと除去前の並びが正確に再現される。
    let lines = this.state.lines;
    for (const { line, index } of [...removal.removedLines].sort((a, b) => a.index - b.index)) {
      lines = insertAt(lines, index, cloneLine(line));
    }
    this.state = { ...this.state, players, lines };
    this.emitChange();
  }

  updatePlayer(player: Player): Player {
    const prev = this.state.players.find((p) => p.id === player.id);
    if (prev === undefined) {
      throw new Error(`PlayModel.updatePlayer: unknown player id "${player.id}"`);
    }
    const next = clonePlayer(player);
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => (p === prev ? next : p)),
    };
    this.emitChange();
    return clonePlayer(prev);
  }

  addLine(line: Line): void {
    this.state = { ...this.state, lines: [...this.state.lines, cloneLine(line)] };
    this.emitChange();
  }

  insertLine(line: Line, index: number): void {
    this.state = { ...this.state, lines: insertAt(this.state.lines, index, cloneLine(line)) };
    this.emitChange();
  }

  removeLine(id: string): LineRemoval {
    const target = this.state.lines.find((l) => l.id === id);
    if (target === undefined) {
      throw new Error(`PlayModel.removeLine: unknown line id "${id}"`);
    }
    const index = this.state.lines.indexOf(target);
    this.state = { ...this.state, lines: this.state.lines.filter((l) => l !== target) };
    this.emitChange();
    return { line: cloneLine(target), index };
  }

  updateLine(line: Line): Line {
    const prev = this.state.lines.find((l) => l.id === line.id);
    if (prev === undefined) {
      throw new Error(`PlayModel.updateLine: unknown line id "${line.id}"`);
    }
    const next = cloneLine(line);
    this.state = {
      ...this.state,
      lines: this.state.lines.map((l) => (l === prev ? next : l)),
    };
    this.emitChange();
    return cloneLine(prev);
  }

  private emitChange(): void {
    // 受け手（onChange / View）が書き換えても内部に波及しないようスナップショットを渡す。
    this._onDidChange.fire(this.getData());
  }
}
