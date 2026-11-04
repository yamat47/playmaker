import {
  DEFAULT_PLAYER_FILL,
  PLAYER_RADIUS_YARDS,
  playerMarkerOutline,
} from "../../common/index.js";
import { fieldFont } from "../theme/field-font.js";
import type { ILayerRenderer, RenderFrame } from "./layer.js";

export class PlayerRenderer implements ILayerRenderer {
  draw(ctx: CanvasRenderingContext2D, frame: RenderFrame): void {
    const { geometry, metrics } = frame;
    const { players } = frame.scene;
    const defaultColor = frame.theme("playerColor");
    const grass = frame.theme("fieldGrass");
    const label = frame.theme("playerLabel");
    // The outline has the same radius as the hit area, and the stroke sits on top of it.
    const r = PLAYER_RADIUS_YARDS * geometry.scale;
    if (r <= 0) {
      return;
    }
    const fontPx = metrics.markerLabelFont;

    for (const player of players) {
      const center = geometry.toCanvas(player.position);
      const color = player.color ?? defaultColor;
      const isSolid = (player.fill ?? DEFAULT_PLAYER_FILL) === "solid";

      ctx.beginPath();
      const outline = playerMarkerOutline(player.shape, r);
      if (outline.kind === "circle") {
        ctx.arc(center.x, center.y, outline.radius, 0, Math.PI * 2);
      } else {
        const { halfSide } = outline;
        ctx.rect(center.x - halfSide, center.y - halfSide, halfSide * 2, halfSide * 2);
      }
      // Outline-only players get the grass color inside too, to hide lines that pass underneath.
      // Players in the end zone get the grass color as well. By default the end zone and the grass
      // differ too little to justify a fill that depends on position.
      ctx.fillStyle = isSolid ? color : grass;
      ctx.fill();
      ctx.lineWidth = metrics.markerStroke;
      ctx.strokeStyle = color;
      ctx.stroke();

      if (player.label !== "") {
        ctx.fillStyle = isSolid ? label : color;
        ctx.font = fieldFont(fontPx);
        ctx.textAlign = "center";
        // textBaseline middle aligns to the center of the em box, so it drifts up or down by font.
        // The center of the measured glyph bounds is aligned to the marker center instead.
        ctx.textBaseline = "alphabetic";
        const tm = ctx.measureText(player.label);
        const labelY = center.y + (tm.actualBoundingBoxAscent - tm.actualBoundingBoxDescent) / 2;
        ctx.fillText(player.label, center.x, labelY);
      }
    }
  }
}
