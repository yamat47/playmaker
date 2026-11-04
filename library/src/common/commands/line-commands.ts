import type { Line } from "../model/line.js";
import type { IPlayModel, LineRemoval } from "../model/play-model.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyPatch, type Patch, patchChangesAnything } from "./patch.js";

/** The id and the starting player identify a line, so a patch never changes them. */
export type LinePatch = Patch<Omit<Line, "id" | "startPlayerId">>;

export function applyLinePatch(current: Line, patch: LinePatch): Line {
  return applyPatch<Line>(current, patch);
}

export class AddLineCommand implements ICommand {
  readonly label = "Add line";
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

/** Undo puts the line back at its original position in the order. */
export class RemoveLineCommand implements ICommand {
  readonly label = "Delete line";
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

/** Edits the kind, interpolation, waypoints, end point, color, and thickness together. */
export class UpdateLineCommand implements ICommand {
  readonly label = "Update line";
  private readonly lineId: string;
  private readonly patch: LinePatch;
  private previous: Line | undefined;

  constructor(lineId: string, patch: LinePatch) {
    this.lineId = lineId;
    this.patch = { ...patch };
  }

  apply(model: IPlayModel): boolean {
    const current = model.getLine(this.lineId);
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
