// common 層の公開面。DOM 非依存のロジックのみをここから export する。
// 以降のマイルストーンで formations を追加する。

export type { ICommand } from "./commands/command.js";
export {
  CommandService,
  type ICommandService,
} from "./commands/command-service.js";
export { SetFieldZoneCommand } from "./commands/field-commands.js";
export { LoadFormationCommand } from "./commands/formation-commands.js";
export {
  AddLineCommand,
  type LinePatch,
  RemoveLineCommand,
  SetLineWaypointsCommand,
  UpdateLineCommand,
} from "./commands/line-commands.js";
export {
  AddPlayerCommand,
  MovePlayerCommand,
  type PlayerPatch,
  RemovePlayerCommand,
  UpdatePlayerCommand,
} from "./commands/player-commands.js";
export {
  EditorController,
  type EditorOverlay,
  type EditorSelection,
  type EditorTool,
  type EditorViewState,
  type IEditorController,
  WAYPOINT_HANDLE_RADIUS_YARDS,
} from "./editing/editor-controller.js";
export { IdFactory, type IIdFactory } from "./editing/id-factory.js";
export { Emitter, type Event } from "./event/emitter.js";
export {
  DEFAULT_EXPORT_WIDTH,
  FIELD_WINDOW_ASPECT,
  type ImageExportOptions,
  type ImageExportSize,
  resolveImageExportSize,
  resolveImageExportWidth,
} from "./export/image-export.js";
export {
  type Formation,
  type FormationPlayer,
  type FormationSide,
  isFormationSide,
  normalizeFormation,
} from "./formations/formation.js";
export { FORMATION_PRESETS, getFormationPreset } from "./formations/presets.js";
export {
  catmullRomBezierControls,
  cubicBezierPoint,
  DEFAULT_BEZIER_SAMPLES_PER_SEGMENT,
  sampleLinePath,
} from "./geometry/bezier.js";
export {
  type CanvasPoint,
  displayYardNumber,
  END_ZONE_DEPTH_YARDS,
  FIELD_WIDTH_YARDS,
  FieldGeometry,
  fieldZoneWindow,
  HASH_FROM_SIDELINE_YARDS,
  isEndZone,
  RED_ZONE_DEPTH_YARDS,
  type YardWindow,
  yardLinesInWindow,
  ZONE_WINDOW_LENGTH_YARDS,
} from "./geometry/field.js";
export {
  distanceToSegment,
  hitTestLine,
  hitTestPlayer,
  LINE_HIT_TOLERANCE_YARDS,
} from "./geometry/hit-test.js";
export {
  Disposable,
  DisposableStore,
  type IDisposable,
  toDisposable,
} from "./lifecycle/disposable.js";
export {
  cloneLine,
  DEFAULT_LINE_INTERPOLATION,
  DEFAULT_LINE_KIND,
  indexPlayersById,
  isLineInterpolation,
  isLineKind,
  type Line,
  type LineInterpolation,
  type LineKind,
  lineAnchorPoints,
  normalizeLines,
} from "./model/line.js";
export {
  applyPlayDataMigrations,
  migratePlayData,
  PLAY_DATA_MIGRATIONS,
  type PlayDataMigration,
  readDeclaredVersion,
} from "./model/migration.js";
export {
  CURRENT_PLAY_DATA_VERSION,
  clonePlayData,
  createEmptyPlayData,
  DEFAULT_FIELD_ZONE,
  type FieldState,
  type FieldZone,
  isFieldZone,
  type PlayData,
  resolvePlayData,
} from "./model/play-data.js";
export {
  type IPlayModel,
  type LineRemoval,
  type PlayerRemoval,
  PlayModel,
} from "./model/play-model.js";
export {
  clonePlayer,
  DEFAULT_PLAYER_SHAPE,
  type FieldPosition,
  isPlayerShape,
  normalizePlayers,
  PLAYER_RADIUS_YARDS,
  type Player,
  type PlayerShape,
} from "./model/player.js";
export {
  type IUndoRedoService,
  UndoRedoService,
} from "./undoRedo/undo-redo-service.js";
