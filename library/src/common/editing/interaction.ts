import type { LinePatch } from "../commands/line-commands.js";
import type { PlayerPatch } from "../commands/player-commands.js";
import { pointDistance } from "../geometry/hit-test.js";
import { segments } from "../geometry/polyline.js";
import {
  DEFAULT_LINE_INTERPOLATION,
  DEFAULT_LINE_KIND,
  type Line,
  MAX_WAYPOINTS_PER_LINE,
} from "../model/line.js";
import type { FieldPosition, Player } from "../model/player.js";
import type { SceneData } from "./editor.js";

/** ドラッグで動かす対象。 */
export type DragTarget =
  | { readonly kind: "player"; readonly playerId: string }
  | { readonly kind: "waypoint"; readonly lineId: string; readonly index: number }
  | { readonly kind: "endpoint"; readonly lineId: string };

export interface DragInteraction {
  readonly type: "drag";
  readonly target: DragTarget;
  /** 掴んだときの対象の位置。 */
  readonly origin: FieldPosition;
  /** 対象の位置からポインタを引いた差。離すまで保ち、掴んだ点がずれないようにする。 */
  readonly grabOffset: FieldPosition;
  /** 窓の中へ寄せたあとの、いまの対象の位置。 */
  readonly current: FieldPosition;
}

export interface DrawInteraction {
  readonly type: "draw-line";
  readonly startPlayerId: string;
  /** 作図を始めた時点の起点選手の位置。最初の打点の近接判定に使う。 */
  readonly start: FieldPosition;
  /** 打った点。最後の点が終点になり、残りが waypoint になる。 */
  readonly points: readonly FieldPosition[];
  readonly cursor: FieldPosition;
}

/** ドラッグや作図の途中の状態。Model には載せず、描画のときに重ねる。 */
export type Interaction = DragInteraction | DrawInteraction;

// 作図中、直前点（点がまだ無ければ起点の選手）とこの距離（ヤード）以内のクリックは
// 同一点とみなし打点しない。ダブルクリック確定は pointerdown を 2 度発火させ、
// 直前点の真上に重複点を打つため、それを構造的に防ぐ。全長がこれ以下の線も確定しない。
// 手動の意図的な近接打点は実用上ない粒度。
const LINE_POINT_MERGE_RADIUS_YARDS = 0.5;

/** 作図で打てる点の数。最後の点は終点になるので、waypoint の上限より 1 つ多い。 */
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

/** 掴んだ点とポインタのずれを保ったまま、対象を置く位置。 */
export function dragPosition(drag: DragInteraction, pointer: FieldPosition): FieldPosition {
  return {
    lateralYard: pointer.lateralYard + drag.grabOffset.lateralYard,
    downfieldYard: pointer.downfieldYard + drag.grabOffset.downfieldYard,
  };
}

/** ドラッグ先に対象を置く変更。プレビューと確定の両方がこれを当てるので、見た目と結果がずれない。 */
export type DragPatch =
  | { readonly kind: "player"; readonly playerId: string; readonly patch: PlayerPatch }
  | { readonly kind: "line"; readonly lineId: string; readonly patch: LinePatch };

/** 対象を to に置く変更。対象が scene に無ければ undefined。 */
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

/** 打った点を、確定する線の waypoint と終点に分ける。点が無ければ undefined。 */
export function splitDraftPoints(
  points: readonly FieldPosition[],
): { readonly waypoints: readonly FieldPosition[]; readonly end: FieldPosition } | undefined {
  const end = points.at(-1);
  return end === undefined ? undefined : { waypoints: points.slice(0, -1), end };
}

/** 線の起点は必ず選手なので、選手から作図を始める。 */
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
 * point に点を打つ。直前の点とほぼ同じ位置のときと、打てる点の上限に達したときは、
 * 打たずにカーソルだけ進める。
 */
export function addDraftPoint(draw: DrawInteraction, point: FieldPosition): DrawInteraction {
  const last = draw.points.at(-1) ?? draw.start;
  const accepts =
    pointDistance(last, point) > LINE_POINT_MERGE_RADIUS_YARDS &&
    draw.points.length < MAX_DRAFT_POINTS;
  return { ...draw, points: accepts ? [...draw.points, point] : draw.points, cursor: point };
}

/**
 * 確定する線の waypoint と終点。anchor はいまの起点選手の位置。点が無いときと、
 * anchor から見た全長が 0 に近いときは undefined。
 * 長さが 0 に近い線は見えず、選択もしにくい。
 */
export function committableDraft(
  draw: DrawInteraction,
  anchor: FieldPosition,
): { readonly waypoints: readonly FieldPosition[]; readonly end: FieldPosition } | undefined {
  let length = 0;
  for (const [a, b] of segments([anchor, ...draw.points])) {
    length += pointDistance(a, b);
  }
  return length <= LINE_POINT_MERGE_RADIUS_YARDS ? undefined : splitDraftPoints(draw.points);
}

/** 作図から線を組み立てる。プレビューと確定で同じ既定値を使う。 */
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
