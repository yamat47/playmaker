// VSCode の base/common/lifecycle 相当の極小実装。
// DOM 非依存。リソース解放のライフサイクルを統一する。

export interface IDisposable {
  dispose(): void;
}

export function toDisposable(fn: () => void): IDisposable {
  return { dispose: fn };
}

/**
 * 複数の IDisposable をまとめて管理し、一括解放する。
 * 解放後に add されたものは即座に解放される（リーク防止）。
 */
export class DisposableStore implements IDisposable {
  private readonly items = new Set<IDisposable>();
  private disposed = false;

  /** 破棄済みか。非同期完了時に「破棄後の作用」を抑止する判定に使う。 */
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

/**
 * IDisposable を持つオブジェクトの基底。`_register` で従属リソースを束ねる。
 */
export abstract class Disposable implements IDisposable {
  protected readonly _store = new DisposableStore();

  /** 破棄済みか。非同期完了コールバックが破棄後に作用しないようガードするのに使う。 */
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
