// 線の編集操作（PRD 5.4: 描画 / 削除 / プロパティ編集 / waypoint 編集）。DOM 非依存。
// 各コマンドは apply 時に逆操作用の状態を自分で捕捉する（redo でも再捕捉され整合する）。

import type { Line } from "../model/line.js";
import { cloneLine } from "../model/line.js";
import type { IPlayModel, LineRemoval } from "../model/play-model.js";
import { type ICommand, requireApplied } from "./command.js";
import { applyLinePatch, type LinePatch } from "./patch.js";

/** 線を 1 本追加する。undo は同 id の削除。 */
export class AddLineCommand implements ICommand {
  readonly label = "線の追加";
  private readonly line: Line;

  constructor(line: Line) {
    this.line = cloneLine(line);
  }

  apply(model: IPlayModel): void {
    model.addLine(this.line);
  }

  undo(model: IPlayModel): void {
    model.removeLine(this.line.id);
  }
}

/** 線を 1 本削除する。undo はメメントから元の位置へ復元。 */
export class RemoveLineCommand implements ICommand {
  readonly label = "線の削除";
  private readonly lineId: string;
  private removal: LineRemoval | undefined;

  constructor(lineId: string) {
    this.lineId = lineId;
  }

  apply(model: IPlayModel): void {
    this.removal = model.removeLine(this.lineId);
  }

  undo(model: IPlayModel): void {
    const { line, index } = requireApplied(this.removal, "RemoveLineCommand");
    model.insertLine(line, index);
  }
}

/** 線の形（waypoint・終点）やプロパティを編集する。undo は編集前の線へ差し戻す。 */
export class UpdateLineCommand implements ICommand {
  readonly label = "線の編集";
  private readonly lineId: string;
  private readonly patch: LinePatch;
  private previous: Line | undefined;

  constructor(lineId: string, patch: LinePatch) {
    this.lineId = lineId;
    this.patch = { ...patch };
  }

  apply(model: IPlayModel): void {
    const current = model.findLine(this.lineId);
    if (current === undefined) {
      throw new Error(`UpdateLineCommand: unknown line id "${this.lineId}"`);
    }
    this.previous = model.updateLine(applyLinePatch(current, this.patch));
  }

  undo(model: IPlayModel): void {
    model.updateLine(requireApplied(this.previous, "UpdateLineCommand"));
  }
}
