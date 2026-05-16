import { describe, expect, it, vi } from "vitest";
import { Emitter } from "./emitter.js";

describe("Emitter", () => {
  it("登録したリスナに fire の値を通知する", () => {
    const emitter = new Emitter<number>();
    const listener = vi.fn();
    emitter.event(listener);

    emitter.fire(42);

    expect(listener).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("dispose で購読解除するとそれ以降通知されない", () => {
    const emitter = new Emitter<string>();
    const listener = vi.fn();
    const sub = emitter.event(listener);

    sub.dispose();
    emitter.fire("ignored");

    expect(listener).not.toHaveBeenCalled();
  });

  it("1 つのリスナが例外を投げても他のリスナは通知され、エラーは onListenerError に渡る", () => {
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

  it("通知中にリスナを解除しても今回の fire 列挙は安定する", () => {
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

  it("emitter 自体を dispose すると fire しても通知されない", () => {
    const emitter = new Emitter<number>();
    const listener = vi.fn();
    emitter.event(listener);

    emitter.dispose();
    emitter.fire(1);

    expect(listener).not.toHaveBeenCalled();
  });

  it("dispose 済みの emitter に event を登録しても IDisposable が返り、その dispose は例外を投げない", () => {
    // Arrange
    const emitter = new Emitter<number>();
    emitter.dispose();

    // Act
    const sub = emitter.event(vi.fn());

    // Assert: no-op な IDisposable が返り、dispose しても例外にならない
    expect(() => sub.dispose()).not.toThrow();
  });

  it("dispose 済みの emitter に登録したリスナは fire されても呼ばれない", () => {
    // Arrange
    const emitter = new Emitter<number>();
    emitter.dispose();
    const listener = vi.fn();
    emitter.event(listener);

    // Act
    emitter.fire(99);

    // Assert: リスナは一度も呼ばれない
    expect(listener).not.toHaveBeenCalled();
  });
});
