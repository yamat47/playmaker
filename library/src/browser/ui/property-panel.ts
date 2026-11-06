import {
  DEFAULT_PLAYER_FILL,
  Disposable,
  type IEditorUi,
  isLineTool,
  isOneOf,
  LINE_INTERPOLATION_VALUES,
  LINE_KIND_VALUES,
  type Line,
  PLAYER_FILL_VALUES,
  PLAYER_SHAPE_VALUES,
  type Player,
  type PlayerFill,
  toDisposable,
} from "../../common/index.js";
import type { Messages } from "../i18n/index.js";
import { normalizeCssColor } from "../theme/css-color.js";
import { SWATCH_TOKENS } from "../theme/palette.js";
import { createThemeReader } from "../theme/theme-reader.js";
import { replaceKeepingFocus } from "./focus.js";

/** One round color button. An outline swatch colors only its rim; a solid one fills the inside. */
interface SwatchChoice {
  readonly name: string;
  readonly color: string;
  readonly fill: PlayerFill;
}

function createSwatch({ name, color, fill }: SwatchChoice): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "playmaker-panel__swatch";
  btn.title = name;
  btn.setAttribute("aria-label", name);
  if (fill === "outline") {
    btn.classList.add("playmaker-panel__swatch--outline");
    btn.style.borderColor = color;
  } else {
    btn.style.backgroundColor = color;
  }
  return btn;
}

/** The selected item. Selection is single, so the type never has a player and a line at once. */
type SelectedItem =
  | { readonly kind: "player"; readonly player: Player }
  | { readonly kind: "line"; readonly line: Line }
  | { readonly kind: "none" };

/**
 * The values passed to an input and the function called when the value changes. Passing onReset
 * adds a button that restores the default.
 */
interface InputOptions<T> {
  readonly label: string;
  readonly onChange: (value: T) => void;
  readonly onReset?: () => void;
}

/** The inputs on display, and the function that writes the selected item's values into them. */
type ShownFields =
  | { readonly kind: "player"; readonly id: string; readonly update: (player: Player) => void }
  | { readonly kind: "line"; readonly id: string; readonly update: (line: Line) => void }
  | { readonly kind: "hint"; readonly text: string };

export class PropertyPanel extends Disposable {
  readonly element: HTMLElement;
  private readonly controller: IEditorUi;
  private readonly focusFallback: HTMLElement;
  private readonly messages: Messages;
  // While the selected item stays the same, the inputs are kept and only their values are written.
  // Rebuilding them would remove the input Tab just moved to after a commit, and drop the focus.
  private shown: ShownFields | undefined;

  /**
   * @param focusFallback Where the focus goes when a selection change rebuilds the inputs and
   *   removes the input that had it.
   */
  constructor(
    parent: HTMLElement,
    controller: IEditorUi,
    focusFallback: HTMLElement,
    messages: Messages,
  ) {
    super();
    this.controller = controller;
    this.focusFallback = focusFallback;
    this.messages = messages;
    this.element = document.createElement("div");
    this.element.className = "playmaker-panel";

    parent.appendChild(this.element);
    this._register(toDisposable(() => this.element.remove()));
    this._register(controller.onDidChangeViewState(() => this.sync()));
    this.sync();
  }

  /**
   * The default colors and swatches are read from the theme variables, so a call after the host
   * changes the variables picks up the change.
   */
  refresh(): void {
    this.shown = undefined;
    this.sync();
  }

  private sync(): void {
    const selected = this.selectedItem();
    const shown = this.shown;
    if (selected.kind === "player" && shown?.kind === "player" && shown.id === selected.player.id) {
      shown.update(selected.player);
      return;
    }
    if (selected.kind === "line" && shown?.kind === "line" && shown.id === selected.line.id) {
      shown.update(selected.line);
      return;
    }
    const hint = this.hintText();
    if (selected.kind === "none" && shown?.kind === "hint" && shown.text === hint) {
      return;
    }
    replaceKeepingFocus(this.element, this.focusFallback, () => {
      this.shown = this.rebuild(selected, hint);
    });
  }

