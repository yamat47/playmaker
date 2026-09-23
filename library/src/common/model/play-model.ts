// プレー図の唯一の状態保持者（Model–View 分離の Model）。DOM 非依存。
// 変更のたびに onDidChange で PlayData のスナップショットを発火する（PRD 5.8 の onChange 土台）。
// 選手↔線の整合（起点選手が消えたら従属線も消える）はこの Model が所有する不変条件。

import { Emitter, type Event } from "../event/emitter.js";
import { Disposable } from "../lifecycle/disposable.js";
import type { Line } from "./line.js";
import { migratePlayData } from "./migration.js";
import { clonePlayData, type FieldZone, type PlayData } from "./play-data.js";
import type { Player } from "./player.js";

/**
 * 選手 1 人の削除を後から正確に巻き戻すためのメメント。
 * カスケード除去した従属線を「元の配列インデックス付き」で保持し、復元時に同じ並びへ戻す。
 */
export interface PlayerRemoval {
  readonly player: Player;
  readonly index: number;
  readonly removedLines: readonly LineRemoval[];
}

/** 線 1 本の削除を巻き戻すためのメメント（元のインデックス付き）。 */
export interface LineRemoval {
  readonly line: Line;
  readonly index: number;
}

/**
 * Model の公開面。コマンド層（common）と View 層（browser）はこの IF にのみ依存し、
 * 具象 PlayModel を差し替え・モックできる（インターフェース抽出）。
 * 変更系メソッドは戻り値で「巻き戻しに必要な直前状態」を返し、コマンドの undo を支える。
 */
export interface IPlayModel {
  /** いずれかの変更後に、getSnapshot と同じ値で 1 回発火する。 */
  readonly onDidChange: Event<PlayData>;
  /** 現在状態の深いコピー。内部の読み取りには getSnapshot を使い、これは外へ渡すときだけ使う。 */
  getData(): PlayData;
  /**
   * 現在状態をコピーせずに返す。状態は変更のたびに新しいオブジェクトへ差し替えるので、
   * 受け取った値は後の変更で書き換わらない。
   */
  getSnapshot(): PlayData;
  getFieldZone(): FieldZone;
  hasPlayer(id: string): boolean;
  /** 無ければ undefined。getSnapshot と同じく内部の値をそのまま返す。 */
  findPlayer(id: string): Player | undefined;
  /** 無ければ undefined。getSnapshot と同じく内部の値をそのまま返す。 */
  findLine(id: string): Line | undefined;
  setFieldZone(zone: FieldZone): void;
  /** 既にある id の選手を渡すと throw する（id は選択と編集の対象を決める唯一の鍵）。 */
  addPlayer(player: Player): void;
  /**
   * 複数選手を一括追加し、変更は最後に 1 回だけ発火する（1 操作 = 1 onChange の契約を一括時も保つ）。
   * 既存と重複する id があれば throw する。
   */
  addPlayers(players: readonly Player[]): void;
  /** 選手を削除し、起点がその選手の線もカスケード除去する。巻き戻し用メメントを返す。 */
  removePlayer(id: string): PlayerRemoval;
  /** 複数選手を一括削除し（各々従属線をカスケード）、変更を 1 回だけ発火する。 */
  removePlayers(ids: readonly string[]): PlayerRemoval[];
  /** removePlayer の逆操作。選手と従属線を元の並びへ戻す。同じ id の選手が既にあれば throw する。 */
  restorePlayer(removal: PlayerRemoval): void;
  /** 同 id の選手を差し替え、差し替え前の選手を返す。 */
  updatePlayer(player: Player): Player;
  /** 既にある id の線を渡すと throw する。 */
  addLine(line: Line): void;
  /** 既にある id の線を渡すと throw する。 */
  insertLine(line: Line, index: number): void;
  /** 線を削除し、巻き戻し用メメントを返す。 */
  removeLine(id: string): LineRemoval;
  /** 同 id の線を差し替え、差し替え前の線を返す。 */
  updateLine(line: Line): Line;
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  const at = clampIndex(index, items.length);
  return [...items.slice(0, at), item, ...items.slice(at)];
}

// id は選択と編集の対象を決める唯一の鍵なので、同じ id の要素を 2 つ持たせない。
function assertNewId(items: readonly { id: string }[], id: string, message: string): void {
  if (items.some((item) => item.id === id)) {
    throw new Error(`${message} "${id}"`);
  }
}

/**
 * 状態を専有し変更を発火する純粋な Model。
 * 変更系メソッドは入力をそのまま取り込み、状態を新しいオブジェクトへ差し替えてから
 * onDidChange を 1 回だけ発火する。型が読み取り専用なので、入力も状態も後から
 * 書き換えられない前提で複製しない。
 * 復元不能な参照（未知 id への操作）は契約違反としてその場で throw する（UI は実在対象のみ操作する前提）。
 */
