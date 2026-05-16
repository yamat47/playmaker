// common 層の公開面。DOM 非依存のロジックのみをここから export する。
// 以降のマイルストーンで model / geometry / commands / undoRedo / formations を追加する。

export { Emitter, type Event } from "./event/emitter.js";
export {
  Disposable,
  DisposableStore,
  type IDisposable,
  toDisposable,
} from "./lifecycle/disposable.js";
