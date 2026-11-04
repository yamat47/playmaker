export interface IDisposable {
  dispose(): void;
}

export function toDisposable(fn: () => void): IDisposable {
  return { dispose: fn };
}

/** Disposes items together. An item added after disposal is disposed on the spot. */
export class DisposableStore implements IDisposable {
  private readonly items = new Set<IDisposable>();
  private disposed = false;

  /** Lets async work that finishes after disposal check for it and do nothing. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  add<T extends IDisposable>(item: T): T {
    if (this.disposed) {
      item.dispose();
      return item;
    }
    this.items.add(item);
    return item;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const item of this.items) {
      item.dispose();
    }
    this.items.clear();
  }
}

/** Disposes everything passed to `_register` together with itself on dispose. */
export abstract class Disposable implements IDisposable {
  protected readonly _store = new DisposableStore();

  protected get isDisposed(): boolean {
    return this._store.isDisposed;
  }

  protected _register<T extends IDisposable>(item: T): T {
    return this._store.add(item);
  }

  dispose(): void {
    this._store.dispose();
  }
}
