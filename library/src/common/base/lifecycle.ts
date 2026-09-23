export interface IDisposable {
  dispose(): void;
}

export function toDisposable(fn: () => void): IDisposable {
  return { dispose: fn };
}

/** まとめて解放する。解放したあとに add したものは、その場で解放する。 */
export class DisposableStore implements IDisposable {
  private readonly items = new Set<IDisposable>();
  private disposed = false;

  /** 非同期の処理が終わったとき、破棄したあとなら何もしないための判定に使える。 */
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

/** `_register` に渡したものを、dispose のときに一緒に解放する。 */
export abstract class Disposable implements IDisposable {
  protected readonly _store = new DisposableStore();

  /** 非同期の処理が終わったとき、破棄したあとなら何もしないための判定に使える。 */
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
