import type { LinePatch } from "../commands/line-commands.js";
import {
  DEFAULT_LINE_INTERPOLATION,
  type Line,
  type LineKind,
  MAX_WAYPOINTS_PER_LINE,
} from "../model/line.js";
import type { FieldPosition, Player } from "../model/player.js";

/**
 * The target moved by a drag. A waypoint drag keeps the line's waypoints as they were when grabbed.
 * Any change to the diagram ends the drag, so they still match the line when it is dropped.
 */
export type DragTarget =
  | { readonly kind: "player"; readonly player: Player }
  | {
      readonly kind: "waypoint";
      readonly lineId: string;
      readonly index: number;
      readonly waypoints: readonly FieldPosition[];
    }
  | {
      readonly kind: "endpoint";
      readonly lineId: string;
      readonly startPlayerId: string;
      /** The point the line comes from on its way to the end: its last waypoint or its start. */
      readonly from: FieldPosition;
    }
  | {
      /** A new waypoint being pulled out of the middle of a segment, inserted at index. */
      readonly kind: "bend";
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
  /** The current position of the target, after being clamped into the window. */
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
   * The starting player's position when drawing began. Used to check whether the first placed
   * point is at the same position.
   */
  readonly start: FieldPosition;
  /** The placed points. The last one becomes the end point and the rest become waypoints. */
  readonly points: readonly FieldPosition[];
  readonly cursor: FieldPosition;
  /**
   * Whether the press that started the drawing is still held. Releasing it away from the start
   * player finishes a straight line in one drag; releasing it on the player leaves the drawing
   * open for clicks.
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
  | {
      readonly kind: "player";
      readonly player: Player;
      readonly to: FieldPosition;
      readonly withLines: boolean;
    }
  | { readonly kind: "line"; readonly lineId: string; readonly patch: LinePatch };

/** The change that puts the target at to. */
export function dragPatch(target: DragTarget, to: FieldPosition, alone: boolean): DragPatch {
  switch (target.kind) {
    case "player":
      return { kind: "player", player: target.player, to, withLines: !alone };
    case "endpoint":
      return { kind: "line", lineId: target.lineId, patch: { end: to } };
    case "waypoint":
      return {
        kind: "line",
        lineId: target.lineId,
        patch: { waypoints: target.waypoints.map((w, i) => (i === target.index ? to : w)) },
      };
    case "bend": {
      const { waypoints, index } = target;
      return {
        kind: "line",
        lineId: target.lineId,
        patch: { waypoints: [...waypoints.slice(0, index), to, ...waypoints.slice(index)] },
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

/** A line always starts at a player, so drawing begins from a player. */
export function startDrawing(player: Player, kind: LineKind): DrawInteraction {
  return {
    type: "draw-line",
    kind,
    startPlayerId: player.id,
    start: player.position,
    points: [],
    cursor: player.position,
    pressing: true,
  };
}

/**
 * Places a point at point. When it is at the same position as the previous point (or the starting
 * player if there are no points yet), or the point limit has been reached, only the cursor advances
 * and no point is placed. Same positions are rejected because committing with a double-click
 * delivers pointerdown twice, which would place another point right on top of the previous one.
 * Rejecting the starting player's position also keeps a committed line from having zero length,
 * which would be invisible and impossible to select.
 */
export function addDraftPoint(draw: DrawInteraction, point: FieldPosition): DrawInteraction {
  const last = draw.points.at(-1) ?? draw.start;
  const accepts = !isSamePosition(last, point) && draw.points.length < MAX_DRAFT_POINTS;
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
