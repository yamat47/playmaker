import type { PlayerShape } from "../model/player.js";
import type { CanvasPoint } from "./field.js";

type PolygonShape = Exclude<PlayerShape, "circle">;

const POLYGON_SIDES: Record<PolygonShape, number> = {
  triangle: 3,
  square: 4,
  diamond: 4,
  pentagon: 5,
  hexagon: 6,
};

// square は頂点を上に置くと菱形に見えるため、辺が水平になるよう 45° 回す。
const SHAPE_ROTATION: Record<PolygonShape, number> = {
  triangle: 0,
  square: Math.PI / 4,
  diamond: 0,
  pentagon: 0,
  hexagon: 0,
};

// 円を外接円の半径で描くと、辺が円の内側に入る多角形より一回り大きく見え、LOS 際のブロックの線を覆う。
// 描く半径だけを正方形の辺の幅へ寄せる。円は錯視で小さく見えるので、辺の幅より少し大きくしてある。
// 当たり判定は形状によらず外接円のままにする。
const CIRCLE_DRAW_SCALE = 0.82;

export type PlayerMarkerOutline =
  | { readonly kind: "circle"; readonly radius: number }
  | { readonly kind: "polygon"; readonly vertices: readonly CanvasPoint[] };

/**
 * 選手マーカーの輪郭。radius は当たり判定と同じ外接円の半径で、多角形の頂点はすべてこの円の上に置く。
 * 正方形は辺を水平に、それ以外の多角形は頂点を真上に向ける。
 */
export function playerMarkerOutline(
  shape: PlayerShape,
  center: CanvasPoint,
  radius: number,
): PlayerMarkerOutline {
  if (shape === "circle") {
    return { kind: "circle", radius: radius * CIRCLE_DRAW_SCALE };
  }
  const sides = POLYGON_SIDES[shape];
  // Canvas は y が下向きなので、-π/2 が真上になる。
  const start = -Math.PI / 2 + SHAPE_ROTATION[shape];
  const vertices = Array.from({ length: sides }, (_, i) => {
    const angle = start + (i * 2 * Math.PI) / sides;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
  return { kind: "polygon", vertices };
}
