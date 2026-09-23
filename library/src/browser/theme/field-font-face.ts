// 元のフォントは Saira Condensed Bold（SIL OFL 1.1、library/assets/fonts/OFL.txt）。作り直すには make font。
import fontUrl from "../../assets/playmaker-saira-subset.woff2";
import { FIELD_FONT_NAME, FIELD_FONT_WEIGHT } from "./field-font.js";

let loaded: Promise<void> | undefined;

/**
 * 同梱フォントを document.fonts に登録し、読み込み終えたら解決する。何度呼んでも登録は 1 回だけ。
 * CSS の @font-face で宣言すると、ホストが CSS を読み込むまでフォントが見えず、
 * その間に描いた数字とラベルは代わりのフォントになる。
 * 読み込めなくても代わりのフォントで描けるので、reject しない。
 */
export function loadFieldFont(): Promise<void> {
  loaded ??= registerFieldFont();
  return loaded;
}

async function registerFieldFont(): Promise<void> {
  try {
    const face = new FontFace(FIELD_FONT_NAME, `url("${fontUrl}")`, {
      weight: String(FIELD_FONT_WEIGHT),
    });
    document.fonts.add(face);
    await face.load();
  } catch {
    // 代わりのフォントのまま描く。
  }
}
