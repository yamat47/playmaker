// ヤード数字と選手ラベルは同梱のフォントに固定し、テーマでは差し替えさせない。
// ctx.font は CSS の var() を解釈できないので、変数ではなくこの定数から組み立てる。
// 名前はホストのページのフォントと重ならないよう、ライブラリ専用にしてある。
export const FIELD_FONT_NAME = "Playmaker Saira";
export const FIELD_FONT_WEIGHT = 700;
export const FIELD_FONT_FAMILY = `"${FIELD_FONT_NAME}", sans-serif`;

/** 同梱フォントで sizePx の大きさに描く、ctx.font の値。 */
export function fieldFont(sizePx: number): string {
  return `${FIELD_FONT_WEIGHT} ${sizePx}px ${FIELD_FONT_FAMILY}`;
}
