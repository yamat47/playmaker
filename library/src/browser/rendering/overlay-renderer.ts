import {
  type EditorOverlay,
  PLAYER_RADIUS_YARDS,
  WAYPOINT_HANDLE_RADIUS_YARDS,
} from "../../common/index.js";
import type { EditorRenderFrame, ILayerRenderer } from "./layer.js";

/**
 * 選択の強調と、線の waypoint と終点のハンドルを描く。
 *
 * 選択色は対象の外側に置き、対象には重ねない（選手はマーカーの外周のリング、線はハンドル）。
 * 線の色はパレットで選ばれるので、上から塗ると線の色と混ざって何色の線か読めなくなる。
 */
export class OverlayRenderer implements ILayerRenderer<EditorRenderFrame> {
  draw(ctx: CanvasRenderingContext2D, frame: EditorRenderFrame): void {
    const { overlay } = frame;
    switch (overlay.kind) {
      case "none":
        return;
      case "player":
        drawSelectedPlayer(ctx, frame, overlay.playerId);
        return;
      case "line":
        drawLineHandles(ctx, frame, overlay);
        return;
    }
  }
}

function drawSelectedPlayer(
  ctx: CanvasRenderingContext2D,
  frame: EditorRenderFrame,
  playerId: string,
): void {
  const player = frame.scene.players.find((p) => p.id === playerId);
  if (player === undefined) {
    return;
  }
  const { x, y } = frame.geometry.toCanvas(player.position);
  const r = PLAYER_RADIUS_YARDS * frame.geometry.scale + 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = frame.theme("selection");
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLineHandles(
  ctx: CanvasRenderingContext2D,
  frame: EditorRenderFrame,
  handles: Extract<EditorOverlay, { kind: "line" }>,
): void {
  const { geometry } = frame;
  const fill = frame.theme("selection");
  const outline = frame.theme("selectionOutline");
  // アイコンは当たり判定の範囲（WAYPOINT_HANDLE_RADIUS_YARDS）の一部だけを描く。範囲いっぱいに
  // 描くとマーカー並みに大きくなるので小さく出し、掴みやすさは当たり判定の広さに任せる。
  const handleHalf = Math.max(3, 0.45 * WAYPOINT_HANDLE_RADIUS_YARDS * geometry.scale);
  // 現在の path（beginPath 済み）を、ハンドル共通の塗りと縁取りで仕上げる。
  const paintHandle = (): void => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outline;
    ctx.stroke();
  };
  for (const waypoint of handles.waypointHandles) {
    const { x, y } = geometry.toCanvas(waypoint);
    ctx.beginPath();
    ctx.rect(x - handleHalf, y - handleHalf, handleHalf * 2, handleHalf * 2);
    paintHandle();
  }
  // 終点のハンドルは、waypoint の四角と見分けられるよう円で描く。
  const { x, y } = geometry.toCanvas(handles.endpointHandle);
  ctx.beginPath();
  ctx.arc(x, y, handleHalf + 1, 0, Math.PI * 2);
  paintHandle();
}
