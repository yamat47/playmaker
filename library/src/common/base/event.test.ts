import { describe, expect, it, vi } from "vitest";
import { Emitter } from "./event.js";

describe("Emitter", () => {
  it("notifies a registered listener with the value passed to fire", () => {
    const emitter = new Emitter<number>();
    const listener = vi.fn();
    emitter.event(listener);

    emitter.fire(42);

    expect(listener).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("stops notifying a listener once its subscription is disposed", () => {
    const emitter = new Emitter<string>();
    const listener = vi.fn();
    const sub = emitter.event(listener);

    sub.dispose();
    emitter.fire("ignored");

    expect(listener).not.toHaveBeenCalled();
  });

  it("passes a throwing listener's error to onListenerError and still notifies the rest", () => {
    const onListenerError = vi.fn();
    const emitter = new Emitter<void>(onListenerError);
    const error = new Error("boom");
    const failing = vi.fn(() => {
      throw error;
    });
    const ok = vi.fn();
    emitter.event(failing);
    emitter.event(ok);

    emitter.fire();

    expect(ok).toHaveBeenCalledOnce();
    expect(onListenerError).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("still notifies a listener that an earlier listener disposes during the same fire", () => {
    const emitter = new Emitter<void>();
    let disposeSecond = (): void => {};
    const first = vi.fn(() => disposeSecond());
    const second = vi.fn();
    emitter.event(first);
    const sub = emitter.event(second);
    disposeSecond = () => sub.dispose();

    emitter.fire();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("notifies nobody once the emitter itself is disposed", () => {
    const emitter = new Emitter<number>();
    const listener = vi.fn();
    emitter.event(listener);

    emitter.dispose();
    emitter.fire(1);

    expect(listener).not.toHaveBeenCalled();
  });

  it("returns an IDisposable whose dispose does not throw when subscribing after disposal", () => {
    const emitter = new Emitter<number>();
    emitter.dispose();

    const sub = emitter.event(vi.fn());

    expect(() => sub.dispose()).not.toThrow();
  });

  it("never calls a listener registered after the emitter is disposed", () => {
    const emitter = new Emitter<number>();
    emitter.dispose();
    const listener = vi.fn();
    emitter.event(listener);

    emitter.fire(99);

    expect(listener).not.toHaveBeenCalled();
  });
});
