import type { LinePatch } from "../commands/line-commands.js";
import type { PlayerMove } from "../commands/player-commands.js";
import { GRID_STEP_YARDS } from "../geometry/grid.js";
import { pointDistance } from "../geometry/hit-test.js";
import {
  DEFAULT_LINE_INTERPOLATION,
  type Line,
  type LineKind,
  MAX_WAYPOINTS_PER_LINE,
} from "../model/line.js";
import { type FieldPosition, PLAYER_RADIUS_YARDS, type Player } from "../model/player.js";

/**
 * How far the pointer may travel during a press and still count as a click. A press that trembles
 * a little must not move a handle that sits off the grid, such as an insert handle, to the nearest
 * grid point.
 */
export const CLICK_SLOP_YARDS = GRID_STEP_YARDS / 2;

/**
 * The target moved by a drag. A waypoint drag keeps the line's waypoints as they were when grabbed.
 * Any change to the diagram ends the drag, so they still match the line when it is dropped.
 */
export type DragTarget =
  | { readonly kind: "player"; readonly playerId: string }
  | {
      readonly kind: "waypoint";
      readonly lineId: string;
      readonly index: number;
      readonly waypoints: readonly FieldPosition[];
    }
  | { readonly kind: "endpoint"; readonly lineId: string }
  | {
      /** A new waypoint being pulled out of the middle of a segment, inserted at index. */
      readonly kind: "insert";
      readonly lineId: string;
      readonly index: number;
      readonly waypoints: readonly FieldPosition[];
    };

export interface DragInteraction {
  readonly type: "drag";
  readonly target: DragTarget;
  /** The position of the target when it was grabbed. */
  readonly origin: FieldPosition;
  /** The target position minus the pointer. Kept until release so the grabbed point stays put. */
  readonly grabOffset: FieldPosition;
  /**
   * The current position of the target, after being clamped into the window. Stays at origin
   * until the pointer has traveled CLICK_SLOP_YARDS.
   */
  readonly current: FieldPosition;
  /** Whether a dragged player leaves its lines where they are (Option or Alt held). */
  readonly alone: boolean;
}

export interface DrawInteraction {
  readonly type: "draw-line";
  /** The kind of the line tool the drawing started with. */
  readonly kind: LineKind;
  readonly startPlayerId: string;
  /**
   * The starting player's position when drawing began. Used to keep the first placed point off
   * the starting player's marker.
   */
  readonly start: FieldPosition;
  /** Where the press that started the drawing went down, somewhere on the starting player. */
  readonly pressedAt: FieldPosition;
  /** The placed points. The last one becomes the end point and the rest become waypoints. */
  readonly points: readonly FieldPosition[];
  readonly cursor: FieldPosition;
  /**
   * Whether the press that started the drawing is still held. Releasing it off the start player,
   * after the pointer has traveled CLICK_SLOP_YARDS, finishes a straight line in one drag;
   * releasing it on the player, or after a mere tremble, leaves the drawing open for clicks.
   */
  readonly pressing: boolean;
}

/** The in-progress state of a drag or drawing. Not put into the Model; overlaid when rendering. */
export type Interaction = DragInteraction | DrawInteraction;

/** Whether the coordinates match exactly. For grid points, this is the "same point" test. */
export function isSamePosition(a: FieldPosition, b: FieldPosition): boolean {
  return a.lateralYard === b.lateralYard && a.downfieldYard === b.downfieldYard;
}

/**
 * How many points can be placed while drawing. One more than the waypoint limit, because the
 * last point becomes the end point.
 */
export const MAX_DRAFT_POINTS = MAX_WAYPOINTS_PER_LINE + 1;

export function startDrag(
  target: DragTarget,
  origin: FieldPosition,
  pointer: FieldPosition,
): DragInteraction {
  return {
    type: "drag",
    target,
    origin,
    grabOffset: {
      lateralYard: origin.lateralYard - pointer.lateralYard,
      downfieldYard: origin.downfieldYard - pointer.downfieldYard,
    },
    current: origin,
    alone: false,
  };
}

/** Where to put the target while keeping the offset between the grabbed point and the pointer. */
export function dragPosition(drag: DragInteraction, pointer: FieldPosition): FieldPosition {
  return {
    lateralYard: pointer.lateralYard + drag.grabOffset.lateralYard,
    downfieldYard: pointer.downfieldYard + drag.grabOffset.downfieldYard,
  };
}

/**
 * The change that puts the target at the drag destination. Both the preview and the commit apply
 * it, so what is shown never differs from the result.
 */
export type DragPatch =
  | { readonly kind: "player"; readonly move: PlayerMove }
  | { readonly kind: "line"; readonly lineId: string; readonly patch: LinePatch };

/** The change that puts the dragged target at its current position. */
export function dragPatch({ target, origin, current, alone }: DragInteraction): DragPatch {
  switch (target.kind) {
    case "player":
      return {
        kind: "player",
        move: { playerId: target.playerId, from: origin, to: current, withLines: !alone },
      };
    case "endpoint":
      return { kind: "line", lineId: target.lineId, patch: { end: current } };
    case "waypoint":
      return {
        kind: "line",
        lineId: target.lineId,
        patch: { waypoints: target.waypoints.map((w, i) => (i === target.index ? current : w)) },
      };
    case "insert": {
      const { waypoints, index } = target;
      return {
        kind: "line",
        lineId: target.lineId,
        patch: { waypoints: [...waypoints.slice(0, index), current, ...waypoints.slice(index)] },
      };
    }
  }
}

/**
 * Splits the placed points into the waypoints and end point of the line to commit. Undefined if
 * there are no points.
 */
export function splitDraftPoints(
  points: readonly FieldPosition[],
): { readonly waypoints: readonly FieldPosition[]; readonly end: FieldPosition } | undefined {
  const end = points.at(-1);
  return end === undefined ? undefined : { waypoints: points.slice(0, -1), end };
}

/** A line always starts at a player, so drawing begins from a press on a player. */
export function startDrawing(
  player: Player,
  kind: LineKind,
  pressedAt: FieldPosition,
): DrawInteraction {
  return {
    type: "draw-line",
    kind,
    startPlayerId: player.id,
    start: player.position,
    pressedAt,
    points: [],
    cursor: player.position,
    pressing: true,
  };
}

/**
 * Places a point at point. When it is at the same position as the previous point, when it is the
 * first point and lies on the starting player's marker, or when the point limit has been reached,
 * only the cursor advances and no point is placed. Same positions are rejected because committing
 * with a double-click delivers pointerdown twice, which would place another point right on top of
 * the previous one. A first point on the marker would begin the line hidden under it, and a line
 * ending there would be invisible and impossible to select.
 */
export function addDraftPoint(draw: DrawInteraction, point: FieldPosition): DrawInteraction {
  const last = draw.points.at(-1);
  const clear =
    last === undefined
      ? pointDistance(point, draw.start) > PLAYER_RADIUS_YARDS
      : !isSamePosition(last, point);
  const accepts = clear && draw.points.length < MAX_DRAFT_POINTS;
  return { ...draw, points: accepts ? [...draw.points, point] : draw.points, cursor: point };
}

/** Builds a line from the drawing. The preview and the commit use the same defaults. */
export function draftToLine(
  draw: DrawInteraction,
  id: string,
  shape: { readonly waypoints: readonly FieldPosition[]; readonly end: FieldPosition },
): Line {
  return {
    id,
    kind: draw.kind,
    startPlayerId: draw.startPlayerId,
    waypoints: shape.waypoints,
    end: shape.end,
    interpolation: DEFAULT_LINE_INTERPOLATION,
  };
}
