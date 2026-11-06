import {
  DEFAULT_PLAYER_FILL,
  Disposable,
  type IEditorUi,
  isLineTool,
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
import { LINE_COLOR_TOKENS, SWATCH_TOKENS } from "../theme/palette.js";
import { createThemeReader } from "../theme/theme-reader.js";
import type { ThemeReader } from "../theme/tokens.js";
import { createButton, replaceKeepingFocus } from "./focus.js";

/** A color offered in the panel, with the name it is shown under. */
interface ColorOption {
  readonly name: string;
  /** The color it sets, or undefined for the theme's default color, which sets no color. */
  readonly value: string | undefined;
}

/**
 * One round color button. An outline swatch colors only its rim; a solid one fills the inside.
 * A swatch with a value is painted in it; the default swatch is painted by paintDefault, because
 * the default color can depend on the selected item.
 */
interface SwatchChoice extends ColorOption {
  readonly fill: PlayerFill;
}

/**
 * Whether a swatch shows the saved color: the default swatch an absent color, any other swatch the
 * same color once normalized like the theme colors. A saved color that cannot be read, which can
 * come from outside, matches no swatch.
 */
function showsColor(choice: ColorOption, color: string | undefined): boolean {
  if (choice.value === undefined) {
    return color === undefined;
  }
  return color !== undefined && normalizeCssColor(color) === choice.value;
}

function paintSwatch(btn: HTMLButtonElement, fill: PlayerFill, color: string): void {
  if (fill === "outline") {
    btn.style.borderColor = color;
  } else {
    btn.style.backgroundColor = color;
  }
}

function createSwatch({ name, fill, value }: SwatchChoice, onClick: () => void): HTMLButtonElement {
  const btn = createButton("playmaker-panel__swatch", "", onClick);
  btn.title = name;
  btn.setAttribute("aria-label", name);
  if (fill === "outline") {
    btn.classList.add("playmaker-panel__swatch--outline");
  }
  if (value !== undefined) {
    paintSwatch(btn, fill, value);
  }
  return btn;
}

/** A row of swatches, with what changes after it is built. */
interface SwatchRow<T extends SwatchChoice> {
  /** Marks as pressed the swatches whose choice isPressed accepts. */
  press(isPressed: (choice: T) => boolean): void;
  /** Repaints the swatches of the theme's default color, which can depend on the selected item. */
  paintDefault(color: string): void;
}

/** The selected item. Selection is single, so the type never has a player and a line at once. */
type SelectedItem =
  | { readonly kind: "player"; readonly player: Player }
  | { readonly kind: "line"; readonly line: Line }
  | { readonly kind: "none" };

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
  // The label input of the player on display, focused when the editor asks for a label.
  private labelInput: HTMLInputElement | undefined;

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
    this._register(controller.onDidRequestLabelEdit(() => this.focusLabel()));
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

  private focusLabel(): void {
    this.labelInput?.focus({ preventScroll: true });
    this.labelInput?.select();
  }

  private rebuild(selected: SelectedItem, hint: string): ShownFields {
    this.element.replaceChildren();
    this.labelInput = undefined;
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
    const setLabel = this.addLabel(messages.label);
    const setShape = this.addChoices(messages.shape, PLAYER_SHAPE_VALUES, messages.shapes, (v) =>
      controller.updateSelectedPlayer({ shape: v }),
    );
    // Eight swatches, outline and solid for the default color and each of the three colors. The
    // top row is outline, the bottom row solid. Instead of a separate "solid or outline" choice,
    // both are picked at once. The default swatches leave the color to the theme, so a player
    // keeps following the host's --playmaker-player-color.
    const read = createThemeReader(this.element);
    const colors = this.colorOptions(read);
    const choices = PLAYER_FILL_VALUES.flatMap((fill) =>
      colors.map(({ name, value }) => ({
        name: messages.swatch(name, messages.fills[fill]),
        fill,
        value,
      })),
    );
    const swatches = this.addSwatches(messages.color, choices, ({ value, fill }) =>
      controller.updateSelectedPlayer({
        color: value ?? null,
        fill: fill === DEFAULT_PLAYER_FILL ? null : fill,
      }),
    );
    swatches.paintDefault(read("playerColor"));
    return (player) => {
      setLabel(player.label);
      setShape(player.shape);
      const fill = player.fill ?? DEFAULT_PLAYER_FILL;
      swatches.press((choice) => showsColor(choice, player.color) && choice.fill === fill);
    };
  }

  private addLineFields(): (line: Line) => void {
    const { controller, messages } = this;
    this.addTitle(messages.line);
    const setKind = this.addChoices(messages.kind, LINE_KIND_VALUES, messages.kinds, (v) =>
      controller.updateSelectedLine({ kind: v }),
    );
    const setInterpolation = this.addChoices(
      messages.interpolation,
      LINE_INTERPOLATION_VALUES,
      messages.interpolations,
      (v) => controller.updateSelectedLine({ interpolation: v }),
    );
    const read = createThemeReader(this.element);
    const choices = this.colorOptions(read).map((color) => ({ ...color, fill: "solid" as const }));
    const swatches = this.addSwatches(messages.color, choices, ({ value }) =>
      controller.updateSelectedLine({ color: value ?? null }),
    );
    this.addHint(messages.bendHint);
    return (line) => {
      setKind(line.kind);
      setInterpolation(line.interpolation);
      // The theme's default color differs by kind, so the default swatch follows the kind.
      swatches.paintDefault(read(LINE_COLOR_TOKENS[line.kind]));
      swatches.press((choice) => showsColor(choice, line.color));
    };
  }

  /** The theme's default color, then the palette colors read from the theme. */
  private colorOptions(read: ThemeReader): ColorOption[] {
    return [
      { name: this.messages.defaultColor, value: undefined },
      ...SWATCH_TOKENS.map((token) => ({ name: this.messages.colors[token], value: read(token) })),
    ];
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

  private addRow(labelText: string, control: HTMLElement): void {
    const label = document.createElement("label");
    label.className = "playmaker-panel__label";
    label.append(this.createRowText(labelText), control);
    this.appendRow([label]);
  }

  /**
   * A row of buttons. Wrapping it in a label would press the first button when the text is clicked,
   * so the group of buttons is named instead.
   */
  private addGroupRow(labelText: string, group: HTMLElement): HTMLElement {
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", labelText);
    return this.appendRow([this.createRowText(labelText), group]);
  }

  private createRowText(text: string): HTMLElement {
    const span = document.createElement("span");
    span.className = "playmaker-panel__row-text";
    span.textContent = text;
    return span;
  }

  private appendRow(children: readonly HTMLElement[]): HTMLElement {
    const row = document.createElement("div");
    row.className = "playmaker-panel__row";
    row.append(...children);
    this.element.appendChild(row);
    return row;
  }

  /**
   * The label input. Typing shows the label on the diagram at once; leaving the input commits it
   * as one edit. Enter commits and hands the keys back to the canvas, so placing the next player
   * needs no click on the canvas first, and Esc drops what was typed. Keys that confirm or cancel
   * an IME conversion are left to the IME.
   */
  private addLabel(label: string): (value: string) => void {
    const { controller } = this;
    const input = document.createElement("input");
    input.type = "text";
    let committed = "";
    input.addEventListener("input", () => controller.previewLabel(input.value));
    input.addEventListener("change", () => controller.updateSelectedPlayer({ label: input.value }));
    input.addEventListener("keydown", (e) => {
      // Safari reports the key that ends an IME conversion with isComposing false, and only
      // keyCode 229 tells it apart.
      if (e.isComposing || e.keyCode === 229) {
        return;
      }
      if (e.key === "Escape") {
        input.value = committed;
        controller.discardLabelDraft();
      }
      if (e.key === "Enter" || e.key === "Escape") {
        // Moving the focus away fires change, which commits a typed label.
        this.focusFallback.focus({ preventScroll: true });
      }
    });
    this.labelInput = input;
    this.addRow(label, input);
    // While a label is typed, the input holds the typing, and the player's committed label must
    // not overwrite it. Any edit commits the typing before the panel is told about it.
    return (value) => {
      if (controller.getViewState().isTypingLabel) {
        return;
      }
      committed = value;
      input.value = value;
    };
  }

  /** A row of color swatches. The chosen choice is passed to onChange. */
  private addSwatches<T extends SwatchChoice>(
    label: string,
    choices: readonly T[],
    onChange: (choice: T) => void,
  ): SwatchRow<T> {
    const group = document.createElement("div");
    group.className = "playmaker-panel__swatches";
    if (choices.some((choice) => choice.fill === "outline")) {
      group.classList.add("playmaker-panel__swatches--rows");
    }
    const swatches = choices.map((choice) => {
      const btn = createSwatch(choice, () => onChange(choice));
      group.appendChild(btn);
      return { btn, choice };
    });
    this.addGroupRow(label, group);
    return {
      press: (isPressed) => {
        for (const { btn, choice } of swatches) {
          btn.setAttribute("aria-pressed", String(isPressed(choice)));
        }
      },
      paintDefault: (color) => {
        for (const { btn, choice } of swatches) {
          if (choice.value === undefined) {
            paintSwatch(btn, choice.fill, color);
          }
        }
      },
    };
  }

  /**
   * A row of buttons, one per option, with the current one pressed. With two or three options,
   * buttons show every choice at once and take one click, where a dropdown takes two.
   */
  private addChoices<T extends string>(
    labelText: string,
    options: readonly T[],
    optionLabels: Readonly<Record<T, string>>,
    onChange: (v: T) => void,
  ): (value: T) => void {
    const group = document.createElement("div");
    group.className = "playmaker-panel__choices";
    const buttons = options.map((option) => {
      const btn = createButton("playmaker-panel__choice", optionLabels[option], () =>
        onChange(option),
      );
      group.appendChild(btn);
      return { btn, option };
    });
    // The buttons take the full width under their name, which a 220px panel needs for three.
    this.addGroupRow(labelText, group).classList.add("playmaker-panel__row--stacked");
    return (value) => {
      for (const { btn, option } of buttons) {
        btn.setAttribute("aria-pressed", String(option === value));
      }
    };
  }
}
