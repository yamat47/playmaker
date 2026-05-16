// ローカル確認用 playground のエントリ。
// M1: フィールド描画 + ゾーン切替。M2: PlayData 投入で選手表示。
// M3: 線（route/block/motion・直線/ベジェ）を表示し、view モードで読み取り専用表示。
// 以降のマイルストーンで編集 UI / PNG 出力 / Undo・Redo を足していく。
import { type FieldZone, type Line, type Player, Playmaker, type PlaymakerMode } from "playmaker";

const stage = document.getElementById("stage");
const controlsEl = document.getElementById("controls");
if (!stage || !controlsEl) {
  throw new Error("#stage または #controls が見つかりません");
}
// クロージャ内でも非 null として扱えるよう絞り込み済み参照を確定する。
const controls: HTMLElement = controlsEl;
// 非 null に絞り込んだ stage 参照（再マウントで使い回す）。
const mountPoint: HTMLElement = stage;

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

// M3 目視用サンプル: 3 線種 + 直線/ベジェ + waypoint + 色/太さ上書き。
const SAMPLE_LINES: Line[] = [
  // ルート（直線・矢印付き）: X の 10yd アウト。
  {
    id: "rt-x",
    kind: "route",
    startPlayerId: "wr-x",
    waypoints: [{ lateralYard: 7, absoluteYard: 59 }],
    end: { lateralYard: 13, absoluteYard: 59 },
    interpolation: "straight",
  },
  // ルート（ベジェ）: Z のカール（曲走路で waypoint を滑らかに通る）。
  {
    id: "rt-z",
    kind: "route",
    startPlayerId: "wr-z",
    waypoints: [
      { lateralYard: 46, absoluteYard: 58 },
      { lateralYard: 43, absoluteYard: 60 },
    ],
    end: { lateralYard: 44, absoluteYard: 56 },
    interpolation: "bezier",
  },
  // ルート（ベジェ）: Y の深いクロス。
  {
    id: "rt-y",
    kind: "route",
    startPlayerId: "wr-y",
    waypoints: [{ lateralYard: 36, absoluteYard: 54 }],
    end: { lateralYard: 18, absoluteYard: 61 },
    interpolation: "bezier",
  },
  // ブロック（太線・矢印なし）: RT → 右 DL。
  {
    id: "bl-rt",
    kind: "block",
    startPlayerId: "ol-rt",
    waypoints: [],
    end: { lateralYard: 29.5, absoluteYard: 50.6 },
    interpolation: "straight",
  },
  // ブロック（色上書き）: LT → 左 DL。
  {
    id: "bl-lt",
    kind: "block",
    startPlayerId: "ol-lt",
    waypoints: [],
    end: { lateralYard: 24, absoluteYard: 50.6 },
    interpolation: "straight",
    color: "#90caf9",
  },
  // モーション（破線）: RB のジェットモーション（スナップ前の横移動）。
  {
    id: "mo-rb",
    kind: "motion",
    startPlayerId: "rb",
    waypoints: [{ lateralYard: 33, absoluteYard: 44 }],
    end: { lateralYard: 41, absoluteYard: 46 },
    interpolation: "straight",
  },
];

const zones: { id: FieldZone; label: string }[] = [
  { id: "own-redzone", label: "自陣レッドゾーン" },
  { id: "middle", label: "中央" },
  { id: "redzone", label: "相手レッドゾーン" },
];

// 表示中の状態（モード切替で作り直すため Playmaker の外で保持）。
let mode: PlaymakerMode = "edit";
let playmaker = new Playmaker(mountPoint, { mode });

function loadSample(): void {
  playmaker.setPlayData({
    version: 1,
    field: { zone: playmaker.fieldZone },
    players: SAMPLE_PLAYERS,
    lines: SAMPLE_LINES,
  });
}

function clearPlay(): void {
  playmaker.setPlayData({
    version: 1,
    field: { zone: playmaker.fieldZone },
    players: [],
    lines: [],
  });
}

/** mode を切り替えて再マウントする（現在のプレー図はそのまま引き継ぐ）。 */
function remountWithMode(next: PlaymakerMode): void {
  const snapshot = playmaker.getPlayData();
  playmaker.dispose();
  mode = next;
  playmaker = new Playmaker(mountPoint, { mode, initialData: snapshot });
  syncControls();
}

// --- コントロール構築 ---

const zoneButtons = zones.map(({ id, label }) => {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", () => {
    playmaker.setFieldZone(id);
    syncControls();
  });
  controls.appendChild(button);
  return { id, button };
});

function addSeparator(): void {
  const separator = document.createElement("span");
  separator.textContent = "｜";
  separator.setAttribute("aria-hidden", "true");
  controls.appendChild(separator);
}

function addAction(label: string, onClick: () => void): void {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  controls.appendChild(button);
}

addSeparator();
addAction("サンプル隊形＋線を読み込む", () => {
  loadSample();
  syncControls();
});
addAction("クリア", () => {
  clearPlay();
  syncControls();
});

addSeparator();
const modeButton = document.createElement("button");
modeButton.addEventListener("click", () => {
  remountWithMode(mode === "edit" ? "view" : "edit");
});
controls.appendChild(modeButton);

function syncControls(): void {
  const current = playmaker.fieldZone;
  for (const { id, button } of zoneButtons) {
    button.setAttribute("aria-pressed", String(id === current));
  }
  // view では編集 UI を出さない（M5 以降）。現状は読み取り専用表示の確認用。
  modeButton.textContent = mode === "edit" ? "view モードへ" : "edit モードへ";
  modeButton.setAttribute("aria-pressed", String(mode === "view"));
}

syncControls();

// HMR で再マウントしてもインスタンスがリークしないよう破棄する。
if (import.meta.hot) {
  import.meta.hot.dispose(() => playmaker.dispose());
}
