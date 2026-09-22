// フィールド描画専用フォント（同梱・外部指定不可）のサブセット woff2 を生成する。
// 入力: assets/fonts/SairaCondensed-Bold.ttf（OFL。再生成のため vendor 済み）
// 出力: src/assets/playmaker-saira-subset.woff2（@font-face から参照、ビルドで CSS へ inline）
//
// 収録文字は「ヤード数字 + 選手ラベル」で実際に出る英数字と基本記号に限定する
// （サブセット B）。未収録グリフは @font-face の sans-serif フォールバックへ逃がす。
// 再生成: `node scripts/generate-field-font.mjs`

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
// 選手ラベルで現実的に使う記号（例: "C/G" "H-back" "WILL/MIKE"）+ 空白。
const symbols = " .-/&'(),:#+";
const CHARS = digits + upper + lower + symbols;

const source = await readFile(SOURCE);
const subset = await subsetFont(source, CHARS, { targetFormat: "woff2" });
await writeFile(OUTPUT, subset);

console.log(
  `generated ${OUTPUT}\n  glyphs for ${CHARS.length} chars, ${subset.length} bytes (was ${source.length})`,
);
