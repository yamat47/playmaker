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

  protected _register<T extends IDisposable>(item: T): T {
    return this._store.add(item);
  }

  dispose(): void {
    this._store.dispose();
  }
}
