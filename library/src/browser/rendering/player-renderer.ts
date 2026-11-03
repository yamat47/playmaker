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
    // 当たり判定と同じ半径の輪郭を描き、縁取りはその上に乗せる。
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
      // 枠線だけの選手も内側を芝の色で塗り、下を通る線を隠す。エンドゾーンに置いた選手も芝の色で塗る。
      // 既定ではエンドゾーンと芝の差がわずかで気にならず、どこにいるかで塗りを変えるほどではない。
      ctx.fillStyle = isSolid ? color : grass;
      ctx.fill();
      ctx.lineWidth = metrics.markerStroke;
      ctx.strokeStyle = color;
      ctx.stroke();

      if (player.label !== "") {
        ctx.fillStyle = isSolid ? label : color;
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
