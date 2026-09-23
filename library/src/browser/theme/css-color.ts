// 色を読むためだけの 2D コンテキスト。確保できなかったことも覚えておき、毎回作り直さない。
let context: CanvasRenderingContext2D | null | undefined;

/**
 * CSS の色を、canvas の fillStyle が返す書式にそろえる。
 * 書き方が違っても同じ色なら同じ文字列になり、不透明な色は `#rrggbb` の小文字になる。
 * 色として読めない値は undefined を返す。2D コンテキストを確保できないときは、値をそのまま返す。
 */
export function normalizeCssColor(value: string): string | undefined {
  if (context === undefined) {
    context = document.createElement("canvas").getContext("2d");
  }
  if (context === null) {
    return value;
  }
  // 読めない値を代入しても、fillStyle は前の値のまま残る。
  // 違う色から 2 回代入し、結果が揃えば読めた色とみなす。
  context.fillStyle = "#000000";
  context.fillStyle = value;
  const fromBlack = context.fillStyle;
  context.fillStyle = "#ffffff";
  context.fillStyle = value;
  return typeof fromBlack === "string" && context.fillStyle === fromBlack ? fromBlack : undefined;
}
