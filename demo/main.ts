// ローカル確認用 playground のエントリ。
// M1: フィールド描画 + ゾーン切替。M2: PlayData 投入で選手表示。
// M3: 線（route/block/motion・直線/ベジェ）+ view モード。
// M5: 編集 UI（ツールバー/プロパティパネル/Undo·Redo/ゾーン切替）。
//     ツール・プロパティ編集・ゾーン切替・Undo/Redo は Playmaker 内蔵 UI で操作する。
//     ここではサンプル投入・クリア・mode 切替と、onChange のデータ連携を目視する。
import {
  type Line,
  type PlayData,
  type Player,
  Playmaker,
  type PlaymakerMode,
  type PlaymakerOptions,
} from "playmaker";

const stage = document.getElementById("stage");
const controlsEl = document.getElementById("controls");
const statusEl = document.getElementById("status");
if (!stage || !controlsEl || !statusEl) {
  throw new Error("#stage / #controls / #status が見つかりません");
}
const controls: HTMLElement = controlsEl;
const status: HTMLElement = statusEl;
const mountPoint: HTMLElement = stage;

// M2/M3 目視用サンプル: 6 形状・色・ラベル・3 線種・直線/ベジェ・waypoint。
const DEFENSE_COLOR = "#c62828";
const SAMPLE_PLAYERS: Player[] = [
  { id: "ol-c", position: { lateralYard: 26.7, absoluteYard: 49 }, shape: "square", label: "C" },
  { id: "ol-lg", position: { lateralYard: 24.4, absoluteYard: 49 }, shape: "square", label: "LG" },
  { id: "ol-rg", position: { lateralYard: 29, absoluteYard: 49 }, shape: "square", label: "RG" },
  { id: "ol-lt", position: { lateralYard: 22.1, absoluteYard: 49 }, shape: "square", label: "LT" },
  { id: "ol-rt", position: { lateralYard: 31.3, absoluteYard: 49 }, shape: "square", label: "RT" },
  { id: "qb", position: { lateralYard: 26.7, absoluteYard: 46.5 }, shape: "circle", label: "QB" },
  { id: "rb", position: { lateralYard: 26.7, absoluteYard: 43 }, shape: "diamond", label: "RB" },
  { id: "wr-x", position: { lateralYard: 7, absoluteYard: 49.5 }, shape: "circle", label: "X" },
  { id: "wr-z", position: { lateralYard: 46, absoluteYard: 49.5 }, shape: "circle", label: "Z" },
  { id: "wr-y", position: { lateralYard: 38, absoluteYard: 48 }, shape: "circle", label: "Y" },
  { id: "te", position: { lateralYard: 33.6, absoluteYard: 49 }, shape: "triangle", label: "TE" },
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

const SAMPLE_LINES: Line[] = [
  {
    id: "rt-x",
    kind: "route",
    startPlayerId: "wr-x",
    waypoints: [{ lateralYard: 7, absoluteYard: 59 }],
    end: { lateralYard: 13, absoluteYard: 59 },
    interpolation: "straight",
  },
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
  {
    id: "rt-y",
    kind: "route",
    startPlayerId: "wr-y",
    waypoints: [{ lateralYard: 36, absoluteYard: 54 }],
    end: { lateralYard: 18, absoluteYard: 61 },
    interpolation: "bezier",
  },
  {
    id: "bl-rt",
    kind: "block",
    startPlayerId: "ol-rt",
    waypoints: [],
    end: { lateralYard: 29.5, absoluteYard: 50.6 },
    interpolation: "straight",
  },
  {
    id: "bl-lt",
    kind: "block",
    startPlayerId: "ol-lt",
    waypoints: [],
    end: { lateralYard: 24, absoluteYard: 50.6 },
    interpolation: "straight",
    color: "#90caf9",
  },
  {
    id: "mo-rb",
    kind: "motion",
    startPlayerId: "rb",
    waypoints: [{ lateralYard: 33, absoluteYard: 44 }],
    end: { lateralYard: 41, absoluteYard: 46 },
    interpolation: "straight",
  },
];

let mode: PlaymakerMode = "edit";
let changeCount = 0;

function onChange(data: PlayData): void {
  changeCount += 1;
  status.textContent = `onChange #${changeCount}｜選手 ${data.players.length}・線 ${data.lines.length}・ゾーン ${data.field.zone}`;
}

function create(initialData?: PlayData): Playmaker {
  changeCount = 0;
  status.textContent = "onChange 待ち（編集すると更新されます）";
  // exactOptionalPropertyTypes: initialData は値があるときだけ持たせる。
  const options: PlaymakerOptions = { mode, onChange };
  if (initialData !== undefined) {
    options.initialData = initialData;
  }
  return new Playmaker(mountPoint, options);
}

let playmaker = create({
  version: 1,
  field: { zone: "middle" },
  players: SAMPLE_PLAYERS,
  lines: SAMPLE_LINES,
});

function addAction(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  controls.appendChild(button);
  return button;
}

addAction("サンプル隊形＋線を読み込む", () => {
  playmaker.setPlayData({
    version: 1,
    field: { zone: playmaker.fieldZone },
    players: SAMPLE_PLAYERS,
    lines: SAMPLE_LINES,
  });
});

addAction("クリア", () => {
  playmaker.setPlayData({
    version: 1,
    field: { zone: playmaker.fieldZone },
    players: [],
    lines: [],
  });
});

const modeButton = addAction("", () => {
  // mode 切替は再マウント（現在のプレー図はそのまま引き継ぐ）。
  const snapshot = playmaker.getPlayData();
  playmaker.dispose();
  mode = mode === "edit" ? "view" : "edit";
  playmaker = create(snapshot);
  syncModeButton();
});

function syncModeButton(): void {
  modeButton.textContent = mode === "edit" ? "view モードへ" : "edit モードへ";
  modeButton.setAttribute("aria-pressed", String(mode === "view"));
}

syncModeButton();

if (import.meta.hot) {
  import.meta.hot.dispose(() => playmaker.dispose());
}
