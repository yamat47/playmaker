import type { PlayerShape } from "../model/player.js";

// A circle drawn at the circumscribed radius looks a size larger than a square, whose sides sit
// inside that circle, and covers block lines near the LOS. Only the drawn radius is brought toward
// the square's side width; a circle looks smaller by illusion, so it stays a bit larger than that.
// The hit test keeps the circumscribed circle regardless of shape.
const CIRCLE_DRAW_SCALE = 0.82;

export type PlayerMarkerOutline =
  | { readonly kind: "circle"; readonly radius: number }
  | { readonly kind: "square"; readonly halfSide: number };

/**
 * Outline of a player marker. radius is the circumscribed radius shared with the hit test; a
 * square is sized so that its corners lie on that circle.
 */
export function playerMarkerOutline(shape: PlayerShape, radius: number): PlayerMarkerOutline {
  switch (shape) {
    case "circle":
      return { kind: "circle", radius: radius * CIRCLE_DRAW_SCALE };
    case "square":
      return { kind: "square", halfSide: radius / Math.SQRT2 };
  }
}
