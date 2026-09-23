import { Emitter } from "../base/event.js";
import { Disposable, DisposableStore } from "../base/lifecycle.js";
import { CommandService } from "../commands/command-service.js";
import { UndoRedoService } from "../commands/undo-redo-service.js";
import { type Formation, normalizeFormation } from "../formations/formation.js";
import { IdFactory } from "../model/id-factory.js";
import type { FieldZone, PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import type { IEditorController } from "./editor.js";
import { EditorController } from "./editor-controller.js";

type ChangeListener = (data: PlayData) => void;

interface PlayDocument {
  readonly store: DisposableStore;
  readonly model: PlayModel;
  readonly controller: EditorController;
}

function openDocument(data: unknown, onChange: ChangeListener | undefined): PlayDocument {
  const store = new DisposableStore();
  const model = store.add(new PlayModel(data));
  const history = store.add(new UndoRedoService());
  const controller = store.add(
    new EditorController(model, new CommandService(model, history), new IdFactory()),
  );
  // 受け手が書き換えても Model に波及しないよう、渡す直前にだけ深いコピーを作る。
  store.add(model.onDidChange(() => onChange?.(model.getData())));
  return { store, model, controller };
}

/**
 * 1 つのプレー図の編集を受け持つ。
 *
 * onChange は編集の確定ごとに 1 回だけ呼び、構築時と setPlayData では呼ばない
 * （読み込みは編集ではないため）。
 * setPlayData は履歴ごと作り直すので、controller も別のオブジェクトになる。
 */
export class PlaySession extends Disposable {
  private readonly _onDidReset = this._register(new Emitter<void>());
  /** setPlayData で controller が作り直されたあとに発火する。 */
  readonly onDidReset = this._onDidReset.event;

  private readonly onChange: ChangeListener | undefined;
  private document: PlayDocument;

  constructor(data: unknown, onChange?: ChangeListener) {
    super();
    this.onChange = onChange;
    this.document = openDocument(data, onChange);
  }

  get controller(): IEditorController {
    return this.document.controller;
  }

  get fieldZone(): FieldZone {
    return this.document.model.getFieldZone();
  }

  /** 現在の図の深いコピー。受け取った値を書き換えても、この図には波及しない。 */
  getPlayData(): PlayData {
    return this.document.model.getData();
  }

  /** 現在の図をコピーせずに返す。 */
  getSnapshot(): PlayData {
    return this.document.model.getSnapshot();
  }

  setFieldZone(zone: FieldZone): void {
    this.document.controller.setFieldZone(zone);
  }

  /** 外から来た隊形を正規化してから読む。置ける選手が 1 人もいなければ何もしない。 */
  loadFormation(formation: Formation): void {
    const normalized = normalizeFormation(formation);
    if (normalized !== null) {
      this.document.controller.loadFormation(normalized);
    }
  }

  setPlayData(data: unknown): void {
    this.document.store.dispose();
    this.document = openDocument(data, this.onChange);
    this._onDidReset.fire();
  }

  override dispose(): void {
    this.document.store.dispose();
    super.dispose();
  }
}
