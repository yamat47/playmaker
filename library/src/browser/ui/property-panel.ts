// プロパティパネル（PRD 5.4: 選手=ラベル/形状/色、線=種別/補間/色/太さ）。
// バニラ DOM・--playmaker-* テーマ。選択が変わるたびに中身を作り直す
// （DOM が小さく、編集はコマンド確定時に走るので作り直しても支障ない）。

import {
  DEFAULT_LINE_THICKNESS,
  Disposable,
  type IEditorUi,
  isOneOf,
  LINE_INTERPOLATION_VALUES,
  LINE_KIND_VALUES,
  type Line,
  PLAYER_SHAPE_VALUES,
  type Player,
  toDisposable,
} from "../../common/index.js";
import { LINE_COLOR_PALETTE } from "../theme/line-palette.js";
import { createThemeReader } from "../theme/theme-reader.js";
import { THEME_TOKENS, type ThemeReader } from "../theme/tokens.js";

/** color input は hex のみ受け付けるため、非 hex は既定にフォールバックする。 */
function toHex(value: string | undefined, fallback: string): string {
  return value !== undefined && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

interface ShownItems {
  readonly player: Player | undefined;
  readonly line: Line | undefined;
}

export class PropertyPanel extends Disposable {
  readonly element: HTMLElement;
  private readonly controller: IEditorUi;
  // 直近に描いた選手と線。表示状態の通知はツールや Undo の可否が変わっても届くので、
  // 選択中の要素が差し替わらない限り作り直さず、入力中のフォーカスを失わせない。
  // 要素は値が変わるたびに別のオブジェクトになるので、参照で比べればよい。
  private shown: ShownItems | undefined;

  constructor(parent: HTMLElement, controller: IEditorUi) {
    super();
    this.controller = controller;
    this.element = document.createElement("div");
    this.element.className = "playmaker-panel";

    parent.appendChild(this.element);
    this._register(toDisposable(() => this.element.remove()));
    this._register(controller.onDidChangeViewState(() => this.rebuild()));
    this.rebuild();
  }

  /** 色の既定値とスウォッチはテーマ変数から読むので、ホストが変数を変えたあとに呼べば反映される。 */
  refresh(): void {
    this.shown = undefined;
    this.rebuild();
  }

  private rebuild(): void {
    const controller = this.controller;
    const player = controller.getSelectedPlayer();
    const line = controller.getSelectedLine();
    if (this.shown !== undefined && this.shown.player === player && this.shown.line === line) {
      return;
    }
    this.shown = { player, line };

    this.element.replaceChildren();
    const read = createThemeReader(this.element);
    if (player !== undefined) {
      this.addTitle("選手");
      this.addText("ラベル", player.label, (v) => controller.updateSelectedPlayer({ label: v }));
      this.addSelect("形状", PLAYER_SHAPE_VALUES, player.shape, (v) =>
        controller.updateSelectedPlayer({ shape: v }),
      );
      // 色の無い選手は塗りの既定色で描くので、入力にも同じ色を出す。
      const fill = toHex(read("playerFill"), THEME_TOKENS.playerFill.fallback);
      this.addColor("色", toHex(player.color, fill), (v) =>
        controller.updateSelectedPlayer({ color: v }),
      );
      return;
    }
    if (line !== undefined) {
      this.addTitle("線");
      this.addSelect("種別", LINE_KIND_VALUES, line.kind, (v) =>
        controller.updateSelectedLine({ kind: v }),
      );
      this.addSelect("補間", LINE_INTERPOLATION_VALUES, line.interpolation, (v) =>
        controller.updateSelectedLine({ interpolation: v }),
      );
      this.addLineColor(line.color, read, (v) => controller.updateSelectedLine({ color: v }));
      this.addNumber("太さ", line.thickness ?? DEFAULT_LINE_THICKNESS, (v) =>
        controller.updateSelectedLine({ thickness: v }),
      );
      return;
    }
    const hint = document.createElement("p");
    hint.className = "playmaker-panel__hint";
    hint.textContent = "対象を選択するとプロパティを編集できます";
    this.element.appendChild(hint);
  }

  private addTitle(text: string): void {
    const h = document.createElement("h2");
    h.className = "playmaker-panel__title";
    h.textContent = text;
    this.element.appendChild(h);
  }

  private addRow(labelText: string, control: HTMLElement): void {
    const row = document.createElement("label");
    row.className = "playmaker-panel__row";
    const span = document.createElement("span");
    span.textContent = labelText;
    row.append(span, control);
    this.element.appendChild(row);
  }

  private addText(labelText: string, value: string, onChange: (v: string) => void): void {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.addEventListener("change", () => onChange(input.value));
    this.addRow(labelText, input);
  }

  private addNumber(labelText: string, value: number, onChange: (v: number) => void): void {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0.25";
    input.step = "0.25";
    input.value = String(value);
    input.addEventListener("change", () => {
      const n = Number(input.value);
      if (Number.isFinite(n) && n > 0) {
        onChange(n);
      }
    });
    this.addRow(labelText, input);
  }

  private addColor(labelText: string, hex: string, onChange: (v: string) => void): void {
    const input = document.createElement("input");
    input.type = "color";
    input.value = hex;
    input.addEventListener("change", () => onChange(input.value));
    this.addRow(labelText, input);
  }

  private addLineColor(
    value: string | undefined,
    read: ThemeReader,
    onChange: (v: string) => void,
  ): void {
    const group = document.createElement("div");
    group.className = "playmaker-panel__swatches";
    for (const opt of LINE_COLOR_PALETTE) {
      const color = read(opt.token);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "playmaker-panel__swatch";
      btn.title = opt.label;
      btn.setAttribute("aria-label", opt.label);
      btn.style.backgroundColor = color;
      btn.setAttribute(
        "aria-pressed",
        String(value !== undefined && value.toLowerCase() === color.toLowerCase()),
      );
      btn.addEventListener("click", () => onChange(color));
      group.appendChild(btn);
    }
    this.addRow("色", group);
  }

  private addSelect<T extends string>(
    labelText: string,
    options: readonly T[],
    value: T,
    onChange: (v: T) => void,
  ): void {
    const select = document.createElement("select");
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      o.selected = opt === value;
      select.appendChild(o);
    }
    select.addEventListener("change", () => {
      if (isOneOf(select.value, options)) {
        onChange(select.value);
      }
    });
    this.addRow(labelText, select);
  }
}
