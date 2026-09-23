import {
  DEFAULT_LINE_THICKNESS,
  Disposable,
  type IEditorUi,
  isHexColor,
  isLineThickness,
  isOneOf,
  LINE_INTERPOLATION_VALUES,
  LINE_KIND_VALUES,
  type Line,
  type LineInterpolation,
  type LineKind,
  PLAYER_SHAPE_VALUES,
  type Player,
  type PlayerShape,
  toDisposable,
} from "../../common/index.js";
import { LINE_COLOR_PALETTE } from "../theme/line-palette.js";
import { createThemeReader } from "../theme/theme-reader.js";
import { THEME_TOKENS, type ThemeReader } from "../theme/tokens.js";

const SHAPE_LABELS = {
  circle: "丸",
  square: "四角",
} satisfies Record<PlayerShape, string>;

const KIND_LABELS = {
  route: "ルート",
  block: "ブロック",
  motion: "モーション",
} satisfies Record<LineKind, string>;

const INTERPOLATION_LABELS = {
  straight: "直線",
  bezier: "曲線",
} satisfies Record<LineInterpolation, string>;

function toHex(value: string | undefined, fallback: string): string {
  return value !== undefined && isHexColor(value) ? value : fallback;
}

/** 表示中の入力と、選択中の要素の値をその入力に書き込む関数。 */
type ShownFields =
  | { readonly kind: "player"; readonly id: string; readonly update: (player: Player) => void }
  | { readonly kind: "line"; readonly id: string; readonly update: (line: Line) => void }
  | { readonly kind: "hint" };

export class PropertyPanel extends Disposable {
  readonly element: HTMLElement;
  private readonly controller: IEditorUi;
  // 選択中の要素が同じあいだは入力を作り直さず、値だけを書き込む。作り直すと、
  // 値を確定して Tab で次の入力へ移った直後に、移った先の入力ごと消えてフォーカスが外れる。
  private shown: ShownFields | undefined;

  constructor(parent: HTMLElement, controller: IEditorUi) {
    super();
    this.controller = controller;
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
    const player = this.controller.getSelectedPlayer();
    const line = this.controller.getSelectedLine();
    const shown = this.shown;
    if (player !== undefined && shown?.kind === "player" && shown.id === player.id) {
      shown.update(player);
    } else if (line !== undefined && shown?.kind === "line" && shown.id === line.id) {
      shown.update(line);
    } else if (player !== undefined || line !== undefined || shown?.kind !== "hint") {
      this.shown = this.rebuild(player, line);
    }
  }

  private rebuild(player: Player | undefined, line: Line | undefined): ShownFields {
    this.element.replaceChildren();
    if (player !== undefined) {
      const update = this.addPlayerFields();
      update(player);
      return { kind: "player", id: player.id, update };
    }
    if (line !== undefined) {
      const update = this.addLineFields();
      update(line);
      return { kind: "line", id: line.id, update };
    }
    const hint = document.createElement("p");
    hint.className = "playmaker-panel__hint";
    hint.textContent = "対象を選択するとプロパティを編集できます";
    this.element.appendChild(hint);
    return { kind: "hint" };
  }

  private addPlayerFields(): (player: Player) => void {
    const controller = this.controller;
    this.addTitle("選手");
    const setLabel = this.addText("ラベル", (v) => controller.updateSelectedPlayer({ label: v }));
    const setShape = this.addSelect("形状", PLAYER_SHAPE_VALUES, SHAPE_LABELS, (v) =>
      controller.updateSelectedPlayer({ shape: v }),
    );
    const setColor = this.addColor("色", (v) => controller.updateSelectedPlayer({ color: v }));
    // 色の無い選手は塗りの既定色で描くので、入力にも同じ色を出す。
    const read = createThemeReader(this.element);
    const fill = toHex(read("playerFill"), THEME_TOKENS.playerFill.fallback);
    return (player) => {
      setLabel(player.label);
      setShape(player.shape);
      setColor(toHex(player.color, fill));
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
    const setColor = this.addLineColor(read, (v) => controller.updateSelectedLine({ color: v }));
    const setThickness = this.addNumber("太さ", (v) =>
      controller.updateSelectedLine({ thickness: v }),
    );
    return (line) => {
      setKind(line.kind);
      setInterpolation(line.interpolation);
      setColor(line.color);
      setThickness(line.thickness ?? DEFAULT_LINE_THICKNESS);
    };
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
    this.appendRow(label);
  }

  private createRowText(text: string): HTMLElement {
    const span = document.createElement("span");
    span.textContent = text;
    return span;
  }

  private appendRow(...children: HTMLElement[]): void {
    const row = document.createElement("div");
    row.className = "playmaker-panel__row";
    row.append(...children);
    this.element.appendChild(row);
  }

  private addText(labelText: string, onChange: (v: string) => void): (value: string) => void {
    const input = document.createElement("input");
    input.type = "text";
    input.addEventListener("change", () => onChange(input.value));
    this.addRow(labelText, input);
    return (value) => {
      input.value = value;
    };
  }

  private addNumber(labelText: string, onChange: (v: number) => void): (value: number) => void {
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
    this.addRow(labelText, input);
    return (value) => {
      input.value = String(value);
    };
  }

  private addColor(labelText: string, onChange: (v: string) => void): (hex: string) => void {
    const input = document.createElement("input");
    input.type = "color";
    input.addEventListener("change", () => onChange(input.value));
    this.addRow(labelText, input);
    return (hex) => {
      input.value = hex;
    };
  }

  private addLineColor(
    read: ThemeReader,
    onChange: (v: string) => void,
  ): (value: string | undefined) => void {
    const group = document.createElement("div");
    group.className = "playmaker-panel__swatches";
    const swatches = LINE_COLOR_PALETTE.map((opt) => {
      const color = read(opt.token);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "playmaker-panel__swatch";
      btn.title = opt.label;
      btn.setAttribute("aria-label", opt.label);
      btn.style.backgroundColor = color;
      btn.addEventListener("click", () => onChange(color));
      group.appendChild(btn);
      return { btn, color };
    });
    this.addRow("色", group);
    return (value) => {
      for (const { btn, color } of swatches) {
        btn.setAttribute(
          "aria-pressed",
          String(value !== undefined && value.toLowerCase() === color.toLowerCase()),
        );
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
