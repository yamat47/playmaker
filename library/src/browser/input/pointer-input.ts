// canvas のポインタ入力と、root で受けるショートカットを EditorController の操作へ変換する。
// 座標規約（px→ヤード）は CanvasSurface に集約し、編集判断は common 側が持つ。
// ここは「DOM イベントを意味のある操作に翻訳する」だけの薄い層（browser・最小限）。

import {
  Disposable,
  type IEditorActions,
  type IEditorGestures,
  type IEditorScene,
  toDisposable,
} from "../../common/index.js";
import type { CanvasSurface } from "../rendering/canvas-surface.js";

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
    surface: CanvasSurface,
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
      if (endPress(e) && !controller.getViewState().drawing) {
        controller.cancelInteraction();
      }
    };
    // ダブルクリック = 作図確定（最後の点を終点に）。
    const onDoubleClick = () => controller.commitLine();
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFormControl(e.target)) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        controller.cancelInteraction();
      } else if (e.key === "Enter") {
        // ボタン上の Enter はそのボタンを押す操作なので、作図の確定と二重にしない。
        if (!(e.target instanceof HTMLButtonElement)) {
          controller.commitLine();
        }
      } else if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          controller.redo();
        } else {
          controller.undo();
        }
      } else if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        controller.redo();
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
