import { PLAYER_RADIUS_YARDS, playerMarkerOutline } from "../../common/index.js";
import { fieldFont } from "../theme/field-font.js";
import type { ILayerRenderer, RenderFrame } from "./layer.js";

export class PlayerRenderer implements ILayerRenderer {
  /** 後の要素ほど上に描く。 */
  draw(ctx: CanvasRenderingContext2D, frame: RenderFrame): void {
    const { geometry, metrics } = frame;
    const { players } = frame.scene;
    const fill = frame.theme("playerFill");
    const stroke = frame.theme("playerStroke");
    const labelColor = frame.theme("playerLabel");
    // 当たり判定と同じ半径で描く。
    const r = PLAYER_RADIUS_YARDS * geometry.scale;
    if (r <= 0) {
      return;
    }
    const fontPx = metrics.markerLabelFont;
    const strokeWidth = metrics.markerStroke;

    for (const player of players) {
      const center = geometry.toCanvas(player.position);

      ctx.beginPath();
      const outline = playerMarkerOutline(player.shape, r);
      if (outline.kind === "circle") {
        ctx.arc(center.x, center.y, outline.radius, 0, Math.PI * 2);
      } else {
        const { halfSide } = outline;
        ctx.rect(center.x - halfSide, center.y - halfSide, halfSide * 2, halfSide * 2);
      }
      ctx.fillStyle = player.color ?? fill;
      ctx.fill();
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      if (player.label !== "") {
        ctx.fillStyle = labelColor;
        ctx.font = fieldFont(fontPx);
        ctx.textAlign = "center";
        // textBaseline を middle にすると、字の em ボックスの中央に揃うので、フォントによって上下にずれる。
        // 測った字面の中央をマーカーの中心に合わせる。
        ctx.textBaseline = "alphabetic";
        const tm = ctx.measureText(player.label);
        const labelY = center.y + (tm.actualBoundingBoxAscent - tm.actualBoundingBoxDescent) / 2;
        ctx.fillText(player.label, center.x, labelY);
      }
    }
  }
}
