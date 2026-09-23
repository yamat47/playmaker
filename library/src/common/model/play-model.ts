import { Emitter, type Event } from "../base/event.js";
import { Disposable } from "../base/lifecycle.js";
import { type Line, MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "./line.js";
import { migratePlayData } from "./migration.js";
import { clonePlayData, type FieldZone, fieldStateForZone, type PlayData } from "./play-data.js";
import { MAX_PLAYERS, type Player } from "./player.js";

/**
 * 選手 1 人の削除を戻すのに要る値。選手と一緒に消えた線を元の添字付きで持ち、
 * 戻すときに同じ並びへ差し込む。
 */
export interface PlayerRemoval {
  readonly player: Player;
  readonly index: number;
  readonly removedLines: readonly LineRemoval[];
}

/** 線 1 本の削除を戻すのに要る値。 */
export interface LineRemoval {
  readonly line: Line;
  readonly index: number;
}

/**
 * プレー図の状態。起点の選手が消えた線を残さないことはこの型が守る。
 * 削除と差し替えは、戻すのに要る変更前の値を返す。
 */
export interface IPlayModel {
  /** いずれかの変更後に、getSnapshot と同じ値で 1 回発火する。 */
  readonly onDidChange: Event<PlayData>;
  /** 現在状態の深いコピー。呼ぶたびに図全体を複製する。 */
  getData(): PlayData;
  /**
   * 現在状態をコピーせずに返す。状態は変更のたびに新しいオブジェクトへ差し替えるので、
   * 受け取った値は後の変更で書き換わらない。
   */
  getSnapshot(): PlayData;
  getFieldZone(): FieldZone;
  /** 無ければ undefined。getSnapshot と同じく内部の値をそのまま返す。 */
  findPlayer(id: string): Player | undefined;
  /** 無ければ undefined。getSnapshot と同じく内部の値をそのまま返す。 */
  findLine(id: string): Line | undefined;
  /** findPlayer と同じだが、無い id なら throw する。 */
  getPlayer(id: string): Player;
  /** findLine と同じだが、無い id なら throw する。 */
  getLine(id: string): Line;
  /** LOS もゾーンの既定の位置へ移す。選手と線は LOS からの位置なので、図ごと一緒に動く。 */
  setFieldZone(zone: FieldZone): void;
  /**
   * 既にある id の選手を渡すと throw する。
   * 選手が MAX_PLAYERS 人を超える追加も throw する。
   */
  addPlayer(player: Player): void;
  /**
   * 何人足しても onDidChange は最後に 1 回だけ発火する。
   * 既存と重複する id があるか、MAX_PLAYERS 人を超えるときは、1 人も足さずに throw する。
   */
  addPlayers(players: readonly Player[]): void;
  /** 起点がその選手の線も一緒に消す。 */
  removePlayer(id: string): PlayerRemoval;
  /**
   * 起点が消える選手の線も一緒に消し、onDidChange は最後に 1 回だけ発火する。
   * 無い id か重複した id があれば、1 人も消さずに throw する。
   */
  removePlayers(ids: readonly string[]): PlayerRemoval[];
  /**
   * removePlayer で消した選手と線を、元の並びへ戻す。
   * 同じ id の選手が既にあるか、戻すと上限を超えるときは throw する。
   */
  restorePlayer(removal: PlayerRemoval): void;
  /** 同じ id の選手を差し替え、差し替える前の選手を返す。 */
  updatePlayer(player: Player): Player;
  /**
   * 既にある id の線を渡すと throw する。線が MAX_LINES 本を超えるときと、
   * waypoint が MAX_WAYPOINTS_PER_LINE 個を超える線も throw する。
   */
  addLine(line: Line): void;
  /** index は 0 から線の本数までで渡す。addLine と同じ条件で throw する。 */
  insertLine(line: Line, index: number): void;
  removeLine(id: string): LineRemoval;
  /** 同じ id の線を差し替え、差し替える前の線を返す。waypoint が MAX_WAYPOINTS_PER_LINE 個を超えると throw する。 */
  updateLine(line: Line): Line;
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

// 選択と編集は id で対象を決めるので、同じ id の要素を 2 つ持たせない。
function assertNewId(items: readonly { id: string }[], id: string, message: string): void {
  if (items.some((item) => item.id === id)) {
    throw new Error(`${message} "${id}"`);
  }
}

// 件数の上限は外部データの正規化と同じ値にする。編集で超えられると、
// getData で書き出した図を読み戻したときに黙って切り詰められる。
function assertWithinLimit(count: number, limit: number, what: string): void {
  if (count > limit) {
    throw new Error(`PlayModel: too many ${what}: ${count} > ${limit}`);
  }
}

function assertWithinLimits(data: PlayData): void {
  assertWithinLimit(data.players.length, MAX_PLAYERS, "players");
  assertWithinLimit(data.lines.length, MAX_LINES, "lines");
  for (const line of data.lines) {
    assertWithinLimit(line.waypoints.length, MAX_WAYPOINTS_PER_LINE, "waypoints");
  }
}

/**
 * 変更系メソッドは、状態を新しいオブジェクトへ差し替えてから onDidChange を 1 回だけ発火する。
 * 入力は複製せずに取り込む。型が読み取り専用なので、入力も状態もあとから書き換えられない。
 * 無い id を指す操作は、編集の組み立て違いなのでその場で throw する。
 */
export class PlayModel extends Disposable implements IPlayModel {
  private readonly _onDidChange = this._register(new Emitter<PlayData>());
  readonly onDidChange = this._onDidChange.event;
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

  findPlayer(id: string): Player | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  findLine(id: string): Line | undefined {
    return this.state.lines.find((l) => l.id === id);
  }

  getPlayer(id: string): Player {
    const player = this.findPlayer(id);
    if (player === undefined) {
      throw new Error(`PlayModel: unknown player id "${id}"`);
    }
    return player;
  }

  getLine(id: string): Line {
    const line = this.findLine(id);
    if (line === undefined) {
      throw new Error(`PlayModel: unknown line id "${id}"`);
    }
    return line;
  }

  setFieldZone(zone: FieldZone): void {
    // 同じゾーンでも発火する。変わらない操作を履歴に積まないのは編集の側で決める。
    this.commit({ ...this.state, field: fieldStateForZone(zone) });
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
    this.commit({ ...this.state, players: [...this.state.players, ...players] });
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
        // 起点を失う線は描けないので一緒に消し、戻すときのために添字を控える。
        removedLines.push({ line, index: i });
      } else {
        lines.push(line);
      }
    });
    // 削除では上限を超えないので commit を通さない。通知は呼び出し側がまとめて 1 回出す。
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
    // 1 人でも消せない id があれば何も消さずに throw する。途中まで消してから投げると、
    // 通知も履歴も伴わない変更が残る。
    const remaining = new Set(this.state.players.map((p) => p.id));
    for (const id of ids) {
      if (!remaining.delete(id)) {
        throw new Error(`PlayModel.removePlayers: unknown or repeated player id "${id}"`);
      }
    }
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
    // 元の添字の小さい順に差し込むと、消す前の並びに戻る。
    let lines = this.state.lines;
    for (const { line, index } of [...removal.removedLines].sort((a, b) => a.index - b.index)) {
      lines = insertAt(lines, index, line);
    }
    this.commit({ ...this.state, players, lines });
  }

  updatePlayer(player: Player): Player {
    const prev = this.getPlayer(player.id);
    this.commit({
      ...this.state,
      players: this.state.players.map((p) => (p === prev ? player : p)),
    });
    return prev;
  }

  addLine(line: Line): void {
    this.insertLine(line, this.state.lines.length);
  }

  insertLine(line: Line, index: number): void {
    assertNewId(this.state.lines, line.id, "PlayModel: duplicate line id");
    this.commit({ ...this.state, lines: insertAt(this.state.lines, index, line) });
  }

  removeLine(id: string): LineRemoval {
    const target = this.state.lines.find((l) => l.id === id);
    if (target === undefined) {
      throw new Error(`PlayModel.removeLine: unknown line id "${id}"`);
    }
    const index = this.state.lines.indexOf(target);
    this.commit({ ...this.state, lines: this.state.lines.filter((l) => l !== target) });
    return { line: target, index };
  }

  updateLine(line: Line): Line {
    const prev = this.getLine(line.id);
    this.commit({
      ...this.state,
      lines: this.state.lines.map((l) => (l === prev ? line : l)),
    });
    return prev;
  }

  // 件数が増えうる変更はすべてここを通し、上限を超える状態を持たない。
  private commit(next: PlayData): void {
    assertWithinLimits(next);
    this.state = next;
    this.emitChange();
  }

  private emitChange(): void {
    this._onDidChange.fire(this.state);
  }
}
