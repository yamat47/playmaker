// ローカル確認用 playground のエントリ。
// M1: フィールド描画 + ゾーン切替。M2: PlayData 投入で選手表示。
// M3: 線（route/block/motion・直線/ベジェ）+ view モード。
// M5: 編集 UI（ツールバー/プロパティパネル/Undo·Redo/ゾーン切替）。
//     ツール・プロパティ編集・ゾーン切替・Undo/Redo は Playmaker 内蔵 UI で操作する。
//     ここではサンプル投入・クリア・mode 切替と、onChange のデータ連携を目視する。
// M6: フォーメーションテンプレート。ツールバーの「フォーメーション読込…」プルダウン
//     （内蔵 UI）で自動配置を目視。下の追記ボタンは公開 API loadFormation の確認用で、
//     クリア→攻→守 と重ねると追記セマンティクス（攻守を順に置ける）が分かる。
// M7: PNG エクスポート。「PNG を出力」で現在のプレー図をダウンロードし、編集 UI が
//     含まれない（view/edit いずれでも同じ図）ことを目視する。
// M8: データ連携（PlayData 往復・version/migration）。JSON パネルで getPlayData の
//     書き出し→読込（setPlayData）の往復、版なし旧 blob・未来版 blob が現行版へ
//     寄る（migratePlayData）ことを目視する。編集すると onChange で JSON も更新。
import {
  CURRENT_PLAY_DATA_VERSION,
  FORMATION_PRESETS,
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
const jsonEl = document.getElementById("json");
const dataStatusEl = document.getElementById("data-status");
if (
  !stage ||
  !controlsEl ||
  !statusEl ||
  !(jsonEl instanceof HTMLTextAreaElement) ||
  !dataStatusEl
) {
  throw new Error("#stage / #controls / #status / #json / #data-status が見つかりません");
}
const controls: HTMLElement = controlsEl;
const status: HTMLElement = statusEl;
const mountPoint: HTMLElement = stage;
const jsonArea: HTMLTextAreaElement = jsonEl;
const dataStatus: HTMLElement = dataStatusEl;

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
  // version の現行確定を編集ごとに目視できるよう通知データをそのまま出す。
  jsonArea.value = JSON.stringify(data, null, 2);
}

/** 現在のプレー図（正準スナップショット）を JSON 欄へ書き出す。 */
function refreshJson(): void {
  jsonArea.value = JSON.stringify(playmaker.getPlayData(), null, 2);
}

/**
 * JSON 欄の内容を setPlayData で読み込み、結果を再表示する。
 * setPlayData は onChange を発火しない契約なので明示的に書き戻し、版なし/未来版
 * blob が現行版へ寄る（migratePlayData）ことを往復として目視できる。
 */
function loadFromJsonText(): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonArea.value);
  } catch (error) {
    dataStatus.textContent = `JSON 解析エラー: ${(error as Error).message}`;
    return;
  }
  // 旧版・未来版・破損も migratePlayData が現行へ寄せる前提で型を緩めて渡す。
  playmaker.setPlayData(parsed as PlayData);
  refreshJson();
  dataStatus.textContent = "読込完了（version は現行へ寄せて再表示）";
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
  version: CURRENT_PLAY_DATA_VERSION,
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
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: playmaker.fieldZone },
    players: SAMPLE_PLAYERS,
    lines: SAMPLE_LINES,
  });
  refreshJson();
});

addAction("クリア", () => {
  playmaker.setPlayData({
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: playmaker.fieldZone },
    players: [],
    lines: [],
  });
  refreshJson();
});

// 公開 API loadFormation の目視（追記）。クリア→攻→守 の順で重ねられる。
for (const formation of FORMATION_PRESETS) {
  addAction(`＋${formation.name}`, () => playmaker.loadFormation(formation));
}

// PNG エクスポート（PRD 5.7）。出力に編集 UI（ツール/パネル/選択/ハンドル）が
// 含まれないこと・view/edit いずれでも出せることを目視する。
addAction("PNG を出力", async () => {
  const blob = await playmaker.exportToPng();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `playmaker-${mode}-${Date.now()}.png`;
  a.click();
  // click() のダウンロード処理はブラウザにより非同期。同期 revoke すると
  // 取得開始前に URL が失効しダウンロードを取りこぼす環境があるため遅延する。
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = `PNG 出力（${mode} モード・${Math.round(blob.size / 1024)}KB）`;
});

const modeButton = addAction("", () => {
  // mode 切替は再マウント（現在のプレー図はそのまま引き継ぐ）。
  const snapshot = playmaker.getPlayData();
  playmaker.dispose();
  mode = mode === "edit" ? "view" : "edit";
  playmaker = create(snapshot);
  syncModeButton();
  refreshJson();
});

function syncModeButton(): void {
  modeButton.textContent = mode === "edit" ? "view モードへ" : "edit モードへ";
  modeButton.setAttribute("aria-pressed", String(mode === "view"));
}

syncModeButton();

// JSON パネル（M8 往復・migration の目視）。静的 HTML のボタンに結線する。
// 静的 HTML ボタンは HMR を跨いで生き残るため、signal でリスナを束ね再読込時に外す
// （束ねないとホットリロードごとに多重登録され 1 クリックで多重発火する）。
const demoLifetime = new AbortController();

function bindButton(id: string, onClick: () => void): void {
  const button = document.getElementById(id);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`#${id} が見つかりません`);
  }
  button.addEventListener("click", onClick, { signal: demoLifetime.signal });
}

/** 任意 blob を JSON 欄へ流し込み読込まで通す（旧版/未来版 fixture の目視に共通）。 */
function loadFixture(blob: unknown): void {
  jsonArea.value = JSON.stringify(blob, null, 2);
  loadFromJsonText();
}

bindButton("json-export", () => {
  refreshJson();
  dataStatus.textContent = "現在の getPlayData を書き出し";
});
bindButton("json-import", loadFromJsonText);
// version フィールドの無い商用ソフト初期データ → 読込で現行版へ寄る。
bindButton("json-legacy", () =>
  loadFixture({
    field: { zone: "own-redzone" },
    players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 }, shape: "square" }],
  }),
);
// 新しい lib で保存された未来版 → 前方互換で現行へ寄り未知項目は落ちる。
bindButton("json-future", () =>
  loadFixture({
    version: 99,
    field: { zone: "redzone" },
    players: [{ id: "qb", position: { lateralYard: 26, absoluteYard: 48 }, shape: "circle" }],
    lines: [],
    futureOnlyField: { whatever: true },
  }),
);

refreshJson();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    demoLifetime.abort();
    playmaker.dispose();
  });
}
