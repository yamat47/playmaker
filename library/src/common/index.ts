export type { Event } from "./base/event.js";
export { Disposable, DisposableStore, type IDisposable, toDisposable } from "./base/lifecycle.js";
export { computeFieldMetrics, type FieldMetrics } from "./design/metrics.js";
export {
  EDITOR_TOOL_VALUES,
  type EditorOverlay,
  type EditorTool,
  type IEditorActions,
  type IEditorGestures,
  type IEditorScene,
  type IEditorUi,
  isLineTool,
  isToolAvailable,
  type SceneData,
} from "./editing/editor.js";
export { PlaySession } from "./editing/play-session.js";
export { type ImageExportOptions, resolveImageExportSize } from "./export/image-export.js";
export type { Formation, FormationPlayer } from "./formations/formation.js";
export { FORMATION_PRESETS, getFormationPreset } from "./formations/presets.js";
export {
  type CanvasPoint,
  DEFAULT_FIELD_LEAGUE,
  displayYardNumber,
  FIELD_WIDTH_YARDS,
  FieldGeometry,
  HASH_CENTER_OFFSET_YARDS_BY_LEAGUE,
  YARD_LINE_INTERVAL_YARDS,
  yardLinesInWindow,
} from "./geometry/field.js";
export { GRID_STEP_YARDS, snapToGrid } from "./geometry/grid.js";
export { WAYPOINT_HANDLE_RADIUS_YARDS } from "./geometry/hit-test.js";
export {
  arrowHeadVertices,
  blockCapEndpoints,
  trimForArrowHead,
} from "./geometry/line-decoration.js";
export { drawnLinePath } from "./geometry/line-path.js";
export { playerMarkerOutline } from "./geometry/player-marker.js";
export { resolveKeyAction } from "./input/keymap.js";
export { isOneOf } from "./model/guards.js";
export {
  LINE_INTERPOLATION_VALUES,
  LINE_KIND_VALUES,
  type Line,
  type LineInterpolation,
  type LineKind,
  MAX_LINES,
} from "./model/line.js";
export { migratePlayData } from "./model/migration.js";
export {
  CURRENT_PLAY_DATA_VERSION,
  FIELD_ZONE_LABELS,
  FIELD_ZONE_VALUES,
  type FieldState,
  type FieldZone,
  type PlayData,
  type PlayDataInput,
} from "./model/play-data.js";
export {
  DEFAULT_PLAYER_FILL,
  type FieldPosition,
  MAX_PLAYERS,
  PLAYER_FILL_VALUES,
  PLAYER_RADIUS_YARDS,
  PLAYER_SHAPE_VALUES,
  type Player,
  type PlayerFill,
  type PlayerShape,
} from "./model/player.js";
export type { PlayCategory, PlayPreset } from "./plays/play-preset.js";
export { getPlayPreset, PLAY_PRESETS } from "./plays/presets.js";
export type { TeamSide } from "./presets/shared.js";
