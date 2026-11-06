import {
  Disposable,
  EDITOR_TOOL_VALUES,
  type EditorTool,
  FIELD_ZONE_VALUES,
  type FieldZone,
  type IEditorUi,
  isToolAvailable,
  MAX_LINES,
  MAX_PLAYERS,
  toDisposable,
} from "../../common/index.js";
import type { Messages } from "../i18n/index.js";

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
  // Text shown as the reason on parts that cannot be pressed because a count limit is reached.
  private readonly toolUnavailableReasons: Readonly<Partial<Record<EditorTool, string>>>;

  constructor(parent: HTMLElement, controller: IEditorUi, messages: Messages) {
    super();
    this.toolUnavailableReasons = {
      "add-player": messages.playerLimit(MAX_PLAYERS),
      "draw-line": messages.lineLimit(MAX_LINES),
    };
    this.element = document.createElement("div");
    this.element.className = "playmaker-toolbar";

    for (const tool of EDITOR_TOOL_VALUES) {
      const btn = this.addButton(messages.tool[tool], () => controller.setTool(tool));
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
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = "playmaker-toolbar__button";
    button.addEventListener("click", () => {
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

  private sync(controller: IEditorUi): void {
    const state = controller.getViewState();
    for (const [tool, btn] of this.toolButtons) {
      btn.setAttribute("aria-pressed", String(tool === state.tool));
      setEnabled(btn, isToolAvailable(tool, state), this.toolUnavailableReasons[tool]);
    }
    for (const [zone, btn] of this.zoneButtons) {
      btn.setAttribute("aria-pressed", String(zone === state.fieldZone));
    }
    setEnabled(this.undoButton, state.canUndo);
    setEnabled(this.redoButton, state.canRedo);
    setEnabled(this.deleteButton, state.selection.kind !== "none");
  }
}
