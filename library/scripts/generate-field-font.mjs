// フィールドに描く文字のフォントを、使う文字だけに絞った woff2 にする。`make font` で動かす。
// 元の ttf は作り直せるようにリポジトリに置いてある（SIL OFL 1.1）。
// ヤードの数字と選手のラベルに出る英数字と記号だけを入れ、ほかの文字は sans-serif で描く。
// フォントはビルドで JS に埋め込むので、使わない文字の分だけライブラリが大きくなる。

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
// 選手のラベルに使いそうな記号（例: "C/G"、"H-back"、"WILL/MIKE"）と空白。
const symbols = " .-/&'(),:#+";
const CHARS = digits + upper + lower + symbols;

const source = await readFile(SOURCE);
const subset = await subsetFont(source, CHARS, { targetFormat: "woff2" });
await writeFile(OUTPUT, subset);

console.log(
  `generated ${OUTPUT}\n  glyphs for ${CHARS.length} chars, ${subset.length} bytes (was ${source.length})`,
);
