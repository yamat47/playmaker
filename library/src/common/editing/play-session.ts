import { Emitter, type Event } from "../base/event.js";
import { Disposable, DisposableStore } from "../base/lifecycle.js";
import { CommandService } from "../commands/command-service.js";
import { UndoRedoService } from "../commands/undo-redo-service.js";
import { type Formation, normalizeFormation } from "../formations/formation.js";
import { IdFactory } from "../model/id-factory.js";
import type { FieldZone, PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import type { IEditorController } from "./editor.js";
import { EditorController } from "./editor-controller.js";

interface PlayDocument {
  readonly store: DisposableStore;
  readonly model: PlayModel;
  readonly controller: EditorController;
}

function openDocument(data: unknown): PlayDocument {
  const store = new DisposableStore();
  const model = store.add(new PlayModel(data));
  const commands = new CommandService(model, new UndoRedoService());
  const controller = store.add(new EditorController(model, commands, new IdFactory()));
  return { store, model, controller };
}

/**
 * 1 つのプレー図の編集を受け持つ。
 * setPlayData は履歴ごと作り直すので、controller も別のオブジェクトになる。
 */
export class PlaySession extends Disposable {
  private readonly _onDidReset = this._register(new Emitter<void>());
  /** setPlayData で controller が作り直されたあとに発火する。 */
  readonly onDidReset = this._onDidReset.event;

  private readonly _onDidEdit = this._register(new Emitter<void>());
  /**
   * 編集の確定ごとに 1 回、最新の図の深いコピーを渡す。構築時と setPlayData では発火しない
   * （読み込みは編集ではないため）。
   * コピーはリスナごとに作るので、受け手が書き換えても、ほかのリスナとこの図には波及しない。
   */
  readonly onDidChange: Event<PlayData> = (listener) =>
    this._onDidEdit.event(() => listener(this.getPlayData()));

  private readonly _onDidChangeScene = this._register(new Emitter<void>());
  /**
   * 今の controller の onDidChangeScene を転送する。setPlayData で読み直したときも、
   * onDidReset のあとに 1 回出す。controller が作り直されても購読し直さなくてよい。
   */
  readonly onDidChangeScene = this._onDidChangeScene.event;

  private readonly _onDidChangeViewState = this._register(new Emitter<void>());
  /**
   * 今の controller の onDidChangeViewState を転送する。setPlayData で読み直したときも、
   * 表示状態が変わったかどうかにかかわらず onDidReset のあとに 1 回出す。
   */
  readonly onDidChangeViewState = this._onDidChangeViewState.event;

  private document: PlayDocument;

  constructor(data: unknown) {
    super();
    this.document = this.open(data);
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

  /** 外から来た隊形を正規化してから読む。置ける選手が 1 人もいなければ何もせず false を返す。 */
  loadFormation(formation: Formation): boolean {
    const normalized = normalizeFormation(formation);
    return normalized !== null && this.document.controller.loadFormation(normalized);
  }

  setPlayData(data: unknown): void {
    this.document.store.dispose();
    this.document = this.open(data);
    this._onDidReset.fire();
    this._onDidChangeScene.fire();
    this._onDidChangeViewState.fire();
  }

  private open(data: unknown): PlayDocument {
    const opened = openDocument(data);
    const { store, model, controller } = opened;
    store.add(model.onDidChange(() => this._onDidEdit.fire()));
    store.add(controller.onDidChangeScene(() => this._onDidChangeScene.fire()));
    store.add(controller.onDidChangeViewState(() => this._onDidChangeViewState.fire()));
    return opened;
  }

  override dispose(): void {
    this.document.store.dispose();
    super.dispose();
  }
}
