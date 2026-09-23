import {
  Disposable,
  type FieldPosition,
  type IEditorActions,
  type IEditorGestures,
  type IEditorScene,
  resolveKeyAction,
  toDisposable,
} from "../../common/index.js";

/** ポインタを受ける canvas と、その上の位置をフィールドのヤードの位置に変える手段。 */
export interface IPointerSurface {
  readonly canvas: HTMLCanvasElement;
  clientToYard(clientX: number, clientY: number): FieldPosition;
}

// フォーム部品に来たキーは、その部品の標準動作（テキストの Undo など）に任せる。
function isFormControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export class PointerInput extends Disposable {
  /**
   * @param root ショートカットを受ける要素。ツールバーのボタンを押した直後でも
   *   Cmd+Z が効くよう、canvas ではなく UI 全体を包む要素に付ける。
   */
  constructor(
    root: HTMLElement,
    surface: IPointerSurface,
    controller: IEditorGestures & IEditorActions & Pick<IEditorScene, "getViewState">,
  ) {
    super();
    const canvas = surface.canvas;
    // Esc / Enter / Undo・Redo を受け取れるようフォーカス可能にする。
    canvas.tabIndex = 0;

    const toYard = (e: PointerEvent) => surface.clientToYard(e.clientX, e.clientY);
    // 押下中のポインタ。これ以外（2 本目の指、右ボタン）の up や cancel は無視する。
    let activePointerId: number | null = null;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) {
        return;
      }
      activePointerId = e.pointerId;
      // フォーカスでページがスクロールすると、押した位置と canvas がずれる。
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      controller.pointerDown(toYard(e));
    };
    // draw-line のラバーバンドはボタン非押下でも追従させたいので常に渡す
    // （interaction が無ければ controller 側で無視される）。
    const onPointerMove = (e: PointerEvent) => {
      if (e.isPrimary) {
        controller.pointerMove(toYard(e));
      }
    };
    // 押下中のポインタの終わりなら控えを消して true。up の直後にブラウザが capture を外して
    // lostpointercapture を出すので、up で先に消しておき、それを中断と取り違えない。
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
    // タッチのスクロール開始やウィンドウ切替で up が来ないまま終わった押下。
    // 放っておくとドラッグが外れず、次の移動で選手がついてくる。
    // 作図は押下をまたいで続く操作なので、1 回の押下の中断で打った点まで捨てない。
    const onPointerAbort = (e: PointerEvent) => {
      if (endPress(e) && !controller.getViewState().isDrawing) {
        controller.cancelInteraction();
      }
    };
    // ダブルクリック = 作図確定（最後の点を終点に）。
    const onDoubleClick = () => controller.commitLine();
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFormControl(e.target)) {
        return;
      }
      switch (resolveKeyAction(e)) {
        case "cancel-interaction":
          controller.cancelInteraction();
          return;
        case "commit-line":
          // ボタン上の Enter はそのボタンを押す操作なので、作図の確定と二重にしない。
          if (!(e.target instanceof HTMLButtonElement)) {
            controller.commitLine();
          }
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
    this._register(toDisposable(() => listeners.abort()));
  }
}
