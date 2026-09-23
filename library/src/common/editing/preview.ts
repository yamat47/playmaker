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

/** 作図中の線の id。Model には入らず、プレビューの中だけで使う。 */
const DRAFT_LINE_ID = "__playmaker_draft_line__";

// 起点が選手の線は、選手を差し替えるだけで追従する。
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
  // 打点が上限に達したら、確定される線と同じく最後の打点を終点として描く。
  const full = draw.points.length >= MAX_DRAFT_POINTS ? splitDraftPoints(draw.points) : undefined;
  return draftToLine(draw, DRAFT_LINE_ID, full ?? { waypoints: draw.points, end: draw.cursor });
}

/** 確定済みの図に、ドラッグや作図の途中の状態を重ねる。data は書き換えない。 */
export function composePreview(data: SceneData, interaction: Interaction | undefined): SceneData {
  if (interaction === undefined) {
    return data;
  }
  switch (interaction.type) {
    case "drag": {
      const drop = dragPatch(data, interaction.target, interaction.current);
      return drop === undefined ? data : applyDragPatch(data, drop);
    }
    case "draw-line":
      return { ...data, lines: [...data.lines, draftLine(interaction)] };
  }
}

/**
 * 選択の強調とハンドルの位置。scene には composePreview で途中の状態を重ねたものを渡す。
 * そうするとドラッグ中のハンドルもドラッグ先に描ける。
 */
export function computeOverlay(scene: SceneData, selection: EditorSelection): EditorOverlay {
  if (selection?.kind === "player") {
    return { kind: "player", playerId: selection.id };
  }
  const line =
    selection?.kind === "line" ? scene.lines.find((l) => l.id === selection.id) : undefined;
  if (line === undefined) {
    return { kind: "none" };
  }
  return { kind: "line", waypointHandles: line.waypoints, endpointHandle: line.end };
}
