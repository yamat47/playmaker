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
  /** Returns the new controller after setPlayData rebuilds it. */
  readonly editor: IEditorController;
  /** The diagrams passed to the session's onDidChange. */
  readonly onChange: Mock<(data: PlayData) => void>;
  /** Records the session's redraw and view state notifications in the order they fire. */
  readonly notified: Mock<(kind: EditorNotification) => void>;
  /** Presses and releases at the same position. */
  click(at: FieldPosition): void;
  /** Presses at `from`, moves to `to`, and releases. */
  drag(from: FieldPosition, to: FieldPosition): void;
  /** Switches to the draw-line tool and presses the player at `from` to start drawing. */
  startLine(from: FieldPosition): void;
}

/**
 * Entry point for specification tests. Performs the consumer's operations in yard coordinates
 * and observes the diagram, the view state, and the notifications.
 */
export function openPlay(data: unknown): PlayDriver {
  const session = new PlaySession(data);
  const onChange = vi.fn<(data: PlayData) => void>();
  session.onDidChange(onChange);
  const notified = vi.fn<(kind: EditorNotification) => void>();
  session.onDidChangeScene(() => notified("scene"));
  session.onDidChangeViewState(() => notified("view"));

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
