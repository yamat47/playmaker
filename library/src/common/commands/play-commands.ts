import { FIELD_WIDTH_YARDS } from "../geometry/field.js";
import type { PlayData } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import type { FieldPosition } from "../model/player.js";
import { type ICommand, requireApplied } from "./command.js";

const CENTER_LATERAL_YARD = FIELD_WIDTH_YARDS / 2;

// The field is 53 yards wide so that its center, 26.5, is a grid point; mirrored grid points stay
// on the grid.
function mirror(position: FieldPosition): FieldPosition {
  return { ...position, lateralYard: FIELD_WIDTH_YARDS - position.lateralYard };
}

/**
 * The diagram mirrored left to right. Labels stay as they are: the players keep their names and
 * only change sides.
 */
function flipPlay(data: PlayData): PlayData {
  return {
    ...data,
    players: data.players.map((p) => ({ ...p, position: mirror(p.position) })),
    lines: data.lines.map((l) => ({
      ...l,
      waypoints: l.waypoints.map(mirror),
      end: mirror(l.end),
    })),
  };
}

/** Mirrors every player and line left to right, so a play drawn to one side can be run to the other. */
export class FlipPlayCommand implements ICommand {
  readonly label = "Flip play";
  private previous: PlayData | undefined;

  apply(model: IPlayModel): boolean {
    const data = model.getSnapshot();
    const points = [
      ...data.players.map((p) => p.position),
      ...data.lines.flatMap((l) => [...l.waypoints, l.end]),
    ];
    // A diagram empty or lying on the center line looks the same mirrored, so it is not an edit.
    if (points.every((p) => p.lateralYard === CENTER_LATERAL_YARD)) {
      return false;
    }
    this.previous = model.replaceAll(flipPlay(data));
    return true;
  }

  // Edits are undone in reverse order, so putting back the whole previous diagram undoes the flip.
  undo(model: IPlayModel): void {
    model.replaceAll(requireApplied(this.previous, this));
  }
}
