import {
  Disposable,
  type FieldPosition,
  type IEditorActions,
  type IEditorGestures,
  type IEditorScene,
  resolveKeyAction,
  toDisposable,
} from "../../common/index.js";

/** The canvas that receives the pointer, and a way to map a position on it to field yards. */
export interface IPointerSurface {
  readonly canvas: HTMLCanvasElement;
  clientToYard(clientX: number, clientY: number): FieldPosition;
}

// Keys that reach a form control are left to the control's default behavior (text undo and so on).
function isFormControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export class PointerInput extends Disposable {
  /**
   * @param root The element that receives the shortcuts. It is the element that wraps the whole
   *   UI rather than the canvas, so that Cmd+Z works right after a toolbar button is pressed.
   */
  constructor(
    root: HTMLElement,
    surface: IPointerSurface,
    controller: IEditorGestures & IEditorActions & Pick<IEditorScene, "getViewState">,
  ) {
    super();
    const canvas = surface.canvas;
    // The canvas takes no focus by default, so Esc, Enter, undo, and redo keys would not reach it.
    canvas.tabIndex = 0;

    const toYard = (e: MouseEvent) => surface.clientToYard(e.clientX, e.clientY);
    // The pressed pointer. Up and cancel from any other (second finger, right button) are ignored.
    let activePointerId: number | null = null;
    // Where the primary pointer last was, to replay it when a modifier key changes mid-press.
    let lastPointer: FieldPosition | undefined;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) {
        return;
      }
      activePointerId = e.pointerId;
      // If focusing scrolls the page, the canvas shifts away from the pressed position.
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      lastPointer = toYard(e);
      controller.pointerDown(lastPointer);
    };
    // The line being drawn follows the pointer without a button held, so every move is passed on.
    const onPointerMove = (e: PointerEvent) => {
      if (e.isPrimary) {
        lastPointer = toYard(e);
        controller.pointerMove(lastPointer, { altKey: e.altKey });
      }
    };
    // Pressing or releasing Option (Alt) without moving changes what a drop does, so the drag is
    // brought up to date at once rather than on the next move.
    const onModifierChange = (e: KeyboardEvent) => {
      if (e.key === "Alt" && activePointerId !== null && lastPointer !== undefined) {
        controller.pointerMove(lastPointer, { altKey: e.altKey });
      }
    };
    // Clears the record and returns true when this ends the pressed pointer. Right after up, the
    // browser drops the capture and fires lostpointercapture, so the record is cleared on up first
    // and that event is not mistaken for an abort.
    const endPress = (e: PointerEvent): boolean => {
      if (e.pointerId !== activePointerId) {
        return false;
      }
      activePointerId = null;
      return true;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (endPress(e)) {
        controller.pointerUp(toYard(e));
      }
    };
    // A press that ended without an up, because a touch scroll started or the window changed.
    // Left alone, the drag stays active and the player follows the next move.
    // Drawing spans presses, so aborting a single press does not discard the points placed so far.
    const onPointerAbort = (e: PointerEvent) => {
      if (endPress(e) && !controller.getViewState().isDrawing) {
        controller.cancelInteraction();
      }
    };
    const onDoubleClick = (e: MouseEvent) => controller.doubleClick(toYard(e));
    const onKeyDown = (e: KeyboardEvent) => {
      onModifierChange(e);
      if (isFormControl(e.target)) {
        return;
      }
      switch (resolveKeyAction(e)) {
        case "step-back":
          controller.stepBack();
          return;
        case "commit-line":
          // Enter on a button presses that button, so it does not also commit the line.
          if (!(e.target instanceof HTMLButtonElement)) {
            controller.commitLine();
          }
          return;
        case "delete-selection":
          controller.deleteSelection();
          return;
        case "type-label":
          // Not prevented: the panel focuses the label input during this keydown, and the
          // character then goes into it.
          controller.requestLabelEdit();
          return;
        case "undo":
          e.preventDefault();
          controller.undo();
          return;
        case "redo":
          e.preventDefault();
          controller.redo();
          return;
        case null:
          return;
      }
    };

    const listeners = new AbortController();
    const { signal } = listeners;
    canvas.addEventListener("pointerdown", onPointerDown, { signal });
    canvas.addEventListener("pointermove", onPointerMove, { signal });
    canvas.addEventListener("pointerup", onPointerUp, { signal });
    canvas.addEventListener("pointercancel", onPointerAbort, { signal });
    canvas.addEventListener("lostpointercapture", onPointerAbort, { signal });
    canvas.addEventListener("dblclick", onDoubleClick, { signal });
    root.addEventListener("keydown", onKeyDown, { signal });
    root.addEventListener("keyup", onModifierChange, { signal });
    this._register(
      toDisposable(() => {
        listeners.abort();
        canvas.removeAttribute("tabindex");
      }),
    );
  }
}
