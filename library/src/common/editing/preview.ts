import { applyLinePatch } from "../commands/line-commands.js";
import { movePlayer } from "../commands/player-commands.js";
import { segmentMidpoints } from "../geometry/bezier.js";
import type { LineHandles } from "../geometry/hit-test.js";
import {
  indexPlayersById,
  type Line,
  lineAnchorPoints,
  MAX_WAYPOINTS_PER_LINE,
} from "../model/line.js";
import type { EditorOverlay, EditorSelection, SceneData } from "./editor.js";
import {
  type DragPatch,
  type DrawInteraction,
  draftToLine,
  dragPatch,
  type Interaction,
  MAX_DRAFT_POINTS,
  splitDraftPoints,
} from "./interaction.js";

/** The id of the line being drawn. Never enters the Model; used only inside the preview. */
const DRAFT_LINE_ID = "__playmaker_draft_line__";

function applyDragPatch(data: SceneData, drop: DragPatch): SceneData {
  switch (drop.kind) {
    case "player":
      return movePlayer(data, drop.move);
    case "line":
      return {
        ...data,
        lines: data.lines.map((l) => (l.id === drop.lineId ? applyLinePatch(l, drop.patch) : l)),
      };
  }
}

function draftLine(draw: DrawInteraction): Line {
  // Once the point limit is reached, draw the last placed point as the end point, just as the
  // committed line will have it.
  const full = draw.points.length >= MAX_DRAFT_POINTS ? splitDraftPoints(draw.points) : undefined;
  return draftToLine(draw, DRAFT_LINE_ID, full ?? { waypoints: draw.points, end: draw.cursor });
}

/** Overlays the in-progress drag or drawing on the committed diagram. Does not modify data. */
export function composePreview(data: SceneData, interaction: Interaction | undefined): SceneData {
  if (interaction === undefined) {
    return data;
  }
  switch (interaction.type) {
    case "drag":
      return applyDragPatch(data, dragPatch(interaction));
    case "draw-line":
      return { ...data, lines: [...data.lines, draftLine(interaction)] };
  }
}

/**
 * The selection highlight and handle positions. Pass as scene the result of composePreview, with
 * the in-progress state overlaid. That way a handle being dragged is drawn at the drag destination.
 */
export function computeOverlay(
  scene: SceneData,
  selection: EditorSelection,
  pickedWaypoint: number | undefined,
): EditorOverlay {
  if (selection.kind === "player") {
    return { kind: "player", playerId: selection.id };
  }
  const line =
    selection.kind === "line" ? scene.lines.find((l) => l.id === selection.id) : undefined;
  if (line === undefined) {
    return { kind: "none" };
  }
  return { kind: "line", pickedWaypoint, ...lineHandles(scene, line) };
}

/**
 * The handles of a line. The model keeps no line without its start player, so the anchors are
 * always found; the check only narrows the type. A line at the waypoint limit takes no more
 * waypoints, so it has no insert handles.
 */
export function lineHandles(scene: SceneData, line: Line): LineHandles {
  const anchors = lineAnchorPoints(line, indexPlayersById(scene.players));
  return {
    waypointHandles: line.waypoints,
    endpointHandle: line.end,
    insertHandles:
      anchors === undefined || line.waypoints.length >= MAX_WAYPOINTS_PER_LINE
        ? []
        : segmentMidpoints(anchors, line.interpolation),
  };
}
