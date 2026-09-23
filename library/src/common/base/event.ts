import { type IDisposable, toDisposable } from "./lifecycle.js";

// common は ECMAScript の lib だけで型検査するので、ホストが持つ console には型がない。
// どのホスト（ブラウザ、Node）にもある console.error だけを、このモジュールの中で宣言して使う。
declare const console: { error(...data: unknown[]): void };

/** リスナを登録し、購読をやめるための IDisposable を返す。 */
export type Event<T> = (listener: (e: T) => void) => IDisposable;

/** リスナが throw しても、残りのリスナには通知する。 */
export class Emitter<T> implements IDisposable {
  private listeners = new Set<(e: T) => void>();
  private disposed = false;
  private readonly onListenerError: (err: unknown) => void;

  /**
   * リスナが投げた例外を受け取る。既定は console.error に出す。
   * 投げ直さないのは、1 つのリスナの失敗で、残りのリスナと fire を呼んだ側まで止めないため。
   */
  constructor(onListenerError: (err: unknown) => void = console.error) {
    this.onListenerError = onListenerError;
  }

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
    // 通知の途中でリスナが登録や解除をしても、この回に通知する相手は変えない。
    for (const listener of [...this.listeners]) {
      try {
        listener(e);
      } catch (err) {
        this.onListenerError(err);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}
