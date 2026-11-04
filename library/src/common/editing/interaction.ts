import type { LinePatch } from "../commands/line-commands.js";
import type { PlayerPatch } from "../commands/player-commands.js";
import {
  DEFAULT_LINE_INTERPOLATION,
  DEFAULT_LINE_KIND,
  type Line,
  MAX_WAYPOINTS_PER_LINE,
} from "../model/line.js";
import type { FieldPosition, Player } from "../model/player.js";
import type { SceneData } from "./editor.js";

/** The target moved by a drag. */
export type DragTarget =
  | { readonly kind: "player"; readonly playerId: string }
  | { readonly kind: "waypoint"; readonly lineId: string; readonly index: number }
  | { readonly kind: "endpoint"; readonly lineId: string };

export interface DragInteraction {
  readonly type: "drag";
  readonly target: DragTarget;
  /** The position of the target when it was grabbed. */
  readonly origin: FieldPosition;
  /** The target position minus the pointer. Kept until release so the grabbed point stays put. */
  readonly grabOffset: FieldPosition;
  /** The current position of the target, after being clamped into the window. */
  readonly current: FieldPosition;
}

export interface DrawInteraction {
  readonly type: "draw-line";
  readonly startPlayerId: string;
  /**
   * The starting player's position when drawing began. Used to check whether the first placed
   * point is at the same position.
   */
  readonly start: FieldPosition;
  /** The placed points. The last one becomes the end point and the rest become waypoints. */
  readonly points: readonly FieldPosition[];
  readonly cursor: FieldPosition;
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
  | { readonly kind: "player"; readonly playerId: string; readonly patch: PlayerPatch }
  | { readonly kind: "line"; readonly lineId: string; readonly patch: LinePatch };

/** The change that puts the target at to. Undefined if the target is not in the scene. */
export function dragPatch(
  scene: SceneData,
  target: DragTarget,
  to: FieldPosition,
): DragPatch | undefined {
  switch (target.kind) {
    case "player":
      return scene.players.some((p) => p.id === target.playerId)
        ? { kind: "player", playerId: target.playerId, patch: { position: to } }
        : undefined;
    case "endpoint":
      return scene.lines.some((l) => l.id === target.lineId)
        ? { kind: "line", lineId: target.lineId, patch: { end: to } }
        : undefined;
    case "waypoint": {
      const line = scene.lines.find((l) => l.id === target.lineId);
      return line === undefined
        ? undefined
        : {
            kind: "line",
            lineId: line.id,
            patch: { waypoints: line.waypoints.map((w, i) => (i === target.index ? to : w)) },
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
export function startDrawing(player: Player): DrawInteraction {
  return {
    type: "draw-line",
    startPlayerId: player.id,
    start: player.position,
    points: [],
    cursor: player.position,
  };
}

/**
 * Places a point at point. When it is at the same position as the previous point (or the starting
 * player if there are no points yet), or the point limit has been reached, only the cursor advances
 * and no point is placed. Same positions are rejected because committing with a double-click
 * delivers pointerdown twice, which would place another point right on top of the previous one.
 */
export function addDraftPoint(draw: DrawInteraction, point: FieldPosition): DrawInteraction {
  const last = draw.points.at(-1) ?? draw.start;
  const accepts = !isSamePosition(last, point) && draw.points.length < MAX_DRAFT_POINTS;
  return { ...draw, points: accepts ? [...draw.points, point] : draw.points, cursor: point };
}

/**
 * The waypoints and end point of the line to commit. anchor is the current position of the starting
 * player. Undefined when there are no points, or when every placed point equals anchor and the
 * length is 0. A zero-length line is invisible and cannot be selected.
 */
export function committableDraft(
  draw: DrawInteraction,
  anchor: FieldPosition,
): { readonly waypoints: readonly FieldPosition[]; readonly end: FieldPosition } | undefined {
  const split = splitDraftPoints(draw.points);
  if (split === undefined) {
    return undefined;
  }
  return draw.points.every((p) => isSamePosition(p, anchor)) ? undefined : split;
}

/** Builds a line from the drawing. The preview and the commit use the same defaults. */
export function draftToLine(
  draw: DrawInteraction,
  id: string,
  shape: { readonly waypoints: readonly FieldPosition[]; readonly end: FieldPosition },
): Line {
  return {
    id,
    kind: DEFAULT_LINE_KIND,
    startPlayerId: draw.startPlayerId,
    waypoints: shape.waypoints,
    end: shape.end,
    interpolation: DEFAULT_LINE_INTERPOLATION,
  };
}
