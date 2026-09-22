// Canvas のポインタ/キーボード入力を EditorController のジェスチャへ変換する。
// 座標規約（px→ヤード）は CanvasSurface に集約し、編集判断は common 側が持つ。
// ここは「DOM イベントを意味のある操作に翻訳する」だけの薄い層（browser・最小限）。

import { Disposable, type IEditorController, toDisposable } from "../../common/index.js";
import type { CanvasSurface } from "../rendering/canvas-surface.js";

export class PointerInput extends Disposable {
  constructor(surface: CanvasSurface, controller: IEditorController) {
    super();
    const canvas = surface.canvas;
    // Esc / Enter / Undo・Redo を受け取れるようフォーカス可能にする。
    canvas.tabIndex = 0;

    const toYard = (e: PointerEvent) => surface.clientToYard(e.clientX, e.clientY);

    const onPointerDown = (e: PointerEvent) => {
      canvas.focus();
      canvas.setPointerCapture(e.pointerId);
      controller.pointerDown(toYard(e));
    };
    // draw-line のラバーバンドはボタン非押下でも追従させたいので常に渡す
    // （interaction が無ければ controller 側で無視される）。
    const onPointerMove = (e: PointerEvent) => controller.pointerMove(toYard(e));
    const onPointerUp = (e: PointerEvent) => {
      controller.pointerUp(toYard(e));
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    };
    // ダブルクリック = 作図確定（最後の点を終点に）。
    const onDoubleClick = () => controller.commitLine();
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        controller.cancelInteraction();
      } else if (e.key === "Enter") {
        controller.commitLine();
      } else if (mod && (e.key === "z" || e.key === "Z")) {
        // PRD 8.1: Undo/Redo のショートカットはスコープ内（それ以外は対象外）。
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

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("dblclick", onDoubleClick);
    canvas.addEventListener("keydown", onKeyDown);
    this._register(
      toDisposable(() => {
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("dblclick", onDoubleClick);
        canvas.removeEventListener("keydown", onKeyDown);
      }),
    );
  }
}
