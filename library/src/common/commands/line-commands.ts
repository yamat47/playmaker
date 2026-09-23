import type { Line } from "../model/line.js";
import type { IPlayModel, LineRemoval } from "../model/play-model.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyPatch, type Patch, patchChangesAnything } from "./patch.js";

/** id と起点の選手は線を見分ける鍵なので、パッチでは変えない。 */
export type LinePatch = Patch<Omit<Line, "id" | "startPlayerId">>;

export function applyLinePatch(current: Line, patch: LinePatch): Line {
  return applyPatch<Line>(current, patch);
}

export class AddLineCommand implements ICommand {
  readonly label = "線の追加";
  private readonly line: Line;

  constructor(line: Line) {
    this.line = line;
  }

  apply(model: IPlayModel): boolean {
    model.addLine(this.line);
    return true;
  }

  undo(model: IPlayModel): void {
    model.removeLine(this.line.id);
  }
}

/** undo は線を元の並びの位置へ戻す。 */
export class RemoveLineCommand implements ICommand {
  readonly label = "線の削除";
  private readonly lineId: string;
  private removal: LineRemoval | undefined;

  constructor(lineId: string) {
    this.lineId = lineId;
  }

  apply(model: IPlayModel): boolean {
    this.removal = model.removeLine(this.lineId);
    return true;
  }

  undo(model: IPlayModel): void {
    const { line, index } = requireApplied(this.removal, this);
    model.insertLine(line, index);
  }
}

/** 種別、補間、waypoint、終点、色、太さをまとめて編集する。 */
export class UpdateLineCommand implements ICommand {
  readonly label = "線の編集";
  private readonly lineId: string;
  private readonly patch: LinePatch;
  private previous: Line | undefined;

  constructor(lineId: string, patch: LinePatch) {
    this.lineId = lineId;
    this.patch = { ...patch };
  }

  apply(model: IPlayModel): boolean {
    const current = model.requireLine(this.lineId);
    if (!patchChangesAnything(current, this.patch)) {
      return false;
    }
    this.previous = model.updateLine(applyLinePatch(current, this.patch));
    return true;
  }

  undo(model: IPlayModel): void {
    model.updateLine(requireApplied(this.previous, this));
  }
}
