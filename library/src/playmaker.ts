import {
  CanvasSurface,
  type EditorDecorations,
  type Messages,
  PLAYMAKER_LOCALE_VALUES,
  type PlaymakerLocale,
  PointerInput,
  PropertyPanel,
  replaceKeepingFocus,
  resolveMessages,
  Toolbar,
} from "./browser/index.js";
import {
  DisposableStore,
  type EditorFrame,
  type Event,
  type FieldZone,
  type Formation,
  type IDisposable,
  type ImageExportOptions,
  type PlayData,
  type PlayDataInput,
  PlaySession,
  toDisposable,
} from "./common/index.js";
import "./styles.css";

export type {
  Event,
  FieldPosition,
  FieldState,
  FieldZone,
  Formation,
  FormationPlayer,
  IDisposable,
  ImageExportOptions,
  Line,
  LineInterpolation,
  LineKind,
  PlayCategory,
  PlayData,
  PlayDataInput,
  Player,
  PlayerFill,
  PlayerShape,
  PlayPreset,
  TeamSide,
} from "./common/index.js";
export {
  CURRENT_PLAY_DATA_VERSION,
  FIELD_WIDTH_YARDS,
  FIELD_ZONE_LABELS,
  FIELD_ZONE_VALUES,
  FORMATION_PRESETS,
  GRID_STEP_YARDS,
  getFormationPreset,
  getPlayPreset,
  migratePlayData,
  PLAY_PRESETS,
} from "./common/index.js";

export type PlaymakerMode = "view" | "edit";

export { PLAYMAKER_LOCALE_VALUES, type PlaymakerLocale };

// The bundler replaces process.env.NODE_ENV with a string literal. Loaded in a browser without
// that replacement, `process` does not exist and throws a ReferenceError; treat that as production.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export interface PlaymakerOptions {
  /**
   * The initial mode. The default is "edit". "view" places no editing UI and accepts no pointer
   * or keyboard input. `setMode` switches the mode later.
   */
  mode?: PlaymakerMode | undefined;
  /**
   * The first diagram to show. Like `restorePlayData`, it is accepted without checking its shape
   * and coerced to the current schema.
   */
  initialData?: unknown;
  /** A listener added to `onDidChange` at construction. Dispose the Playmaker to remove it. */
  onChange?: ((data: PlayData) => void) | undefined;
  /**
   * Language of the built-in UI (the toolbar and the property panel). The default is "en".
   * Fixed at construction; to switch, construct again with the same data.
   * Error messages are English regardless of the locale, because they are for developers.
   */
  locale?: PlaymakerLocale | undefined;
}

/**
 * Draws the play diagram inside container and, in edit mode, also places the editing UI.
 * dispose removes every element it placed.
 * Changes after dispose do nothing instead of throwing; in development, console.warn reports it.
 * getPlayData and fieldZone return the diagram as it was at dispose.
 */
export class Playmaker implements IDisposable {
  /**
   * Fires once per committed edit command or Undo / Redo, with a deep copy of the latest diagram.
   * `version` is always the current one, so the received value can be persisted as is.
   * `replacePlayData` is an edit and fires it too.
   * Does not fire at construction, on loads through `setPlayData` and `restorePlayData`, or on PNG
   * export (a load is not an edit).
   * The copy is made per listener, so mutating it affects neither this diagram nor other listeners.
   * Disposing the return value ends the subscription.
   */
  readonly onDidChange: Event<PlayData>;
  private readonly store = new DisposableStore();
  private readonly root: HTMLElement;
  private readonly surface: CanvasSurface;
  private readonly session: PlaySession;
  private currentMode: PlaymakerMode;
  private readonly messages: Messages;
  private panel: PropertyPanel | undefined;
  // UI and input attached to the current controller. Reattached when it or the mode changes.
  private ui: DisposableStore;

