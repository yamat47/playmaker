// Build a woff2 of the font for text drawn on the field, narrowed to the characters in use. Run with `make font`.
// The source ttf is kept in the repository so the subset can be regenerated (SIL OFL 1.1).
// Only the alphanumerics and symbols that appear in yard numbers and player labels are included; other characters are drawn in sans-serif.
// The font is embedded into the JS at build time, so every unused character makes the library larger.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(root, "assets/fonts/SairaCondensed-Bold.ttf");
const OUTPUT = resolve(root, "src/assets/playmaker-saira-subset.woff2");

const digits = "0123456789";
const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lower = "abcdefghijklmnopqrstuvwxyz";
// Symbols likely to appear in player labels (for example "C/G", "H-back", "WILL/MIKE") and the space.
const symbols = " .-/&'(),:#+";
const CHARS = digits + upper + lower + symbols;

const source = await readFile(SOURCE);
const subset = await subsetFont(source, CHARS, { targetFormat: "woff2" });
await writeFile(OUTPUT, subset);

console.log(
  `generated ${OUTPUT}\n  glyphs for ${CHARS.length} chars, ${subset.length} bytes (was ${source.length})`,
);
