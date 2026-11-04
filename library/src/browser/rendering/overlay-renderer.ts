import {
  type EditorOverlay,
  PLAYER_RADIUS_YARDS,
  WAYPOINT_HANDLE_RADIUS_YARDS,
} from "../../common/index.js";
import type { EditorRenderFrame, ILayerRenderer } from "./layer.js";

/**
 * Draws the selection highlight and the handles for a line's waypoints and endpoint.
 *
 * The selection color sits outside the target rather than over it (a ring around the player marker,
 * handles on a line). Line colors come from the palette, so painting over would blend with the line
 * color and hide which color the line is.
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
  // The icon covers only part of the hit area (WAYPOINT_HANDLE_RADIUS_YARDS). Drawn to the full
  // area it would be as big as a marker, so it stays small and grabbing is left to the hit area.
  const handleHalf = Math.max(3, 0.45 * WAYPOINT_HANDLE_RADIUS_YARDS * geometry.scale);
  // Finishes the current path (after beginPath) with the fill and outline shared by all handles.
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
  // The endpoint handle is a circle so it can be told apart from the waypoint squares.
  const { x, y } = geometry.toCanvas(handles.endpointHandle);
  ctx.beginPath();
  ctx.arc(x, y, handleHalf + 1, 0, Math.PI * 2);
  paintHandle();
}