export class PlayModel extends Disposable implements IPlayModel {
  private readonly _onDidChange = this._register(new Emitter<PlayData>());
  readonly onDidChange = this._onDidChange.event;
  // migratePlayData が版検出→段適用→構造正規化した深い新規オブジェクトを返す
  // ＝外部入力（旧版・破損含む）と完全に切り離した内部状態（PRD 6.6 の唯一の入口）。
  private state: PlayData;

  constructor(initialData?: unknown) {
    super();
    this.state = migratePlayData(initialData);
  }

  getData(): PlayData {
    return clonePlayData(this.state);
  }

  getSnapshot(): PlayData {
    return this.state;
  }

  getFieldZone(): FieldZone {
    return this.state.field.zone;
  }

  hasPlayer(id: string): boolean {
    return this.state.players.some((p) => p.id === id);
  }

  findPlayer(id: string): Player | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  findLine(id: string): Line | undefined {
    return this.state.lines.find((l) => l.id === id);
  }

  setFieldZone(zone: FieldZone): void {
    // no-op（同値）抑止はコマンド/UI 層の責務。Model は決定的に set して発火する。
    this.state = { ...this.state, field: { ...this.state.field, zone } };
    this.emitChange();
  }

  addPlayer(player: Player): void {
    this.addPlayers([player]);
  }

  addPlayers(players: readonly Player[]): void {
    // 1 人でも重複があれば何も足さずに throw する。途中まで足してから投げると、
    // 通知も履歴も伴わない変更が残る。
    const taken = new Set(this.state.players.map((p) => p.id));
    for (const player of players) {
      if (taken.has(player.id)) {
        throw new Error(`PlayModel.addPlayers: duplicate player id "${player.id}"`);
      }
      taken.add(player.id);
    }
    this.state = { ...this.state, players: [...this.state.players, ...players] };
    this.emitChange();
  }

  private removePlayerCore(id: string): PlayerRemoval {
    const target = this.state.players.find((p) => p.id === id);
    if (target === undefined) {
      throw new Error(`PlayModel.removePlayer: unknown player id "${id}"`);
    }
    const index = this.state.players.indexOf(target);
    const removedLines: LineRemoval[] = [];
    const lines: Line[] = [];
    this.state.lines.forEach((line, i) => {
      if (line.startPlayerId === id) {
        // 起点を失う線は dangling になる＝整合のため一緒に除去（復元用に位置を控える）。
        removedLines.push({ line, index: i });
      } else {
        lines.push(line);
      }
    });
    this.state = {
      ...this.state,
      players: this.state.players.filter((p) => p !== target),
      lines,
    };
    return { player: target, index, removedLines };
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
    assertNewId(
      this.state.players,
      removal.player.id,
      "PlayModel.restorePlayer: duplicate player id",
    );
    const players = insertAt(this.state.players, removal.index, removal.player);
    // 昇順に元インデックスへ挿し戻すと除去前の並びが正確に再現される。
    let lines = this.state.lines;
    for (const { line, index } of [...removal.removedLines].sort((a, b) => a.index - b.index)) {
      lines = insertAt(lines, index, line);
    }
    this.state = { ...this.state, players, lines };
    this.emitChange();
  }

  updatePlayer(player: Player): Player {
    const prev = this.state.players.find((p) => p.id === player.id);
    if (prev === undefined) {
      throw new Error(`PlayModel.updatePlayer: unknown player id "${player.id}"`);
    }
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => (p === prev ? player : p)),
    };
    this.emitChange();
    return prev;
  }

  addLine(line: Line): void {
    assertNewId(this.state.lines, line.id, "PlayModel.addLine: duplicate line id");
    this.state = { ...this.state, lines: [...this.state.lines, line] };
    this.emitChange();
  }

  insertLine(line: Line, index: number): void {
    assertNewId(this.state.lines, line.id, "PlayModel.insertLine: duplicate line id");
    this.state = { ...this.state, lines: insertAt(this.state.lines, index, line) };
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
    return { line: target, index };
  }

  updateLine(line: Line): Line {
    const prev = this.state.lines.find((l) => l.id === line.id);
    if (prev === undefined) {
      throw new Error(`PlayModel.updateLine: unknown line id "${line.id}"`);
    }
    this.state = {
      ...this.state,
      lines: this.state.lines.map((l) => (l === prev ? line : l)),
    };
    this.emitChange();
    return prev;
  }

  private emitChange(): void {
    this._onDidChange.fire(this.state);
  }
}
