import { Emitter, type Event } from "../base/event.js";
import { Disposable, DisposableStore } from "../base/lifecycle.js";
import { CommandService } from "../commands/command-service.js";
import { UndoRedoService } from "../commands/undo-redo-service.js";
import { type Formation, normalizeFormation } from "../formations/formation.js";
import { IdFactory } from "../model/id-factory.js";
import { migratePlayData } from "../model/migration.js";
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
 * Handles the editing of a single play diagram.
 * setPlayData rebuilds everything, history included, so the controller becomes a new object too.
 */
export class PlaySession extends Disposable {
  private readonly _onDidReset = this._register(new Emitter<void>());
  /** Fires after setPlayData has rebuilt the controller. */
  readonly onDidReset = this._onDidReset.event;

  private readonly _onDidEdit = this._register(new Emitter<void>());
  /**
   * Passes a deep copy of the latest diagram once per committed edit. Does not fire at
   * construction or on setPlayData (loading is not an edit).
   * A copy is made per listener, so a receiver that modifies it affects neither other listeners
   * nor this diagram.
   */
  readonly onDidChange: Event<PlayData> = (listener) =>
    this._onDidEdit.event(() => listener(this.getPlayData()));

  private readonly _onDidChangeScene = this._register(new Emitter<void>());
  /**
   * Forwards onDidChangeScene of the current controller. Also fires once after onDidReset when
   * setPlayData reloads the diagram. No need to resubscribe when the controller is rebuilt.
   */
  readonly onDidChangeScene = this._onDidChangeScene.event;

  private readonly _onDidChangeViewState = this._register(new Emitter<void>());
  /**
   * Forwards onDidChangeViewState of the current controller. Also fires once after onDidReset
   * when setPlayData reloads the diagram, whether or not the view state changed.
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

  /** A deep copy of the current diagram. Modifying the returned value does not affect this one. */
  getPlayData(): PlayData {
    return this.document.model.getData();
  }

  /** Returns the current diagram without copying. */
  getSnapshot(): PlayData {
    return this.document.model.getSnapshot();
  }

  setFieldZone(zone: FieldZone): void {
    this.document.controller.setFieldZone(zone);
  }

  /**
   * Normalizes an external formation before loading it. Does nothing and returns false if not a
   * single player can be placed.
   */
  loadFormation(formation: Formation): boolean {
    const normalized = normalizeFormation(formation);
    return normalized !== null && this.document.controller.loadFormation(normalized);
  }

  /**
   * Normalizes the data like setPlayData, then replaces the diagram as one edit: the history and
   * the controller stay, Undo brings the previous diagram back, and onDidChange fires.
   */
  replacePlayData(data: unknown): void {
    this.document.controller.replacePlay(migratePlayData(data));
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
