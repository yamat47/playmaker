// common 層の公開面。DOM 非依存のロジックのみをここから export する。
// 以降のマイルストーンで commands / undoRedo / formations を追加する。

export { Emitter, type Event } from "./event/emitter.js";
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
  createEmptyPlayData,
  DEFAULT_FIELD_ZONE,
  type FieldState,
  type FieldZone,
  isFieldZone,
  type PlayData,
  resolvePlayData,
} from "./model/play-data.js";
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
