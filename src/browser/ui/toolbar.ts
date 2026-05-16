// 編集ツールバー（PRD 5.4 / 6.5）。バニラ DOM・--playmaker-* テーマ。
// 状態は EditorController が真実源で、ここは「ボタン → アクション」と
// 「onDidChange → 見た目同期」を繋ぐだけ（フレームワーク非依存・組み込み容易）。

import {
  Disposable,
  type EditorTool,
  type FieldZone,
  type IEditorController,
  toDisposable,
} from "../../common/index.js";

const TOOLS: { tool: EditorTool; label: string }[] = [
  { tool: "select", label: "選択" },
  { tool: "add-player", label: "選手を追加" },
  { tool: "draw-line", label: "線を描く" },
];

const ZONES: { zone: FieldZone; label: string }[] = [
  { zone: "own-redzone", label: "自陣RZ" },
  { zone: "middle", label: "中央" },
  { zone: "redzone", label: "相手RZ" },
];

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

    for (const { tool, label } of TOOLS) {
      const btn = this.addButton(label, () => controller.setTool(tool));
      this.toolButtons.set(tool, btn);
    }
    this.addSeparator();
    this.undoButton = this.addButton("元に戻す", () => controller.undo());
    this.redoButton = this.addButton("やり直す", () => controller.redo());
    this.deleteButton = this.addButton("削除", () => controller.deleteSelection());
    this.addSeparator();
    for (const { zone, label } of ZONES) {
      const btn = this.addButton(label, () => controller.setFieldZone(zone));
      this.zoneButtons.set(zone, btn);
    }
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
