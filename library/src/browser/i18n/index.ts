import { ja } from "./ja.js";
import { en, type Messages, type PlaymakerLocale } from "./messages.js";

export { type Messages, PLAYMAKER_LOCALE_VALUES, type PlaymakerLocale } from "./messages.js";

const MESSAGES: Readonly<Record<PlaymakerLocale, Messages>> = { en, ja };

export function resolveMessages(locale: PlaymakerLocale): Messages {
  return MESSAGES[locale];
}
