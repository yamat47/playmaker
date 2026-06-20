import { describe, expect, it, vi } from "vitest";
import { Disposable, DisposableStore, toDisposable } from "./disposable.js";

describe("DisposableStore", () => {
  it("追加した全ての IDisposable を dispose する", () => {
    const store = new DisposableStore();
    const a = vi.fn();
    const b = vi.fn();
    store.add(toDisposable(a));
    store.add(toDisposable(b));

    store.dispose();

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("二重 dispose しても二度解放しない", () => {
    const store = new DisposableStore();
    const fn = vi.fn();
    store.add(toDisposable(fn));

    store.dispose();
    store.dispose();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("dispose 後に add したものは即座に解放される（リーク防止）", () => {
    const store = new DisposableStore();
    store.dispose();
    const late = vi.fn();

    store.add(toDisposable(late));

    expect(late).toHaveBeenCalledOnce();
  });

  it("isDisposed は dispose の前後で false → true に変わる", () => {
    const store = new DisposableStore();
    expect(store.isDisposed).toBe(false);

    store.dispose();

    expect(store.isDisposed).toBe(true);
  });
});

describe("Disposable", () => {
  it("_register した従属リソースを dispose で一括解放する", () => {
    const child = vi.fn();
    class Sample extends Disposable {
      constructor() {
        super();
        this._register(toDisposable(child));
      }
    }

    const sample = new Sample();
    sample.dispose();

    expect(child).toHaveBeenCalledOnce();
  });

  it("isDisposed で破棄状態を子クラスから判定できる", () => {
    class Sample extends Disposable {
      get disposedNow(): boolean {
        return this.isDisposed;
      }
    }

    const sample = new Sample();
    expect(sample.disposedNow).toBe(false);

    sample.dispose();

    expect(sample.disposedNow).toBe(true);
  });
});
