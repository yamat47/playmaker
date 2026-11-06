import { Emitter } from "../base/event.js";
import { Disposable } from "../base/lifecycle.js";
import type { Line } from "../model/line.js";
import type { Player } from "../model/player.js";
import { type EditorViewState, isSameSelection } from "./editor.js";

/**
 * A view state notification is sent only when this set of values differs from the one at the
 * last notification (or at construction, if nothing has been notified yet).
 */
interface ViewSnapshot {
  readonly state: EditorViewState;
  readonly player: Player | undefined;
  readonly line: Line | undefined;
}

// How each entry of the view state is compared. Adding an entry makes this a type error until
// its comparison is written.
const VIEW_STATE_EQUALS: {
  readonly [K in keyof EditorViewState]: (a: EditorViewState[K], b: EditorViewState[K]) => boolean;
} = {
  tool: Object.is,
  selection: isSameSelection,
  canUndo: Object.is,
  canRedo: Object.is,
  fieldZone: Object.is,
  isDrawing: Object.is,
  isTypingLabel: Object.is,
  remainingPlayerSlots: Object.is,
  canStartLine: Object.is,
};

const VIEW_STATE_KEYS = Object.keys(VIEW_STATE_EQUALS) as (keyof EditorViewState)[];

function isSameEntry<K extends keyof EditorViewState>(
  key: K,
  a: EditorViewState,
  b: EditorViewState,
): boolean {
  return VIEW_STATE_EQUALS[key](a[key], b[key]);
}

// Players and lines are replaced on every change, so a reference comparison detects value changes.
function isSameView(a: ViewSnapshot, b: ViewSnapshot): boolean {
  return (
    VIEW_STATE_KEYS.every((key) => isSameEntry(key, a.state, b.state)) &&
    a.player === b.player &&
    a.line === b.line
  );
}

/**
 * Sends separate notifications for the drawn diagram and the view state. No matter how many
 * changes happen inside a batch, the notifications are coalesced into one of each at the end of
 * the batch. The Model notifies inside a command's apply, so forwarding that as is would let
 * subscribers read canUndo / canRedo before they are updated.
 */
export class EditorNotifier extends Disposable {
  private readonly _onDidChangeScene = this._register(new Emitter<void>());
  readonly onDidChangeScene = this._onDidChangeScene.event;
  private readonly _onDidChangeViewState = this._register(new Emitter<void>());
  readonly onDidChangeViewState = this._onDidChangeViewState.event;

  private readonly readView: () => ViewSnapshot;
  private depth = 0;
  private sceneChanged = false;
  private lastView: ViewSnapshot;

  constructor(readView: () => ViewSnapshot) {
    super();
    this.readView = readView;
    this.lastView = readView();
  }

  batch<T>(action: () => T): T {
    this.depth++;
    let result: T;
    try {
      result = action();
    } finally {
      this.depth--;
    }
    this.flushIfIdle();
    return result;
  }

  markSceneChanged(): void {
    this.sceneChanged = true;
    this.flushIfIdle();
  }

  private flushIfIdle(): void {
    if (this.depth === 0) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.sceneChanged) {
      this.sceneChanged = false;
      this._onDidChangeScene.fire();
    }
    const view = this.readView();
    if (!isSameView(view, this.lastView)) {
      this.lastView = view;
      this._onDidChangeViewState.fire();
    }
  }
}
