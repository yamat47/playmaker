import { type Mock, vi } from "vitest";
import type { IEditorController } from "../common/editing/editor.js";
import { PlaySession } from "../common/editing/play-session.js";
import type { PlayData } from "../common/model/play-data.js";
import type { FieldPosition } from "../common/model/player.js";

export function yd(lateralYard: number, downfieldYard: number): FieldPosition {
  return { lateralYard, downfieldYard };
}

export type EditorNotification = "scene" | "view";

export interface PlayDriver {
  readonly session: PlaySession;
  /** setPlayData で作り直したあとは、新しい controller を返す。 */
  readonly editor: IEditorController;
  /** session の onDidChange に渡った図。 */
  readonly onChange: Mock<(data: PlayData) => void>;
  /** controller が出した通知を、出た順に記録する。setPlayData のあとも記録し続ける。 */
  readonly notified: Mock<(kind: EditorNotification) => void>;
  /** 同じ位置で押して離す。 */
  click(at: FieldPosition): void;
  /** from で押し、to まで動かして離す。 */
  drag(from: FieldPosition, to: FieldPosition): void;
  /** 作図ツールに切り替え、from にいる選手を押して描き始める。 */
  startLine(from: FieldPosition): void;
}

/** 仕様テストの入口。利用者がする操作をヤード座標で行い、図、表示状態、通知を観測する。 */
export function openPlay(data: unknown): PlayDriver {
  const session = new PlaySession(data);
  const onChange = vi.fn<(data: PlayData) => void>();
  session.onDidChange(onChange);
  const notified = vi.fn<(kind: EditorNotification) => void>();
  const listen = (): void => {
    session.controller.onDidChangeScene(() => notified("scene"));
    session.controller.onDidChangeViewState(() => notified("view"));
  };
  listen();
  session.onDidReset(listen);

  return {
    session,
    get editor() {
      return session.controller;
    },
    onChange,
    notified,
    click(at) {
      session.controller.pointerDown(at);
      session.controller.pointerUp(at);
    },
    drag(from, to) {
      session.controller.pointerDown(from);
      session.controller.pointerMove(to);
      session.controller.pointerUp(to);
    },
    startLine(from) {
      session.controller.setTool("draw-line");
      session.controller.pointerDown(from);
    },
  };
}
