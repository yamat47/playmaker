// ローカル確認用 playground のエントリ。
// M1: フィールド描画 + ゾーン切替。M2: PlayData 投入で選手表示（6 形状・色・ラベル）。
// 以降のマイルストーンで線描画 / view⇄edit / PNG 出力 / Undo・Redo を足していく。
import { type FieldZone, type Player, Playmaker } from "playmaker";

const stage = document.getElementById("stage");
const controlsEl = document.getElementById("controls");
if (!stage || !controlsEl) {
  throw new Error("#stage または #controls が見つかりません");
}
// クロージャ内でも非 null として扱えるよう絞り込み済み参照を確定する。
const controls: HTMLElement = controlsEl;

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

// M2 目視用サンプル: 6 形状すべて・色指定・ラベルを含む攻守の隊形。
// フィールド幅 ≈ 53.3yd（中央 ≈ 26.7）、middle ゾーンの LOS を 50yd に置く。
const DEFENSE_COLOR = "#c62828";
const SAMPLE_PLAYERS: Player[] = [
  // オフェンス OL（四角・既定色）
  { id: "ol-c", position: { lateralYard: 26.7, absoluteYard: 49 }, shape: "square", label: "C" },
  { id: "ol-lg", position: { lateralYard: 24.4, absoluteYard: 49 }, shape: "square", label: "LG" },
  { id: "ol-rg", position: { lateralYard: 29, absoluteYard: 49 }, shape: "square", label: "RG" },
  { id: "ol-lt", position: { lateralYard: 22.1, absoluteYard: 49 }, shape: "square", label: "LT" },
  { id: "ol-rt", position: { lateralYard: 31.3, absoluteYard: 49 }, shape: "square", label: "RT" },
  // バックス（丸）・RB（菱形）
  { id: "qb", position: { lateralYard: 26.7, absoluteYard: 46.5 }, shape: "circle", label: "QB" },
  { id: "rb", position: { lateralYard: 26.7, absoluteYard: 43 }, shape: "diamond", label: "RB" },
  // レシーバー（丸）・TE（三角）
  { id: "wr-x", position: { lateralYard: 7, absoluteYard: 49.5 }, shape: "circle", label: "X" },
  { id: "wr-z", position: { lateralYard: 46, absoluteYard: 49.5 }, shape: "circle", label: "Z" },
  { id: "wr-y", position: { lateralYard: 38, absoluteYard: 48 }, shape: "circle", label: "Y" },
  { id: "te", position: { lateralYard: 33.6, absoluteYard: 49 }, shape: "triangle", label: "TE" },
  // ディフェンス（五角形・六角形・指定色）
  {
    id: "dl-1",
    position: { lateralYard: 24.4, absoluteYard: 51 },
    shape: "pentagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "dl-2",
    position: { lateralYard: 29, absoluteYard: 51 },
    shape: "pentagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "lb-m",
    position: { lateralYard: 26.7, absoluteYard: 54 },
    shape: "hexagon",
    label: "M",
    color: DEFENSE_COLOR,
  },
  {
    id: "cb-1",
    position: { lateralYard: 7, absoluteYard: 53 },
    shape: "hexagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "cb-2",
    position: { lateralYard: 46, absoluteYard: 53 },
    shape: "hexagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "fs",
    position: { lateralYard: 26.7, absoluteYard: 60 },
    shape: "diamond",
    label: "FS",
    color: DEFENSE_COLOR,
  },
];

function makeAction(label: string, onClick: () => void): void {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  controls.appendChild(button);
}

const separator = document.createElement("span");
separator.textContent = "｜";
separator.setAttribute("aria-hidden", "true");
controls.appendChild(separator);

makeAction("サンプル隊形を読み込む", () => {
  // 現在のゾーンを保ったまま選手だけ投入する。
  playmaker.setPlayData({
    version: 1,
    field: { zone: playmaker.fieldZone },
    players: SAMPLE_PLAYERS,
  });
  syncPressed();
});

makeAction("選手をクリア", () => {
  playmaker.setPlayData({
    version: 1,
    field: { zone: playmaker.fieldZone },
    players: [],
  });
  syncPressed();
});

// HMR で再マウントしてもインスタンスがリークしないよう破棄する。
if (import.meta.hot) {
  import.meta.hot.dispose(() => playmaker.dispose());
}
