// フィールドの編集操作（PRD 5.4: フィールドゾーン切替）。DOM 非依存。

import type { FieldZone } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import type { ICommand } from "./command.js";

/** フィールドゾーンを切り替える。undo は切替前ゾーンへ差し戻す。 */
export class SetFieldZoneCommand implements ICommand {
  readonly label = "フィールドゾーンの切替";
  private previous: FieldZone | undefined;

  constructor(private readonly zone: FieldZone) {}

  apply(model: IPlayModel): void {
    // 直前ゾーンを捕捉（redo 時も最新を再捕捉して整合）。値型読取なので深いコピーは不要。
    this.previous = model.getFieldZone();
    model.setFieldZone(this.zone);
  }

  undo(model: IPlayModel): void {
    if (this.previous === undefined) {
      throw new Error("SetFieldZoneCommand.undo: apply 未実行");
    }
    model.setFieldZone(this.previous);
  }
}
