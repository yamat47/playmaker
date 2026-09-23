import {
  canLoadFormation,
  Disposable,
  EDITOR_TOOL_VALUES,
  type EditorTool,
  type EditorViewState,
  FIELD_ZONE_LABELS,
  FIELD_ZONE_VALUES,
  type FieldZone,
  FORMATION_PRESETS,
  getFormationPreset,
  type Formation,
  type IEditorUi,
  isToolAvailable,
  MAX_LINES,
  MAX_PLAYERS,
  TEAM_SIDE_VALUES,
  type TeamSide,
  toDisposable,
} from "../../common/index.js";

const TOOL_LABELS = {
  select: "選択",
  "add-player": "選手を追加",
  "draw-line": "線を描く",
} satisfies Record<EditorTool, string>;

// 件数の上限に達して押せない部品に、理由として出す文。
const PLAYER_LIMIT_REASON = `選手は ${MAX_PLAYERS} 人までです`;
const TOOL_UNAVAILABLE_REASONS: Readonly<Partial<Record<EditorTool, string>>> = {
  "add-player": PLAYER_LIMIT_REASON,
  "draw-line": `線は ${MAX_LINES} 本までです`,
};

const SIDE_LABELS = {
  offense: "オフェンス",
  defense: "ディフェンス",
} satisfies Record<TeamSide, string>;

/**
 * disabled ではなく aria-disabled で無効を示す。disabled にすると、押した直後に
 * 無効になったボタンからフォーカスが body へ落ち、
 * 編集 UI の中で受けているショートカットが効かなくなる。
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
  private readonly commitButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly formationPicker: HTMLSelectElement;
  private readonly formationOptions = new Map<HTMLOptionElement, Formation>();

  constructor(parent: HTMLElement, controller: IEditorUi) {
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
      const btn = this.addButton(FIELD_ZONE_LABELS[zone], () => controller.setFieldZone(zone));
      this.zoneButtons.set(zone, btn);
    }
    this.addSeparator();
    this.formationPicker = this.addFormationPicker(controller);
    this.addSeparator();
    this.commitButton = this.addButton("線を確定", () => controller.commitLine());
    this.cancelButton = this.addButton("取消", () => controller.cancelInteraction());

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
   * フォーメーション読込のプルダウン（PRD 5.4 の操作・5.6）。攻守で optgroup 化。
   * 読込は controller 経由＝Undo/onChange の対象。選択後はプレースホルダへ戻し、
   * 同じ隊形を続けて重ねられる（追記セマンティクス）ようにする。
   */
  private addFormationPicker(controller: IEditorUi): HTMLSelectElement {
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
        this.formationOptions.set(option, formation);
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
    return select;
  }

  private sync(controller: IEditorUi): void {
    const state = controller.getViewState();
    for (const [tool, btn] of this.toolButtons) {
      btn.setAttribute("aria-pressed", String(tool === state.tool));
      setEnabled(btn, isToolAvailable(tool, state), TOOL_UNAVAILABLE_REASONS[tool]);
    }
    for (const [zone, btn] of this.zoneButtons) {
      btn.setAttribute("aria-pressed", String(zone === state.fieldZone));
    }
    setEnabled(this.undoButton, state.canUndo);
    setEnabled(this.redoButton, state.canRedo);
    setEnabled(this.deleteButton, state.selection !== null);
    setEnabled(this.commitButton, state.isDrawing);
    setEnabled(this.cancelButton, state.isDrawing);
    this.syncFormationPicker(state);
  }

  private syncFormationPicker(state: EditorViewState): void {
    let isAnyUnavailable = false;
    for (const [option, formation] of this.formationOptions) {
      option.disabled = !canLoadFormation(formation, state);
      isAnyUnavailable ||= option.disabled;
    }
    if (isAnyUnavailable) {
      this.formationPicker.title = PLAYER_LIMIT_REASON;
    } else {
      this.formationPicker.removeAttribute("title");
    }
  }
}