  // Starting a drawing clears the selection, so while a line is drawn the panel always shows a
  // hint, and it says how to finish the line. With a line tool chosen it says how to start one.
  private hintText(): string {
    const { isDrawing, tool } = this.controller.getViewState();
    if (isDrawing) {
      return this.messages.drawingHint;
    }
    return isLineTool(tool) ? this.messages.lineToolHint : this.messages.selectionHint;
  }

  private selectedItem(): SelectedItem {
    const player = this.controller.getSelectedPlayer();
    if (player !== undefined) {
      return { kind: "player", player };
    }
    const line = this.controller.getSelectedLine();
    if (line !== undefined) {
      return { kind: "line", line };
    }
    return { kind: "none" };
  }

  private rebuild(selected: SelectedItem, hint: string): ShownFields {
    this.element.replaceChildren();
    switch (selected.kind) {
      case "player": {
        const update = this.addPlayerFields();
        update(selected.player);
        return { kind: "player", id: selected.player.id, update };
      }
      case "line": {
        const update = this.addLineFields();
        update(selected.line);
        return { kind: "line", id: selected.line.id, update };
      }
      case "none":
        this.addHint(hint);
        return { kind: "hint", text: hint };
    }
  }

  private addPlayerFields(): (player: Player) => void {
    const { controller, messages } = this;
    this.addTitle(messages.player);
    const setLabel = this.addText({
      label: messages.label,
      onChange: (v) => controller.updateSelectedPlayer({ label: v }),
    });
    const setShape = this.addSelect(messages.shape, PLAYER_SHAPE_VALUES, messages.shapes, (v) =>
      controller.updateSelectedPlayer({ shape: v }),
    );
    // Eight swatches, outline and solid for each of the four colors. The top row is outline, the
    // bottom row solid. Instead of a separate "solid or outline" choice, both are picked at once.
    const read = createThemeReader(this.element);
    const choices = PLAYER_FILL_VALUES.flatMap((fill) =>
      SWATCH_TOKENS.map((token) => ({
        name: messages.swatch(messages.colors[token], messages.fills[fill]),
        color: read(token),
        fill,
      })),
    );
    const setPressed = this.addSwatches(messages.color, choices, {
      onChange: ({ color, fill }) => controller.updateSelectedPlayer({ color, fill }),
      onReset: () => controller.updateSelectedPlayer({ color: null, fill: null }),
    });
    // A player with no color shows the outline swatch of the theme's default color as pressed.
    const defaultColor = read("playerColor");
    return (player) => {
      setLabel(player.label);
      setShape(player.shape);
      const color = player.color === undefined ? defaultColor : normalizeCssColor(player.color);
      const fill = player.fill ?? DEFAULT_PLAYER_FILL;
      setPressed((choice) => choice.color === color && choice.fill === fill);
    };
  }

  private addLineFields(): (line: Line) => void {
    const { controller, messages } = this;
    this.addTitle(messages.line);
    const setKind = this.addSelect(messages.kind, LINE_KIND_VALUES, messages.kinds, (v) =>
      controller.updateSelectedLine({ kind: v }),
    );
    const setInterpolation = this.addSelect(
      messages.interpolation,
      LINE_INTERPOLATION_VALUES,
      messages.interpolations,
      (v) => controller.updateSelectedLine({ interpolation: v }),
    );
    const read = createThemeReader(this.element);
    const choices = SWATCH_TOKENS.map((token) => ({
      name: messages.colors[token],
      color: read(token),
      fill: "solid" as const,
    }));
    const setPressed = this.addSwatches(messages.color, choices, {
      onChange: ({ color }) => controller.updateSelectedLine({ color }),
      onReset: () => controller.updateSelectedLine({ color: null }),
    });
    this.addHint(messages.bendHint);
    return (line) => {
      setKind(line.kind);
      setInterpolation(line.interpolation);
      // A saved color may come from outside, so it is normalized like the theme colors to compare.
      const color = line.color === undefined ? undefined : normalizeCssColor(line.color);
      setPressed((choice) => choice.color === color);
    };
  }

