import { describe, expect, it, vi } from "vitest";
import { Disposable, DisposableStore, toDisposable } from "./lifecycle.js";

describe("DisposableStore", () => {
  it("disposes every IDisposable that was added", () => {
    const store = new DisposableStore();
    const a = vi.fn();
    const b = vi.fn();
    store.add(toDisposable(a));
    store.add(toDisposable(b));

    store.dispose();

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("releases each item only once when disposed twice", () => {
    const store = new DisposableStore();
    const fn = vi.fn();
    store.add(toDisposable(fn));

    store.dispose();
    store.dispose();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("releases an item added after disposal immediately so it cannot leak", () => {
    const store = new DisposableStore();
    store.dispose();
    const late = vi.fn();

    store.add(toDisposable(late));

    expect(late).toHaveBeenCalledOnce();
  });

  it("reports isDisposed as false before dispose and true after", () => {
    const store = new DisposableStore();
    expect(store.isDisposed).toBe(false);

    store.dispose();

    expect(store.isDisposed).toBe(true);
  });
});

describe("Disposable", () => {
  it("releases every resource passed to _register when disposed", () => {
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

  it("exposes the disposed state to subclasses through isDisposed", () => {
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
