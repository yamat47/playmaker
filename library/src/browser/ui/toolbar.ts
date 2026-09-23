// 編集ツールバー（PRD 5.4 / 6.5）。バニラ DOM・--playmaker-* テーマ。
// 状態は EditorController が真実源で、ここは「ボタン → アクション」と
// 「onDidChange → 見た目同期」を繋ぐだけ（フレームワーク非依存・組み込み容易）。

import {
  Disposable,
  EDITOR_TOOL_VALUES,
  type EditorTool,
  FIELD_ZONE_VALUES,
  type FieldZone,
  FORMATION_PRESETS,
  getFormationPreset,
  type IEditorController,
  TEAM_SIDE_VALUES,
  type TeamSide,
  toDisposable,
} from "../../common/index.js";

const TOOL_LABELS = {
  select: "選択",
  "add-player": "選手を追加",
  "draw-line": "線を描く",
} satisfies Record<EditorTool, string>;

const ZONE_LABELS = {
  "own-redzone": "自陣RZ",
  middle: "中央",
  redzone: "相手RZ",
} satisfies Record<FieldZone, string>;

const SIDE_LABELS = {
  offense: "オフェンス",
  defense: "ディフェンス",
} satisfies Record<TeamSide, string>;

export class Toolbar extends Disposable {
  readonly element: HTMLElement;
  private readonly toolButtons = new Map<EditorTool, HTMLButtonElement>();
  private readonly zoneButtons = new Map<FieldZone, HTMLButtonElement>();
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly commitButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;

  constructor(parent: HTMLElement, controller: IEditorController) {
    super();
    this.element = document.createElement("div");
    this.element.className = "playmaker-toolbar";

    for (const tool of EDITOR_TOOL_VALUES) {
      const btn = this.addButton(TOOL_LABELS[tool], () => controller.setTool(tool));
      this.toolButtons.set(tool, btn);
    }
    this.addSeparator();
    this.undoButton = this.addButton("元に戻す", () => controller.undo());
    this.redoButton = this.addButton("やり直す", () => controller.redo());
    this.deleteButton = this.addButton("削除", () => controller.deleteSelection());
    this.addSeparator();
    for (const zone of FIELD_ZONE_VALUES) {
      const btn = this.addButton(ZONE_LABELS[zone], () => controller.setFieldZone(zone));
      this.zoneButtons.set(zone, btn);
    }
    this.addSeparator();
    this.addFormationPicker(controller);
    this.addSeparator();
    this.commitButton = this.addButton("線を確定", () => controller.commitLine());
    this.cancelButton = this.addButton("取消", () => controller.cancelInteraction());

    parent.appendChild(this.element);
    this._register(toDisposable(() => this.element.remove()));
    this._register(controller.onDidChange(() => this.sync(controller)));
    this.sync(controller);
  }

  private addButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = "playmaker-toolbar__button";
    button.addEventListener("click", onClick);
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
   * フォーメーション読込のプルダウン（PRD 5.4 の操作・5.6）。攻守で optgroup 化。
   * 読込は controller 経由＝Undo/onChange の対象。選択後はプレースホルダへ戻し、
   * 同じ隊形を続けて重ねられる（追記セマンティクス）ようにする。
   */
  private addFormationPicker(controller: IEditorController): void {
    const select = document.createElement("select");
    select.className = "playmaker-toolbar__select";
    select.setAttribute("aria-label", "フォーメーション");

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "フォーメーション読込…";
    select.appendChild(placeholder);

    for (const side of TEAM_SIDE_VALUES) {
      const group = document.createElement("optgroup");
      group.label = SIDE_LABELS[side];
      for (const formation of FORMATION_PRESETS.filter((f) => f.side === side)) {
        const option = document.createElement("option");
        option.value = formation.id;
        option.textContent = formation.name;
        group.appendChild(option);
      }
      select.appendChild(group);
    }

    select.addEventListener("change", () => {
      // 未知 id ガード込みの取得は公開ヘルパに委譲（再実装しない）。
      const preset = getFormationPreset(select.value);
      if (preset !== undefined) {
        controller.loadFormation(preset);
      }
      select.value = "";
    });

    this.element.appendChild(select);
  }

  private sync(controller: IEditorController): void {
    const state = controller.getViewState();
    for (const [tool, btn] of this.toolButtons) {
      btn.setAttribute("aria-pressed", String(tool === state.tool));
    }
    for (const [zone, btn] of this.zoneButtons) {
      btn.setAttribute("aria-pressed", String(zone === state.fieldZone));
    }
    this.undoButton.disabled = !state.canUndo;
    this.redoButton.disabled = !state.canRedo;
    this.deleteButton.disabled = state.selection === null;
    this.commitButton.disabled = !state.drawing;
    this.cancelButton.disabled = !state.drawing;
  }
}
