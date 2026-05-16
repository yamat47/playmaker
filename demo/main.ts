// ローカル確認用 playground のエントリ。
// 以降のマイルストーンでゾーン切替 / フォーメーション読込 / view⇄edit /
// PNG 出力 / PlayData JSON 確認 / Undo・Redo のシナリオ操作 UI を足していく。
import { Playmaker } from "playmaker";

const stage = document.getElementById("stage");
if (!stage) {
  throw new Error("#stage が見つかりません");
}

const playmaker = new Playmaker(stage, { mode: "edit" });

// HMR で再マウントしてもインスタンスがリークしないよう破棄する。
if (import.meta.hot) {
  import.meta.hot.dispose(() => playmaker.dispose());
}
