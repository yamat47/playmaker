// browser 層の公開面。DOM / Canvas 依存の実装をここから export する。
// 以降のマイルストーンで ui / input を追加する。

export { CanvasSurface } from "./rendering/canvas-surface.js";
export { FieldRenderer, type FieldTheme } from "./rendering/field-renderer.js";
