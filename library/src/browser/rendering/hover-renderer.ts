import { drawnLinePath, PLAYER_RADIUS_YARDS } from "../../common/index.js";
import type { EditorRenderFrame, ILayerRenderer } from "./layer.js";

// A soft halo is enough to say "a press acts on this"; at full strength it would read as selected.
const HOVER_ALPHA = 0.25;

function paintHalo(ctx: CanvasRenderingContext2D, frame: EditorRenderFrame): void {
  ctx.globalAlpha = HOVER_ALPHA;
  ctx.fillStyle = frame.theme("selection");
  ctx.strokeStyle = frame.theme("selection");
}

/**
 * Marks the player or line a press would act on. It is drawn in the backdrop, under the lines
 * and players, so the halo shows around the marked element without covering its color.
 */
export class HoverRenderer implements ILayerRenderer<EditorRenderFrame> {
  draw(ctx: CanvasRenderingContext2D, frame: EditorRenderFrame): void {
    const { hover, scene, geometry, metrics } = frame;
    switch (hover.kind) {
      case "none":
        return;
      case "player": {
        const player = scene.players.find((p) => p.id === hover.id);
        if (player === undefined) {
          return;
        }
        paintHalo(ctx, frame);
        const { x, y } = geometry.toCanvas(player.position);
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          PLAYER_RADIUS_YARDS * geometry.scale + metrics.routeWidth * 3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        return;
      }
      case "line": {
        const line = scene.lines.find((l) => l.id === hover.id);
        if (line === undefined) {
          return;
        }
        paintHalo(ctx, frame);
        ctx.lineWidth = metrics.routeWidth * 5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (const point of drawnLinePath(line, scene.players)) {
          const { x, y } = geometry.toCanvas(point);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }
    }
  }
}
