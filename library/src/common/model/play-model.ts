import { Emitter, type Event } from "../base/event.js";
import { Disposable } from "../base/lifecycle.js";
import { type Line, MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "./line.js";
import { migratePlayData } from "./migration.js";
import { clonePlayData, type FieldZone, fieldStateForZone, type PlayData } from "./play-data.js";
import { MAX_PLAYERS, type Player } from "./player.js";

/**
 * What is needed to undo the removal of one player. Holds the lines removed with the player,
 * each with its original index, so they are inserted back into the same order.
 */
export interface PlayerRemoval {
  readonly player: Player;
  readonly index: number;
  readonly removedLines: readonly LineRemoval[];
}

/** What is needed to undo the removal of one line. */
export interface LineRemoval {
  readonly line: Line;
  readonly index: number;
}

/**
 * State of the play diagram. An implementation never keeps a line whose start player is gone.
 * Removals and replacements return the previous values needed to undo them.
 */
export interface IPlayModel {
  /** Fires once after any change, with the same value as getSnapshot. */
  readonly onDidChange: Event<PlayData>;
  /** Deep copy of the current state. Each call copies the whole diagram. */
  getData(): PlayData;
  /**
   * Returns the current state without copying. The state is replaced with a new object on every
   * change, so the value received is not rewritten by later changes.
   */
  getSnapshot(): PlayData;
  getFieldZone(): FieldZone;
  /** undefined when absent. Returns the internal value as is, like getSnapshot. */
  findPlayer(id: string): Player | undefined;
  /** undefined when absent. Returns the internal value as is, like getSnapshot. */
  findLine(id: string): Line | undefined;
  /** Same as findPlayer, but throws for an unknown id. */
  getPlayer(id: string): Player;
  /** Same as findLine, but throws for an unknown id. */
  getLine(id: string): Line;
  /**
   * Also moves the LOS to the zone's default position. Players and lines are positioned
   * relative to the LOS, so the whole diagram moves along with it.
   */
  setFieldZone(zone: FieldZone): void;
  /**
   * Throws when given a player whose id already exists.
   * Also throws when the addition would exceed MAX_PLAYERS players.
   */
  addPlayer(player: Player): void;
  /**
   * However many players are added, onDidChange fires only once at the end.
   * Throws without adding anyone if an id duplicates an existing one or MAX_PLAYERS is exceeded.
   */
  addPlayers(players: readonly Player[]): void;
  /** Also removes the lines that start at that player. */
  removePlayer(id: string): PlayerRemoval;
  /**
   * Also removes the lines that start at the removed players; onDidChange fires only once at
   * the end. Throws without removing anyone when an id is unknown or repeated.
   */
  removePlayers(ids: readonly string[]): PlayerRemoval[];
  /**
   * Puts a player and lines removed by removePlayer back into their original order.
   * Throws when a player with the same id already exists, restoring would exceed a limit, or an
   * index points outside the current order.
   */
  restorePlayer(removal: PlayerRemoval): void;
  /** Replaces the player with the same id and returns the player it replaced. */
  updatePlayer(player: Player): Player;
  /**
   * Replaces the whole diagram, field included, in one change, and returns the one it replaced.
   * The data must already be normalized (unique ids, existing start players); throws when it
   * exceeds a limit.
   */
  replaceAll(data: PlayData): PlayData;
  /**
   * Throws when given a line whose id already exists or whose start player does not exist. Also
   * throws when the lines would exceed MAX_LINES, and for a line whose waypoints exceed
   * MAX_WAYPOINTS_PER_LINE.
   */
  addLine(line: Line): void;
  /** index ranges from 0 to the line count; throws outside it, and otherwise as addLine does. */
  insertLine(line: Line, index: number): void;
  removeLine(id: string): LineRemoval;
  /**
   * Replaces the line with the same id and returns the line it replaced. Throws when the
   * waypoints exceed MAX_WAYPOINTS_PER_LINE.
   */
  updateLine(line: Line): Line;
}

// Inserting at an index not from a removal record lets slice silently clamp to the end, hiding an
// order broken by Undo.
function insertAt<T>(items: readonly T[], index: number, item: T, what: string): T[] {
  if (!Number.isInteger(index) || index < 0 || index > items.length) {
    throw new Error(`PlayModel: ${what} index out of range: ${index} (0..${items.length})`);
  }
  return [...items.slice(0, index), item, ...items.slice(index)];
}

// Selection and editing pick their target by id, so two elements never share an id.
function assertNewId(items: readonly { id: string }[], id: string, message: string): void {
  if (items.some((item) => item.id === id)) {
    throw new Error(`${message} "${id}"`);
  }
}

// The count limits match those of external data normalization. If editing could exceed them,
// a diagram written out with getData would be silently truncated when read back.
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
 * Mutating methods replace the state with a new object and then fire onDidChange exactly once.
 * Inputs are taken in without copying. The types are read-only, so neither the input nor the
 * state can be rewritten afterward. An operation on an unknown id is a mistake in how the edit
 * was assembled, so it throws on the spot.
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
    // Fires even for the same zone. The editing side decides not to push a no-op onto the history.
    this.commit({ ...this.state, field: fieldStateForZone(zone) });
  }

  addPlayer(player: Player): void {
    this.addPlayers([player]);
  }

  addPlayers(players: readonly Player[]): void {
    // Throw without adding anyone if even one id is a duplicate. Throwing after adding some would
    // leave a change with neither a notification nor a history entry.
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
        // A line losing its start cannot be drawn; remove it too, noting its index for restore.
        removedLines.push({ line, index: i });
      } else {
        lines.push(line);
      }
    });
    // Removal cannot exceed a limit, so commit is skipped. The caller emits a single notification.
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
    // Throw without removing anyone if even one id cannot be removed. Throwing after removing
    // some would leave a change with neither a notification nor a history entry.
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
    const players = insertAt(this.state.players, removal.index, removal.player, "player");
    // Inserting in ascending order of the original index restores the order before removal.
    let lines = this.state.lines;
    for (const { line, index } of [...removal.removedLines].sort((a, b) => a.index - b.index)) {
      lines = insertAt(lines, index, line, "line");
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

  replaceAll(data: PlayData): PlayData {
    const previous = this.state;
    this.commit(data);
    return previous;
  }

  addLine(line: Line): void {
    this.insertLine(line, this.state.lines.length);
  }

  insertLine(line: Line, index: number): void {
    assertNewId(this.state.lines, line.id, "PlayModel: duplicate line id");
    // A line without its start player is never drawn and cannot be selected, so nothing in the
    // editor could ever remove it again.
    if (this.findPlayer(line.startPlayerId) === undefined) {
      throw new Error(`PlayModel: unknown start player id "${line.startPlayerId}"`);
    }
    this.commit({ ...this.state, lines: insertAt(this.state.lines, index, line, "line") });
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

  // Every change that can grow a count goes through here, so no state ever exceeds a limit.
  private commit(next: PlayData): void {
    assertWithinLimits(next);
    this.state = next;
    this.emitChange();
  }

  private emitChange(): void {
    this._onDidChange.fire(this.state);
  }
}
