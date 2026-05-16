// ローカル確認用 playground のエントリ。
// M1: フィールド描画 + ゾーン切替を目視する。
// 以降のマイルストーンでフォーメーション読込 / view⇄edit /
// PNG 出力 / PlayData JSON 確認 / Undo・Redo のシナリオ操作 UI を足していく。
import { type FieldZone, Playmaker } from "playmaker";

const stage = document.getElementById("stage");
const controls = document.getElementById("controls");
if (!stage || !controls) {
  throw new Error("#stage または #controls が見つかりません");
}

const playmaker = new Playmaker(stage, { mode: "edit" });

const zones: { id: FieldZone; label: string }[] = [
  { id: "own-redzone", label: "自陣レッドゾーン" },
  { id: "middle", label: "中央" },
  { id: "redzone", label: "相手レッドゾーン" },
];

const buttons = zones.map(({ id, label }) => {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", () => {
    playmaker.setFieldZone(id);
    syncPressed();
  });
  controls.appendChild(button);
  return { id, button };
});

function syncPressed(): void {
  const current = playmaker.fieldZone;
  for (const { id, button } of buttons) {
    button.setAttribute("aria-pressed", String(id === current));
  }
}
syncPressed();

// HMR で再マウントしてもインスタンスがリークしないよう破棄する。
if (import.meta.hot) {
  import.meta.hot.dispose(() => playmaker.dispose());
}
