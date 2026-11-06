import {
  Disposable,
  EDITOR_TOOL_VALUES,
  type EditorTool,
  FIELD_ZONE_VALUES,
  type FieldZone,
  type IEditorUi,
  isLineTool,
  isToolAvailable,
  MAX_LINES,
  MAX_PLAYERS,
  toDisposable,
} from "../../common/index.js";
import type { Messages } from "../i18n/index.js";
import { createButton } from "./focus.js";

/**
 * Disabled state is shown with aria-disabled, not disabled. With disabled, focus falls to the
 * body from a button that became disabled right after it was pressed, and the shortcuts
 * received inside the editing UI stop working.
 */
function setEnabled(button: HTMLButtonElement, enabled: boolean, reason?: string): void {
  button.setAttribute("aria-disabled", String(!enabled));
  if (!enabled && reason !== undefined) {
    button.title = reason;
  } else {
    button.removeAttribute("title");
  }
}

export class Toolbar extends Disposable {
  readonly element: HTMLElement;
  private readonly toolButtons = new Map<EditorTool, HTMLButtonElement>();
  private readonly zoneButtons = new Map<FieldZone, HTMLButtonElement>();
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly messages: Messages;

  constructor(parent: HTMLElement, controller: IEditorUi, messages: Messages) {
    super();
    this.messages = messages;
    this.element = document.createElement("div");
    this.element.className = "playmaker-toolbar";

    for (const tool of EDITOR_TOOL_VALUES) {
      // A line tool is named after the kind of line it draws, as the panel names that kind.
      const label = isLineTool(tool) ? messages.kinds[tool] : messages.tool[tool];
      const btn = this.addButton(label, () => controller.setTool(tool));
      this.toolButtons.set(tool, btn);
    }
    this.addSeparator();
    this.undoButton = this.addButton(messages.undo, () => controller.undo());
    this.redoButton = this.addButton(messages.redo, () => controller.redo());
    this.deleteButton = this.addButton(messages.delete, () => controller.deleteSelection());
    this.addSeparator();
    for (const zone of FIELD_ZONE_VALUES) {
      const btn = this.addButton(messages.zone[zone], () => controller.setFieldZone(zone));
      this.zoneButtons.set(zone, btn);
    }

    parent.appendChild(this.element);
    this._register(toDisposable(() => this.element.remove()));
    this._register(controller.onDidChangeViewState(() => this.sync(controller)));
    this.sync(controller);
  }

  private addButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = createButton("playmaker-toolbar__button", label, () => {
      if (button.getAttribute("aria-disabled") !== "true") {
        onClick();
      }
    });
    this.element.appendChild(button);
    return button;
  }

  private addSeparator(): void {
    const sep = document.createElement("span");
    sep.className = "playmaker-toolbar__sep";
    sep.setAttribute("aria-hidden", "true");
    this.element.appendChild(sep);
  }

  /** Why a tool cannot be pressed when a count limit is reached. */
  private unavailableReason(tool: EditorTool): string | undefined {
    if (isLineTool(tool)) {
      return this.messages.lineLimit(MAX_LINES);
    }
    return tool === "add-player" ? this.messages.playerLimit(MAX_PLAYERS) : undefined;
  }

  private sync(controller: IEditorUi): void {
    const state = controller.getViewState();
    for (const [tool, btn] of this.toolButtons) {
      btn.setAttribute("aria-pressed", String(tool === state.tool));
      setEnabled(btn, isToolAvailable(tool, state), this.unavailableReason(tool));
    }
    for (const [zone, btn] of this.zoneButtons) {
      btn.setAttribute("aria-pressed", String(zone === state.fieldZone));
    }
    setEnabled(this.undoButton, state.canUndo);
    setEnabled(this.redoButton, state.canRedo);
    setEnabled(this.deleteButton, state.selection.kind !== "none");
  }
}