  constructor(container: HTMLElement, options: PlaymakerOptions = {}) {
    this.currentMode = options.mode ?? "edit";
    const locale = options.locale ?? "en";
    this.messages = resolveMessages(locale);
    this.session = this.store.add(new PlaySession(options.initialData));
    this.onDidChange = this.session.onDidChange;
    if (options.onChange !== undefined) {
      this.store.add(this.session.onDidChange(options.onChange));
    }

    this.root = document.createElement("div");
    this.root.className = "playmaker-root";
    this.root.dataset.mode = this.currentMode;
    // Tells assistive technology and font fallback which language the UI text is in.
    this.root.lang = locale;
    container.appendChild(this.root);
    this.store.add(toDisposable(() => this.root.remove()));

    const stage = document.createElement("div");
    stage.className = "playmaker-stage";
    this.root.appendChild(stage);
    const frame = this.session.controller.getFrame();
    this.surface = this.store.add(
      new CanvasSurface(stage, frame.scene, this.surfaceDecorations(frame)),
    );
    // CanvasSurface draws the current diagram once its first size is known, so no draw here.
    this.ui = this.createUi();
    this.store.add(this.session.onDidChangeScene(() => this.draw()));
    // After a reload the session notifies a redraw itself, so only the UI is reattached here.
    this.store.add(this.session.onDidReset(() => this.replaceUi()));
  }

  get mode(): PlaymakerMode {
    return this.currentMode;
  }

  /**
   * Switches the mode. The diagram and Undo history stay; only the editing UI and the pointer and
   * key input are attached or detached. View commits a label being typed in the panel, as an edit,
   * cancels a drag or drawing in progress, and draws no selection highlight.
   */
  setMode(mode: PlaymakerMode): void {
    if (this.store.isDisposed) {
      this.warnIgnoredAfterDispose("setMode");
      return;
    }
    if (mode === this.currentMode) {
      return;
    }
    this.currentMode = mode;
    this.root.dataset.mode = mode;
    if (mode === "view") {
      this.session.controller.cancelInteraction();
      // The pointer input goes away with the editing UI and reports no leave, so the mark under
      // the pointer would come back with edit mode.
      this.session.controller.pointerLeave();
    }
    this.replaceUi();
    this.draw();
  }

  get fieldZone(): FieldZone {
    return this.session.fieldZone;
  }

  /**
   * Moves the LOS to the default position of that zone, and moves the players and lines with it.
   * This is an edit, so Undo and onDidChange cover it. Callable in view mode as well.
   */
  setFieldZone(zone: FieldZone): void {
    if (this.store.isDisposed) {
      this.warnIgnoredAfterDispose("setFieldZone");
      return;
    }
    this.session.setFieldZone(zone);
  }

  /**
   * Appends the formation's players to the current diagram and returns true once placed. Offense
   * and defense formations can be layered in turn. Player positions are relative to the LOS
   * (`lateralYard` and `downfieldYard`). A formation passed from outside is normalized before it is
   * read, so players whose position cannot be read are dropped. When no player can be placed, or
   * placing them would exceed 64 players, places none and returns false.
   * This is an edit, so Undo and onDidChange cover it. Callable in view mode as well.
   */
  loadFormation(formation: Formation): boolean {
    if (this.store.isDisposed) {
      this.warnIgnoredAfterDispose("loadFormation");
      return false;
    }
    return this.session.loadFormation(formation);
  }

  /**
   * Loads a diagram built with the types and replaces the current one. The return value of
   * `getPlayData` and a preset's `data` can be passed as is.
   * Even when the input matches the types, duplicate ids and entries past the count limits are
   * normalized as in `restorePlayData`.
   * A load is not an edit, so the Undo history is cleared and onDidChange does not fire.
   */
  setPlayData(data: PlayDataInput): void {
    if (this.store.isDisposed) {
      this.warnIgnoredAfterDispose("setPlayData");
      return;
    }
    this.session.setPlayData(data);
  }

  /**
   * Replaces the current diagram as one edit, for applying a template or a bundled play to the
   * diagram being edited. Unlike `setPlayData`, the Undo history stays and gains this change, so
   * Undo brings the previous diagram back, and onDidChange fires with the new diagram.
   * The selection is cleared. The input is normalized as in `setPlayData`, and a diagram equal to
   * the current one changes nothing. Callable in view mode as well.
   * To open a different saved play, use `setPlayData` or `restorePlayData`: with this method, Undo
   * would bring the contents of the previous play into the newly opened one.
   */
  replacePlayData(data: PlayDataInput): void {
    if (this.store.isDisposed) {
      this.warnIgnoredAfterDispose("replacePlayData");
      return;
    }
    this.session.replacePlayData(data);
  }

