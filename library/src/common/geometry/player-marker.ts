import type { PlayerShape } from "../model/player.js";

// 円を外接円の半径で描くと、辺が円の内側に入る正方形より一回り大きく見え、LOS 際のブロックの線を覆う。
// 描く半径だけを正方形の辺の幅へ寄せる。円は錯視で小さく見えるので、辺の幅より少し大きくしてある。
// 当たり判定は形状によらず外接円のままにする。
const CIRCLE_DRAW_SCALE = 0.82;

export type PlayerMarkerOutline =
  | { readonly kind: "circle"; readonly radius: number }
  | { readonly kind: "square"; readonly halfSide: number };

/** 選手マーカーの輪郭。radius は当たり判定と同じ外接円の半径で、正方形は頂点がこの円に乗る大きさにする。 */
export function playerMarkerOutline(shape: PlayerShape, radius: number): PlayerMarkerOutline {
  switch (shape) {
    case "circle":
      return { kind: "circle", radius: radius * CIRCLE_DRAW_SCALE };
    case "square":
      return { kind: "square", halfSide: radius / Math.SQRT2 };
  }
}
