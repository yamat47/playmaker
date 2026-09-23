/**
 * CSS の色を、canvas の fillStyle が返す書式にそろえる関数を作る。
 * 書き方が違っても同じ色なら同じ文字列になり、不透明な色は `#rrggbb` の小文字になる。
 * 色として読めない値は undefined を返す。2D コンテキストを確保できないときは、値をそのまま返す。
 */
export function createCssColorNormalizer(): (value: string) => string | undefined {
  const ctx = document.createElement("canvas").getContext("2d");
  if (ctx === null) {
    return (value) => value;
  }
  return (value) => {
    // 読めない値を代入しても、fillStyle は前の値のまま残る。
    // 違う色から 2 回代入し、結果が揃えば読めた色とみなす。
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const fromBlack = ctx.fillStyle;
    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = value;
    return typeof fromBlack === "string" && ctx.fillStyle === fromBlack ? fromBlack : undefined;
  };
}
