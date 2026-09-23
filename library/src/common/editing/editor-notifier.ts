import { Emitter } from "../base/event.js";
import { Disposable } from "../base/lifecycle.js";
import type { Line } from "../model/line.js";
import type { Player } from "../model/player.js";
import { type EditorViewState, isSameSelection } from "./editor.js";

/** onDidChangeViewState を出すかどうかを決めるための、UI が読む値の組。 */
export interface ViewSnapshot {
  readonly state: EditorViewState;
  readonly player: Player | undefined;
  readonly line: Line | undefined;
}

// 表示状態の項目ごとの比べ方。項目を足すとここが型エラーになり、比べ忘れを防ぐ。
const VIEW_STATE_EQUALS: {
  readonly [K in keyof EditorViewState]: (a: EditorViewState[K], b: EditorViewState[K]) => boolean;
} = {
  tool: Object.is,
  selection: isSameSelection,
  canUndo: Object.is,
  canRedo: Object.is,
  fieldZone: Object.is,
  isDrawing: Object.is,
};

const VIEW_STATE_KEYS = Object.keys(VIEW_STATE_EQUALS) as (keyof EditorViewState)[];

function isSameEntry<K extends keyof EditorViewState>(
  key: K,
  a: EditorViewState,
  b: EditorViewState,
): boolean {
  return VIEW_STATE_EQUALS[key](a[key], b[key]);
}

// 選手と線は変更のたびに差し替わるので、参照で比べれば値の変化が分かる。
function isSameView(a: ViewSnapshot, b: ViewSnapshot): boolean {
  return (
    VIEW_STATE_KEYS.every((key) => isSameEntry(key, a.state, b.state)) &&
    a.player === b.player &&
    a.line === b.line
  );
}

/**
 * 描く図と表示状態の通知を出し分ける。batch の中で何度変わっても、通知は
 * batch の終わりに 1 回ずつにまとめる。Model はコマンドの apply の中で通知するので、
 * そのまま転送すると購読側が更新前の canUndo / canRedo を読んでしまう。
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

  batch(action: () => void): void {
    this.depth++;
    try {
      action();
    } finally {
      this.depth--;
    }
    this.flushIfIdle();
  }

  markSceneChanged(): void {
    this.sceneChanged = true;
    this.flushIfIdle();
  }

  /** 表示状態は通知の前に読み直して前回と比べるので、変わったかもしれないときに呼べばよい。 */
  markViewStateChanged(): void {
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
