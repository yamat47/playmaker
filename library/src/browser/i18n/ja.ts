import type { Messages } from "./messages.js";

export const ja: Messages = {
  tool: { select: "選択", "add-player": "選手を追加" },
  undo: "元に戻す",
  redo: "やり直す",
  delete: "削除",
  zone: { "own-redzone": "自陣RZ", middle: "中央", redzone: "相手RZ" },
  playerLimit: (maxPlayers) => `選手は ${maxPlayers} 人までです`,
  lineLimit: (maxLines) => `線は ${maxLines} 本までです`,
  selectionHint: "対象を選択するとプロパティを編集できます",
  drawingHint:
    "クリックで折れ点を置きます。ダブルクリックか Enter で線を確定し、Esc で取り消します。",
  lineToolHint:
    "選手からドラッグすると直線を引けます。選手をクリックしてから、クリックで折れ点を置くこともできます。",
  bendHint:
    "区間の中ほどにある小さな白抜きの丸を引っぱると、そこに折れ点が増えます。四角い折れ点はダブルクリックするか、クリックして Delete を押すと消えます。",
  player: "選手",
  line: "線",
  label: "ラベル",
  shape: "形状",
  color: "色",
  kind: "種別",
  interpolation: "線の形",
  shapes: { circle: "丸", square: "四角" },
  fills: { outline: "枠線", solid: "塗りつぶし" },
  kinds: { route: "ルート", block: "ブロック", motion: "モーション" },
  interpolations: { straight: "直線", bezier: "曲線" },
  colors: { swatch2: "赤", swatch3: "青", swatch4: "緑" },
  defaultColor: "既定",
  swatch: (color, fill) => `${color}の${fill}`,
};
