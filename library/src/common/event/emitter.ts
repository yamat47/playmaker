// VSCode の base/common/event 相当の極小実装。
// DOM 非依存。Model→View の購読や onChange 通知の土台に使う。

import { type IDisposable, toDisposable } from "../lifecycle/disposable.js";

/**
 * リスナを登録すると購読解除用の IDisposable を返す関数。
 */
export type Event<T> = (listener: (e: T) => void) => IDisposable;

/**
 * イベントの発火元。`event` を公開し `fire` で通知する。
 * リスナ実行中の例外は他リスナの実行を妨げない。
 */
export class Emitter<T> implements IDisposable {
  private listeners = new Set<(e: T) => void>();
  private disposed = false;

  /**
   * リスナが投げた例外の扱い。既定は console.error（VSCode の onUnexpectedError 相当）。
   * 再 throw しないことで 1 つの失敗が他リスナや上流を巻き込まないようにする。
   */
  constructor(private readonly onListenerError: (err: unknown) => void = console.error) {}

  readonly event: Event<T> = (listener) => {
    if (this.disposed) {
      return toDisposable(() => {});
    }
    this.listeners.add(listener);
    return toDisposable(() => {
      this.listeners.delete(listener);
    });
  };

  fire(e: T): void {
    if (this.disposed) {
      return;
    }
    // 列挙中の add/remove に影響されないようコピーしてから通知する。
    for (const listener of [...this.listeners]) {
      try {
        listener(e);
      } catch (err) {
        // 1 つのリスナの失敗で他リスナや上流を止めない。
        this.onListenerError(err);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}
