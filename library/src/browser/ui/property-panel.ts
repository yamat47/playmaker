import {
  DEFAULT_LINE_THICKNESS,
  DEFAULT_PLAYER_FILL,
  Disposable,
  type IEditorUi,
  isLineThickness,
  isOneOf,
  LINE_INTERPOLATION_VALUES,
  LINE_KIND_VALUES,
  type Line,
  type LineInterpolation,
  type LineKind,
  PLAYER_FILL_VALUES,
  PLAYER_SHAPE_VALUES,
  type Player,
  type PlayerFill,
  type PlayerShape,
  toDisposable,
} from "../../common/index.js";
import { normalizeCssColor } from "../theme/css-color.js";
import { COLOR_PALETTE } from "../theme/palette.js";
import { createThemeReader } from "../theme/theme-reader.js";
import { replaceKeepingFocus } from "./focus.js";

const SHAPE_LABELS = {
  circle: "丸",
  square: "四角",
} satisfies Record<PlayerShape, string>;

const FILL_LABELS = {
  outline: "枠線",
  solid: "塗りつぶし",
} satisfies Record<PlayerFill, string>;

const KIND_LABELS = {
  route: "ルート",
  block: "ブロック",
  motion: "モーション",
} satisfies Record<LineKind, string>;

const INTERPOLATION_LABELS = {
  straight: "直線",
  bezier: "曲線",
} satisfies Record<LineInterpolation, string>;

/** 色を選ぶ丸いボタン 1 つ分。枠線のスウォッチは縁だけを色にし、塗りつぶしは中まで塗る。 */
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

/** 選択中の要素。選択は 1 つなので、選手と線が同時に来ることは型で起こらない。 */
type SelectedItem =
  | { readonly kind: "player"; readonly player: Player }
  | { readonly kind: "line"; readonly line: Line }
  | { readonly kind: "none" };

/** 入力に渡す値と、値が変わったときに呼ぶ関数。onReset を渡すと、既定に戻すボタンが付く。 */
interface InputOptions<T> {
  readonly label: string;
  readonly onChange: (value: T) => void;
  readonly onReset?: () => void;
}

/** 表示中の入力と、選択中の要素の値をその入力に書き込む関数。 */
type ShownFields =
  | { readonly kind: "player"; readonly id: string; readonly update: (player: Player) => void }
  | { readonly kind: "line"; readonly id: string; readonly update: (line: Line) => void }
  | { readonly kind: "hint" };

export class PropertyPanel extends Disposable {
  readonly element: HTMLElement;
  private readonly controller: IEditorUi;
  private readonly focusFallback: HTMLElement;
  // 選択中の要素が同じあいだは入力を作り直さず、値だけを書き込む。作り直すと、
  // 値を確定して Tab で次の入力へ移った直後に、移った先の入力ごと消えてフォーカスが外れる。
  private shown: ShownFields | undefined;

  /**
   * @param focusFallback 選択が変わって入力を作り直したときに、消えた入力にあったフォーカスを移す先。
   */
  constructor(parent: HTMLElement, controller: IEditorUi, focusFallback: HTMLElement) {
    super();
    this.controller = controller;
    this.focusFallback = focusFallback;
    this.element = document.createElement("div");
    this.element.className = "playmaker-panel";

    parent.appendChild(this.element);
    this._register(toDisposable(() => this.element.remove()));
    this._register(controller.onDidChangeViewState(() => this.sync()));
    this.sync();
  }

  /** 色の既定値とスウォッチはテーマ変数から読むので、ホストが変数を変えたあとに呼べば反映される。 */
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
    if (selected.kind === "none" && shown?.kind === "hint") {
      return;
    }
    replaceKeepingFocus(this.element, this.focusFallback, () => {
      this.shown = this.rebuild(selected);
    });
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