  /**
   * Accepts a persisted value unchecked, loads it, and replaces the current diagram.
   * Old versions, unversioned values, future versions, and broken data are coerced to the current
   * schema without throwing; only the elements that cannot be read are dropped.
   * Anything past 64 players, 128 lines, or 32 waypoints per line is dropped, keeping the first
   * entries up to the limit.
   * A load is not an edit, so the Undo history is cleared and onDidChange does not fire.
   */
  restorePlayData(raw: unknown): void {
    if (this.store.isDisposed) {
      this.warnIgnoredAfterDispose("restorePlayData");
      return;
    }
    this.session.setPlayData(raw);
  }

  /**
   * A deep copy of the current diagram. `version` is always the current one, so it can be turned
   * into JSON and persisted as is. Passing it back through `restorePlayData` or `initialData`
   * yields the same diagram. Edits cannot exceed the count limits either: at a limit, adding a
   * player, loading a formation, and drawing a line do nothing.
   */
  getPlayData(): PlayData {
    return this.session.getPlayData();
  }

  /**
   * Exports the play diagram as committed at the time of the call as a PNG image (Blob).
   * The selection highlight, waypoint handles, the shape of a drag or drawing in progress, and the
   * toolbar and panel are not included. Usable in both view and edit mode.
   * Draws after the bundled font has finished loading, so even a call right after construction
   * renders the yard numbers and player labels in the bundled font. If the font fails to load,
   * draws with a fallback font. Rejects without throwing when a canvas cannot be obtained, the
   * PNG conversion fails, or the Playmaker is disposed.
   */
  exportToPng(options?: ImageExportOptions): Promise<Blob> {
    if (this.store.isDisposed) {
      return Promise.reject(new Error("Playmaker: cannot export a PNG after dispose."));
    }
    return this.surface.exportToPngBlob(this.session.getSnapshot(), options);
  }

  /**
   * Re-reads the colors of the diagram and the panel from the theme CSS variables. The browser does
   * not report CSS variable changes, so the host calls this after changing them on an ancestor.
   */
  refresh(): void {
    if (this.store.isDisposed) {
      this.warnIgnoredAfterDispose("refresh");
      return;
    }
    this.surface.refresh();
    this.panel?.refresh();
  }

  dispose(): void {
    this.ui.dispose();
    this.store.dispose();
  }

  /** Calls after dispose do nothing, so report that in development only. */
  private warnIgnoredAfterDispose(method: string): void {
    if (isDevelopment()) {
      console.warn(`Playmaker: ${method} was called after dispose, so it did nothing.`);
    }
  }

  private replaceUi(): void {
    // In view the canvas does not take focus, so focus that was lost stays on the body.
    replaceKeepingFocus(this.root, this.surface.canvas, () => {
      this.ui.dispose();
      this.ui = this.createUi();
    });
  }

  private createUi(): DisposableStore {
    const ui = new DisposableStore();
    const controller = this.session.controller;
    this.panel = undefined;
    if (this.currentMode === "edit") {
      ui.add(new Toolbar(this.root, controller, this.messages));
      this.panel = ui.add(
        new PropertyPanel(this.root, controller, this.surface.canvas, this.messages),
      );
      ui.add(new PointerInput(this.root, this.surface, controller));
    }
    return ui;
  }

  private draw(): void {
    const frame = this.session.controller.getFrame();
    this.surface.setScene(frame.scene, this.surfaceDecorations(frame));
    this.surface.canvas.style.cursor = this.currentMode === "edit" ? frame.cursor : "";
  }

  /** Undefined in view mode, so edit-only layers (the grid, selection highlight) are not drawn. */
  private surfaceDecorations({ overlay, hover }: EditorFrame): EditorDecorations | undefined {
    return this.currentMode === "edit" ? { overlay, hover } : undefined;
  }
}
