import type { FieldZone } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import { type ICommand, requireApplied } from "./command.js";

export class SetFieldZoneCommand implements ICommand {
  readonly label = "フィールドゾーンの切替";
  private readonly zone: FieldZone;
  private previous: FieldZone | undefined;

  constructor(zone: FieldZone) {
    this.zone = zone;
  }

  apply(model: IPlayModel): void {
    this.previous = model.getFieldZone();
    model.setFieldZone(this.zone);
  }

  undo(model: IPlayModel): void {
    model.setFieldZone(requireApplied(this.previous, this));
  }
}
