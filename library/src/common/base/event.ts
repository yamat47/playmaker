import { type IDisposable, toDisposable } from "./lifecycle.js";

// common is type-checked against the ECMAScript lib only, so the host's console has no type.
// Declare and use only console.error, which every host (browser, Node) has, inside this module.
declare const console: { error(...data: unknown[]): void };

/** Registers a listener and returns an IDisposable that ends the subscription. */
export type Event<T> = (listener: (e: T) => void) => IDisposable;

/** Keeps notifying the remaining listeners even when a listener throws. */
export class Emitter<T> implements IDisposable {
  private listeners = new Set<(e: T) => void>();
  private disposed = false;
  private readonly onListenerError: (err: unknown) => void;

  /**
   * Receives the exceptions thrown by listeners. The default writes them to console.error.
   * They are not rethrown so that one failing listener does not stop the remaining listeners
   * and the caller of fire.
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
    // Listeners added or removed during a notification do not change who is notified this round.
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
