// 選手マーカー（6 形状・ラベル・色）を Canvas へ描く（PRD 5.2）。
// 位置決定は common の FieldGeometry に委譲し、本クラスは描画命令だけを持つ
// → ロジックは common 単体テストで網羅し、ここは VRT なしでも薄く保てる。

import { PLAYER_RADIUS_YARDS, playerMarkerOutline } from "../../common/index.js";
import { FIELD_FONT_FAMILY } from "../theme/field-font.js";
import type { ILayerRenderer, RenderFrame } from "./layer.js";

export class PlayerRenderer implements ILayerRenderer {
  /** players を配列順（後の要素ほど上）に描く。 */
  draw(ctx: CanvasRenderingContext2D, frame: RenderFrame): void {
    const { geometry, metrics } = frame;
    const { players } = frame.scene;
    const fill = frame.theme("playerFill");
    const stroke = frame.theme("playerStroke");
    const labelColor = frame.theme("playerLabel");
    // 半径は hit-test と一致させるため PLAYER_RADIUS_YARDS から導く（player.ts の不変条件）。
    // 枠線・ラベルは D 比トークン（metrics）を使い、寸法を 1 か所へ集約する。
    const r = PLAYER_RADIUS_YARDS * geometry.scale;
    if (r <= 0) {
      return;
    }
    const fontPx = metrics.markerLabelFont;
    const strokeWidth = metrics.markerStroke;

    for (const player of players) {
      const center = geometry.toCanvas(player.position);

      // 影・グラデーションを持たない完全フラット。塗り → 枠線の順で描く。
      ctx.beginPath();
      const outline = playerMarkerOutline(player.shape, center, r);
      if (outline.kind === "circle") {
        ctx.arc(center.x, center.y, outline.radius, 0, Math.PI * 2);
      } else {
        // 空のパスへの最初の lineTo は moveTo として働く。
        for (const vertex of outline.vertices) {
          ctx.lineTo(vertex.x, vertex.y);
        }
        ctx.closePath();
      }
      ctx.fillStyle = player.color ?? fill;
      ctx.fill();
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      if (player.label !== "") {
        ctx.fillStyle = labelColor;
        ctx.font = `700 ${fontPx}px ${FIELD_FONT_FAMILY}`;
        ctx.textAlign = "center";
        // textBaseline="middle" は em ボックス基準でフォント次第で上下にずれる。
        // 実際の字面ボックス（actualBoundingBox）の中心をマーカー中心へ合わせる。
        ctx.textBaseline = "alphabetic";
        const tm = ctx.measureText(player.label);
        const labelY = center.y + (tm.actualBoundingBoxAscent - tm.actualBoundingBoxDescent) / 2;
        ctx.fillText(player.label, center.x, labelY);
      }
    }
  }
}