  private rebuild(selected: SelectedItem): ShownFields {
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
      case "none": {
        const hint = document.createElement("p");
        hint.className = "playmaker-panel__hint";
        hint.textContent = "対象を選択するとプロパティを編集できます";
        this.element.appendChild(hint);
        return { kind: "hint" };
      }
    }
  }

  private addPlayerFields(): (player: Player) => void {
    const controller = this.controller;
    this.addTitle("選手");
    const setLabel = this.addText({
      label: "ラベル",
      onChange: (v) => controller.updateSelectedPlayer({ label: v }),
    });
    const setShape = this.addSelect("形状", PLAYER_SHAPE_VALUES, SHAPE_LABELS, (v) =>
      controller.updateSelectedPlayer({ shape: v }),
    );
    // 4 色それぞれの枠線と塗りつぶしを並べた 8 つのスウォッチ。上の段が枠線、下の段が塗りつぶし。
    // 「塗りつぶしか枠線か」を別の選択肢にせず、色と一緒に 1 回で選べるようにする。
    const read = createThemeReader(this.element);
    const choices = PLAYER_FILL_VALUES.flatMap((fill) =>
      COLOR_PALETTE.map((opt) => ({
        name: `${opt.label}の${FILL_LABELS[fill]}`,
        color: read(opt.token),
        fill,
      })),
    );
    const setPressed = this.addSwatches("色", choices, {
      onChange: ({ color, fill }) => controller.updateSelectedPlayer({ color, fill }),
      onReset: () => controller.updateSelectedPlayer({ color: null, fill: null }),
    });
    // 色を省いた選手は、テーマの既定色の枠線のスウォッチが押された状態になる。
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
    const controller = this.controller;
    this.addTitle("線");
    const setKind = this.addSelect("種別", LINE_KIND_VALUES, KIND_LABELS, (v) =>
      controller.updateSelectedLine({ kind: v }),
    );
    const setInterpolation = this.addSelect(
      "補間",
      LINE_INTERPOLATION_VALUES,
      INTERPOLATION_LABELS,
      (v) => controller.updateSelectedLine({ interpolation: v }),
    );
    const read = createThemeReader(this.element);
    const choices = COLOR_PALETTE.map((opt) => ({
      name: opt.label,
      color: read(opt.token),
      fill: "solid" as const,
    }));
    const setPressed = this.addSwatches("色", choices, {
      onChange: ({ color }) => controller.updateSelectedLine({ color }),
      onReset: () => controller.updateSelectedLine({ color: null }),
    });
    const setThickness = this.addNumber({
      label: "太さ",
      onChange: (v) => controller.updateSelectedLine({ thickness: v }),
      onReset: () => controller.updateSelectedLine({ thickness: null }),
    });
    return (line) => {
      setKind(line.kind);
      setInterpolation(line.interpolation);
      // 保存済みの色は外から渡されたデータのこともあるので、テーマの色と同じ書き方にそろえて比べる。
      const color = line.color === undefined ? undefined : normalizeCssColor(line.color);
      setPressed((choice) => choice.color === color);
      setThickness(line.thickness ?? DEFAULT_LINE_THICKNESS);
    };
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
   * ボタンを並べた行。label で包むと、文字を押したときに先頭のボタンが押されるので、
   * ボタンの組に名前を付ける。
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
   * onReset を渡すと、値を消してテーマの既定に戻すボタンを行の末尾に置く。
   * 既定のときもボタンは押せるままにする。押した直後に無効にすると、フォーカスが body へ落ちる。
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
      reset.textContent = "既定";
      reset.setAttribute("aria-label", `${labelText}を既定に戻す`);
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

  private addNumber({ label, onChange, onReset }: InputOptions<number>): (value: number) => void {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0.25";
    input.step = "0.25";
    input.addEventListener("change", () => {
      const n = Number(input.value);
      if (isLineThickness(n)) {
        onChange(n);
      }
    });
    this.addRow(label, input, onReset);
    return (value) => {
      input.value = String(value);
    };
  }

  /**
   * 色のスウォッチを並べた行。選んだ choice を onChange に渡す。
   * 返す関数に、押された状態にする choice の判定を渡して、表示を選択中の要素に合わせる。
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
