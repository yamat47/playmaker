import {
  canLoadFormation,
  Disposable,
  EDITOR_TOOL_VALUES,
  type EditorTool,
  type EditorViewState,
  FIELD_ZONE_VALUES,
  type FieldZone,
  FORMATION_PRESETS,
  getFormationPreset,
  type IEditorUi,
  isToolAvailable,
  MAX_LINES,
  MAX_PLAYERS,
  TEAM_SIDE_VALUES,
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
  setTitle(button, enabled ? undefined : reason);
}

function setTitle(element: HTMLElement, title: string | undefined): void {
  if (title === undefined) {
    element.removeAttribute("title");
  } else {
    element.title = title;
  }
}

export class Toolbar extends Disposable {
  readonly element: HTMLElement;
  private readonly messages: Messages;
  private readonly toolButtons = new Map<EditorTool, HTMLButtonElement>();
  private readonly zoneButtons = new Map<FieldZone, HTMLButtonElement>();
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly formationPicker: HTMLSelectElement;
  // Text shown as the reason on parts that cannot be pressed because a count limit is reached.
  private readonly toolUnavailableReasons: Readonly<Partial<Record<EditorTool, string>>>;

  constructor(parent: HTMLElement, controller: IEditorUi, messages: Messages) {
    super();
    this.messages = messages;
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
    this.addSeparator();
    this.formationPicker = this.addFormationPicker(controller);

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

  /**
   * Returns to the placeholder after a choice. If the chosen formation stayed displayed,
   * choosing the same formation again would not fire change, so it could not be layered again.
   */
  private addFormationPicker(controller: IEditorUi): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "playmaker-toolbar__select";
    select.setAttribute("aria-label", this.messages.formation);

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = this.messages.loadFormation;
    select.appendChild(placeholder);

    for (const side of TEAM_SIDE_VALUES) {
      const group = document.createElement("optgroup");
      group.label = this.messages.side[side];
      for (const formation of FORMATION_PRESETS.filter((f) => f.side === side)) {
        const option = document.createElement("option");
        option.value = formation.id;
        option.textContent = formation.name;
        group.appendChild(option);
      }
      select.appendChild(group);
    }

    select.addEventListener("change", () => {
      const preset = getFormationPreset(select.value);
      if (preset !== undefined) {
        controller.loadFormation(preset);
      }
      select.value = "";
    });

    this.element.appendChild(select);
    return select;
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
    this.syncFormationPicker(state);
  }

  private syncFormationPicker(state: EditorViewState): void {
    let isAnyUnavailable = false;
    for (const option of this.formationPicker.options) {
      const formation = getFormationPreset(option.value);
      option.disabled = formation !== undefined && !canLoadFormation(formation, state);
      isAnyUnavailable ||= option.disabled;
    }
    setTitle(
      this.formationPicker,
      isAnyUnavailable ? this.messages.formationLimit(MAX_PLAYERS) : undefined,
    );
  }
}
