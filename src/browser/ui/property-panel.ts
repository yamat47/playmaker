// プロパティパネル（PRD 5.4: 選手=ラベル/形状/色、線=種別/補間/色/太さ）。
// バニラ DOM・--playmaker-* テーマ。選択が変わるたびに中身を作り直す
// （DOM が小さく、編集はコマンド確定時に走るので作り直しても支障ない）。

import {
  Disposable,
  type IEditorController,
  LINE_COLOR_PALETTE,
  type LineColorOption,
  type LineInterpolation,
  type LineKind,
  type PlayerShape,
  toDisposable,
} from "../../common/index.js";

// 形状の語彙は 2 種に絞る（丸=スキル系、四角=ライン系）。多種混在は図を散らかす。
// 旧データが持つ他形状はモデル・レンダラ側で引き続き受理する（描画の後方互換）。
const SHAPES: PlayerShape[] = ["circle", "square"];
const KINDS: LineKind[] = ["route", "block", "motion"];
const INTERPOLATIONS: LineInterpolation[] = ["straight", "bezier"];

/** color input は hex のみ受け付けるため、非 hex は既定にフォールバックする。 */
function toHex(value: string | undefined, fallback: string): string {
  return value !== undefined && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export class PropertyPanel extends Disposable {
  readonly element: HTMLElement;
  // 直近に描いた内容のキー。選択や確定値が変わらない限り再構築しない
  // （ドラッグ中の onDidChange 連打で DOM 破棄＝入力フォーカス喪失を防ぐ）。
  private lastKey: string | null = null;

  constructor(parent: HTMLElement, controller: IEditorController) {
    super();
    this.element = document.createElement("div");
    this.element.className = "playmaker-panel";

    parent.appendChild(this.element);
    this._register(toDisposable(() => this.element.remove()));
    this._register(controller.onDidChange(() => this.rebuild(controller)));
    this.rebuild(controller);
  }

  private rebuild(controller: IEditorController): void {
    const player = controller.getSelectedPlayer();
    const line = controller.getSelectedLine();
    // 確定済みプロパティのスナップショットでキー化＝ドラッグの transient 連打では不変。
    const key =
      player !== undefined
        ? `p:${JSON.stringify(player)}`
        : line !== undefined
          ? `l:${JSON.stringify(line)}`
          : "none";
    if (key === this.lastKey) {
      return;
    }
    this.lastKey = key;

    this.element.replaceChildren();
    if (player !== undefined) {
      this.addTitle("選手");
      this.addText("ラベル", player.label, (v) => controller.updateSelectedPlayer({ label: v }));
      this.addSelect("形状", SHAPES, player.shape, (v) =>
        controller.updateSelectedPlayer({ shape: v }),
      );
      this.addColor("色", player.color, (v) => controller.updateSelectedPlayer({ color: v }));
      return;
    }
    if (line !== undefined) {
      this.addTitle("線");
      this.addSelect("種別", KINDS, line.kind, (v) => controller.updateSelectedLine({ kind: v }));
      this.addSelect("補間", INTERPOLATIONS, line.interpolation, (v) =>
        controller.updateSelectedLine({ interpolation: v }),
      );
      this.addLineColor(line.color, (v) => controller.updateSelectedLine({ color: v }));
      this.addNumber("太さ", line.thickness ?? 2, (v) =>
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
    input.min = "1";
    input.step = "0.5";
    input.value = String(value);
    input.addEventListener("change", () => {
      const n = Number(input.value);
      if (Number.isFinite(n) && n > 0) {
        onChange(n);
      }
    });
    this.addRow(labelText, input);
  }

  private addColor(
    labelText: string,
    value: string | undefined,
    onChange: (v: string) => void,
  ): void {
    const input = document.createElement("input");
    input.type = "color";
    input.value = toHex(value, "#1e3fae");
    input.addEventListener("change", () => onChange(input.value));
    this.addRow(labelText, input);
  }

  // 線色は自由選択ではなく既定パレットに絞る。スウォッチ色はテーマの
  // --playmaker-* から解決し、host の上書きに追従する（未定義なら fallback）。
  private addLineColor(value: string | undefined, onChange: (v: string) => void): void {
    const styles = getComputedStyle(this.element);
    const resolve = (opt: LineColorOption): string => {
      const v = styles.getPropertyValue(opt.cssVar).trim();
      return v !== "" ? v : opt.fallback;
    };
    const group = document.createElement("div");
    group.className = "playmaker-panel__swatches";
    for (const opt of LINE_COLOR_PALETTE) {
      const color = resolve(opt);
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
    select.addEventListener("change", () => onChange(select.value as T));
    this.addRow(labelText, select);
  }
}
