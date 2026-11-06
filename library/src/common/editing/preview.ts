import { applyLinePatch } from "../commands/line-commands.js";
import { applyPlayerPatch } from "../commands/player-commands.js";
import type { Line } from "../model/line.js";
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

// A line starts at a player, so replacing the player is enough for the line to follow.
function applyDragPatch(data: SceneData, drop: DragPatch): SceneData {
  switch (drop.kind) {
    case "player":
      return {
        ...data,
        players: data.players.map((p) =>
          p.id === drop.playerId ? applyPlayerPatch(p, drop.patch) : p,
        ),
      };
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
      return applyDragPatch(data, dragPatch(interaction.target, interaction.current));
    case "draw-line":
      return { ...data, lines: [...data.lines, draftLine(interaction)] };
  }
}

/**
 * The selection highlight and handle positions. Pass as scene the result of composePreview, with
 * the in-progress state overlaid. That way a handle being dragged is drawn at the drag destination.
 */
export function computeOverlay(scene: SceneData, selection: EditorSelection): EditorOverlay {
  if (selection.kind === "player") {
    return { kind: "player", playerId: selection.id };
  }
  const line =
    selection.kind === "line" ? scene.lines.find((l) => l.id === selection.id) : undefined;
  if (line === undefined) {
    return { kind: "none" };
  }
  return { kind: "line", waypointHandles: line.waypoints, endpointHandle: line.end };
}
