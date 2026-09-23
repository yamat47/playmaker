import { type Mock, onTestFinished, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { FieldGeometry } from "../../common/geometry/field.js";
import type { FieldPosition } from "../../common/model/player.js";
import { type PlayData, Playmaker, type PlaymakerOptions } from "../../playmaker.js";

/** canvas の左上からの位置（CSS px）。userEvent の position に渡す。 */
export interface CanvasOffset {
  readonly x: number;
  readonly y: number;
}

export interface MountedPlaymaker {
  readonly playmaker: Playmaker;
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** onDidChange に渡った図。 */
  readonly onChange: Mock<(data: PlayData) => void>;
  /** 今の図のゾーンで、ヤードの位置が canvas のどこに描かれるか。 */
  at(position: FieldPosition): CanvasOffset;
  /** canvas の上のヤードの位置をクリックする。 */
  click(position: FieldPosition): Promise<void>;
  /** canvas の上で from を押し、to まで動かして離す。 */
  drag(from: FieldPosition, to: FieldPosition): Promise<void>;
}

/**
 * 大きさを決めた container に Playmaker を置く。テストが終わると dispose して container も外す。
 * container の中の要素は、ホストが見るのと同じ DOM で確かめる。
 */
export function mountPlaymaker(options: Omit<PlaymakerOptions, "onChange"> = {}): MountedPlaymaker {
  const container = document.createElement("div");
  container.style.width = "960px";
  container.style.height = "640px";
  document.body.appendChild(container);
  const onChange = vi.fn<(data: PlayData) => void>();
  const playmaker = new Playmaker(container, { ...options, onChange });
  onTestFinished(() => {
    playmaker.dispose();
    container.remove();
  });

  const canvas = container.querySelector("canvas");
  if (canvas === null) {
    throw new Error("Playmaker が canvas を置いていない");
  }
  const at = (position: FieldPosition): CanvasOffset => {
    const host = canvas.parentElement ?? canvas;
    const { field } = playmaker.getPlayData();
    return new FieldGeometry(host.clientWidth, host.clientHeight, field).toCanvas(position);
  };
  return {
    playmaker,
    container,
    canvas,
    onChange,
    at,
    click: (position) => userEvent.click(canvas, { position: at(position) }),
    drag: (from, to) =>
      userEvent.dragAndDrop(canvas, canvas, {
        sourcePosition: at(from),
        targetPosition: at(to),
      }),
  };
}
