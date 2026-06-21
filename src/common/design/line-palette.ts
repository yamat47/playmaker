// 線色の選択肢（自由色ではなく既定パレットに絞る）。色そのものはテーマ既定の
// --playmaker-* トークンに紐づけ、host が上書きすればスウォッチも追従する。
// canvas は var() を解釈しないため、保存する Line.color は常に解決済みの具体色にする
// （cssVar は表示・解決のためのヒント、fallback は変数未定義時の具体色）。

export interface LineColorOption {
  readonly label: string;
  readonly cssVar: string;
  readonly fallback: string;
}

/** 既定テーマ色から視認性の高い 4 色を採る（金=ライン既定 / 白 / 紺 / 橙）。 */
export const LINE_COLOR_PALETTE: readonly LineColorOption[] = [
  { label: "金", cssVar: "--playmaker-line-route-color", fallback: "#c49a3c" },
  { label: "白", cssVar: "--playmaker-player-stroke", fallback: "#eef2ec" },
  { label: "紺", cssVar: "--playmaker-player-fill", fallback: "#2b4c72" },
  { label: "橙", cssVar: "--playmaker-pylon-color", fallback: "#d06a30" },
];
