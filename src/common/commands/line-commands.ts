// 線の編集操作（PRD 5.4: 描画 / 削除 / プロパティ編集 / waypoint 編集）。DOM 非依存。
// 各コマンドは apply 時に逆操作用の状態を自分で捕捉する（redo でも再捕捉され整合する）。

import type { Line, LineInterpolation, LineKind } from "../model/line.js";
import { cloneLine } from "../model/line.js";
import type { IPlayModel, LineRemoval } from "../model/play-model.js";
import type { FieldPosition } from "../model/player.js";
import type { ICommand } from "./command.js";

/** プロパティ編集で差し替え可能な項目（種別・補間・色・太さ）。指定キーのみ上書きする。 */
export interface LinePatch {
  kind?: LineKind;
  interpolation?: LineInterpolation;
  color?: string;
  thickness?: number;
}

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
  private removal: LineRemoval | undefined;

  constructor(private readonly lineId: string) {}

  apply(model: IPlayModel): void {
    this.removal = model.removeLine(this.lineId);
  }

  undo(model: IPlayModel): void {
    if (this.removal === undefined) {
      throw new Error("RemoveLineCommand.undo: apply 未実行");
    }
    model.insertLine(this.removal.line, this.removal.index);
  }
}

/** 線のプロパティ（種別・補間・色・太さ）を編集する。undo は編集前へ差し戻す。 */
export class UpdateLineCommand implements ICommand {
  readonly label = "線プロパティの編集";
  private readonly patch: LinePatch;
  private previous: Line | undefined;

  constructor(
    private readonly lineId: string,
    patch: LinePatch,
  ) {
    this.patch = { ...patch };
  }

  apply(model: IPlayModel): void {
    const current = model.findLine(this.lineId);
    if (current === undefined) {
      throw new Error(`UpdateLineCommand: unknown line id "${this.lineId}"`);
    }
    const next = cloneLine(current);
    if (this.patch.kind !== undefined) {
      next.kind = this.patch.kind;
    }
    if (this.patch.interpolation !== undefined) {
      next.interpolation = this.patch.interpolation;
    }
    if (this.patch.color !== undefined) {
      next.color = this.patch.color;
    }
    if (this.patch.thickness !== undefined) {
      next.thickness = this.patch.thickness;
    }
    this.previous = model.updateLine(next);
  }

  undo(model: IPlayModel): void {
    if (this.previous === undefined) {
      throw new Error("UpdateLineCommand.undo: apply 未実行");
    }
    model.updateLine(this.previous);
  }
}

/** 線の waypoint 列を丸ごと差し替える（PRD 5.4 waypoint 編集の可逆プリミティブ）。 */
export class SetLineWaypointsCommand implements ICommand {
  readonly label = "waypoint の編集";
  private readonly waypoints: FieldPosition[];
  private previous: Line | undefined;

  constructor(
    private readonly lineId: string,
    waypoints: readonly FieldPosition[],
  ) {
    this.waypoints = waypoints.map((p) => ({ ...p }));
  }

  apply(model: IPlayModel): void {
    const current = model.findLine(this.lineId);
    if (current === undefined) {
      throw new Error(`SetLineWaypointsCommand: unknown line id "${this.lineId}"`);
    }
    this.previous = model.updateLine({
      ...current,
      waypoints: this.waypoints.map((p) => ({ ...p })),
    });
  }

  undo(model: IPlayModel): void {
    if (this.previous === undefined) {
      throw new Error("SetLineWaypointsCommand.undo: apply 未実行");
    }
    model.updateLine(this.previous);
  }
}

/** 線の終点を移動する。waypoint と独立に end だけを差し替える可逆プリミティブ。 */
export class SetLineEndCommand implements ICommand {
  readonly label = "終点の移動";
  private readonly end: FieldPosition;
  private previous: Line | undefined;

  constructor(
    private readonly lineId: string,
    end: FieldPosition,
  ) {
    this.end = { ...end };
  }

  apply(model: IPlayModel): void {
    const current = model.findLine(this.lineId);
    if (current === undefined) {
      throw new Error(`SetLineEndCommand: unknown line id "${this.lineId}"`);
    }
    this.previous = model.updateLine({ ...current, end: { ...this.end } });
  }

  undo(model: IPlayModel): void {
    if (this.previous === undefined) {
      throw new Error("SetLineEndCommand.undo: apply 未実行");
    }
    model.updateLine(this.previous);
  }
}