  private addHint(text: string): void {
    const paragraph = document.createElement("p");
    paragraph.className = "playmaker-panel__hint";
    paragraph.textContent = text;
    this.element.appendChild(paragraph);
  }

  private addTitle(text: string): void {
    const h = document.createElement("h2");
    h.className = "playmaker-panel__title";
    h.textContent = text;
    this.element.appendChild(h);
  }

  private addRow(labelText: string, control: HTMLElement, onReset?: () => void): void {
    const label = document.createElement("label");
    label.className = "playmaker-panel__label";
    label.append(this.createRowText(labelText), control);
    this.appendRow(labelText, [label], onReset);
  }

  /**
   * A row of buttons. Wrapping it in a label would press the first button when the text is clicked,
   * so the group of buttons is named instead.
   */
  private addGroupRow(
    labelText: string,
    group: HTMLElement,
    onReset: (() => void) | undefined,
  ): void {
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", labelText);
    this.appendRow(labelText, [this.createRowText(labelText), group], onReset);
  }

  private createRowText(text: string): HTMLElement {
    const span = document.createElement("span");
    span.className = "playmaker-panel__row-text";
    span.textContent = text;
    return span;
  }

  /**
   * With onReset, a button that clears the value back to the theme default ends the row.
   * It stays enabled even at the default; disabling it right after a press drops the focus to body.
   */
  private appendRow(
    labelText: string,
    children: readonly HTMLElement[],
    onReset: (() => void) | undefined,
  ): void {
    const row = document.createElement("div");
    row.className = "playmaker-panel__row";
    row.append(...children);
    if (onReset !== undefined) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "playmaker-panel__reset";
      reset.textContent = this.messages.reset;
      reset.setAttribute("aria-label", this.messages.resetField(labelText));
      reset.addEventListener("click", onReset);
      row.appendChild(reset);
    }
    this.element.appendChild(row);
  }

  private addText({ label, onChange, onReset }: InputOptions<string>): (value: string) => void {
    const input = document.createElement("input");
    input.type = "text";
    input.addEventListener("change", () => onChange(input.value));
    this.addRow(label, input, onReset);
    return (value) => {
      input.value = value;
    };
  }

  /**
   * A row of color swatches. The chosen choice is passed to onChange.
   * The returned function takes a predicate for the pressed choice, to match the selected item.
   */
  private addSwatches<T extends SwatchChoice>(
    label: string,
    choices: readonly T[],
    { onChange, onReset }: Omit<InputOptions<T>, "label">,
  ): (isPressed: (choice: T) => boolean) => void {
    const group = document.createElement("div");
    group.className = "playmaker-panel__swatches";
    if (choices.some((choice) => choice.fill === "outline")) {
      group.classList.add("playmaker-panel__swatches--rows");
    }
    const swatches = choices.map((choice) => {
      const btn = createSwatch(choice);
      btn.addEventListener("click", () => onChange(choice));
      group.appendChild(btn);
      return { btn, choice };
    });
    this.addGroupRow(label, group, onReset);
    return (isPressed) => {
      for (const { btn, choice } of swatches) {
        btn.setAttribute("aria-pressed", String(isPressed(choice)));
      }
    };
  }

  private addSelect<T extends string>(
    labelText: string,
    options: readonly T[],
    optionLabels: Readonly<Record<T, string>>,
    onChange: (v: T) => void,
  ): (value: T) => void {
    const select = document.createElement("select");
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = optionLabels[opt];
      select.appendChild(o);
    }
    select.addEventListener("change", () => {
      if (isOneOf(select.value, options)) {
        onChange(select.value);
      }
    });
    this.addRow(labelText, select);
    return (value) => {
      select.value = value;
    };
  }
}
