import type { Messages } from "./messages.js";

export const ja: Messages = {
  tool: { select: "選択", "add-player": "選手を追加", "draw-line": "線を描く" },
  undo: "元に戻す",
  redo: "やり直す",
  delete: "削除",
  zone: { "own-redzone": "自陣RZ", middle: "中央", redzone: "相手RZ" },
  playerLimit: (maxPlayers) => `選手は ${maxPlayers} 人までです`,
  lineLimit: (maxLines) => `線は ${maxLines} 本までです`,
  selectionHint: "対象を選択するとプロパティを編集できます",
  drawingHint:
    "クリックで折れ点を置きます。ダブルクリックか Enter で線を確定し、Esc で取り消します。",
  player: "選手",
  line: "線",
  label: "ラベル",
  shape: "形状",
  color: "色",
  kind: "種別",
  interpolation: "補間",
  shapes: { circle: "丸", square: "四角" },
  fills: { outline: "枠線", solid: "塗りつぶし" },
  kinds: { route: "ルート", block: "ブロック", motion: "モーション" },
  interpolations: { straight: "直線", bezier: "曲線" },
  colors: { swatch1: "黒", swatch2: "赤", swatch3: "青", swatch4: "緑" },
  swatch: (color, fill) => `${color}の${fill}`,
  reset: "既定",
  resetField: (field) => `${field}を既定に戻す`,
};
