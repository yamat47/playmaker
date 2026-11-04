// Names and summaries are English only; they are not localized through the ja dictionary.

import type { PlayData } from "../model/play-data.js";
import type { TeamSide } from "../presets/shared.js";

/** The kind of play. It carries no color; how it appears in a list is up to the consumer. */
export type PlayCategory =
  | "run-zone"
  | "run-gap"
  | "pass-quick"
  | "pass-dropback"
  | "pass-deep"
  | "pa"
  | "rpo"
  | "coverage"
  | "pressure";

/** A play diagram drawn down to the lines, with the information needed to show it in a list. */
export interface PlayPreset {
  readonly id: string;
  readonly name: string;
  readonly side: TeamSide;
  readonly category: PlayCategory;
  /** A short note on the personnel or formation (for example "11 pers" or "Nickel"). */
  readonly personnel: string;
  /** A one-line description of the concept. */
  readonly summary: string;
  /** Can be passed to setPlayData as is. */
  readonly data: PlayData;
}
