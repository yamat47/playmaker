// ローカル確認用 playground のエントリ。手元のブラウザで以下を目視する:
// - フィールド描画とゾーン切替、6 形状・色・ラベルの選手、route/block/motion の線
// - 内蔵 UI（ツールバー/プロパティパネル/Undo·Redo/ゾーン切替）での編集と view/edit 切替
// - フォーメーション読込（内蔵プルダウンと公開 API loadFormation の追記セマンティクス）
// - PNG エクスポート（編集 UI を含まない・view/edit で同一図）
// - PlayData 往復: getPlayData 書き出し → setPlayData 読込、版なし/未来版 blob が
//   migratePlayData で現行版へ寄ること。編集すると onChange で JSON も更新される
// - 密度ストレス（選手 22 + 線 20）: PRD 6.2「典型的フォーメーションを遅延なく」を
//   手動目視するための fixture（戦術記法の厳密さは PRD 4.1 のとおり狙わない）
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

// 目視用サンプル: 6 形状・色・ラベル・3 線種・直線/ベジェ・waypoint。
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

// 密度ストレス用 fixture。PRD 6.2 を手動目視するため demo に常設し、戦術的厳密さは狙わずに
// 6 形状・3 線種・straight/bezier・複数 waypoint を 1 ロードで漏れなく確認できる配置にする。
const STRESS_PLAYERS: Player[] = [
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
    id: "de-l",
    position: { lateralYard: 21.5, absoluteYard: 51 },
    shape: "pentagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "dt-l",
    position: { lateralYard: 24.4, absoluteYard: 51 },
    shape: "pentagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "dt-r",
    position: { lateralYard: 29, absoluteYard: 51 },
    shape: "pentagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "de-r",
    position: { lateralYard: 31.9, absoluteYard: 51 },
    shape: "pentagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "lb-w",
    position: { lateralYard: 22, absoluteYard: 54 },
    shape: "hexagon",
    label: "W",
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
    id: "lb-s",
    position: { lateralYard: 31.4, absoluteYard: 54 },
    shape: "hexagon",
    label: "S",
    color: DEFENSE_COLOR,
  },
  {
    id: "cb-l",
    position: { lateralYard: 7, absoluteYard: 53 },
    shape: "hexagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "cb-r",
    position: { lateralYard: 46, absoluteYard: 53 },
    shape: "hexagon",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "fs",
    position: { lateralYard: 24, absoluteYard: 58 },
    shape: "diamond",
    label: "FS",
    color: DEFENSE_COLOR,
  },
  {
    id: "ss",
    position: { lateralYard: 30, absoluteYard: 57 },
    shape: "diamond",
    label: "SS",
    color: DEFENSE_COLOR,
  },
];

const STRESS_LINES: Line[] = [
  {
    id: "bl-c",
    kind: "block",
    startPlayerId: "ol-c",
    waypoints: [],
    end: { lateralYard: 26.7, absoluteYard: 50.6 },
    interpolation: "straight",
  },
  {
    id: "bl-lg",
    kind: "block",
    startPlayerId: "ol-lg",
    waypoints: [],
    end: { lateralYard: 24.4, absoluteYard: 50.6 },
    interpolation: "straight",
  },
  {
    id: "bl-rg",
    kind: "block",
    startPlayerId: "ol-rg",
    waypoints: [],
    end: { lateralYard: 29, absoluteYard: 50.6 },
    interpolation: "straight",
  },
  {
    id: "bl-lt",
    kind: "block",
    startPlayerId: "ol-lt",
    waypoints: [],
    end: { lateralYard: 21.8, absoluteYard: 50.6 },
    interpolation: "straight",
  },
  {
    id: "bl-rt",
    kind: "block",
    startPlayerId: "ol-rt",
    waypoints: [],
    end: { lateralYard: 31.7, absoluteYard: 50.6 },
    interpolation: "straight",
  },
  // rt-te だけ color を持たせて route の色オーバーライドも 1 ロードで目視できるようにする。
  {
    id: "rt-x",
    kind: "route",
    startPlayerId: "wr-x",
    waypoints: [{ lateralYard: 7, absoluteYard: 60 }],
    end: { lateralYard: 13, absoluteYard: 60 },
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
    end: { lateralYard: 40, absoluteYard: 56 },
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
    id: "rt-te",
    kind: "route",
    startPlayerId: "te",
    waypoints: [{ lateralYard: 33, absoluteYard: 53 }],
    end: { lateralYard: 38, absoluteYard: 56 },
    interpolation: "straight",
    color: "#90caf9",
  },
  {
    id: "rt-rb",
    kind: "route",
    startPlayerId: "rb",
    waypoints: [{ lateralYard: 35, absoluteYard: 46 }],
    end: { lateralYard: 45, absoluteYard: 51 },
    interpolation: "bezier",
  },
  {
    id: "mo-y",
    kind: "motion",
    startPlayerId: "wr-y",
    waypoints: [{ lateralYard: 35, absoluteYard: 48 }],
    end: { lateralYard: 30, absoluteYard: 47.5 },
    interpolation: "straight",
  },
  // 守備サイドの線は color に DEFENSE_COLOR を載せて攻守を一望できる色分けに揃える。
  {
    id: "pr-de-l",
    kind: "route",
    startPlayerId: "de-l",
    waypoints: [],
    end: { lateralYard: 22, absoluteYard: 49 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
  },
  {
    id: "pr-dt-l",
    kind: "route",
    startPlayerId: "dt-l",
    waypoints: [],
    end: { lateralYard: 24, absoluteYard: 49 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
  },
  {
    id: "pr-dt-r",
    kind: "route",
    startPlayerId: "dt-r",
    waypoints: [],
    end: { lateralYard: 29.5, absoluteYard: 49 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
  },
  {
    id: "pr-de-r",
    kind: "route",
    startPlayerId: "de-r",
    waypoints: [],
    end: { lateralYard: 32, absoluteYard: 49 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
  },
  {
    id: "cv-lb-w",
    kind: "route",
    startPlayerId: "lb-w",
    waypoints: [{ lateralYard: 22, absoluteYard: 52 }],
    end: { lateralYard: 20, absoluteYard: 49.5 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
  },
  {
    id: "cv-lb-m",
    kind: "route",
    startPlayerId: "lb-m",
    waypoints: [{ lateralYard: 28, absoluteYard: 54 }],
    end: { lateralYard: 33, absoluteYard: 53 },
    interpolation: "bezier",
    color: DEFENSE_COLOR,
  },
  {
    id: "cv-lb-s",
    kind: "route",
    startPlayerId: "lb-s",
    waypoints: [{ lateralYard: 32, absoluteYard: 53 }],
    end: { lateralYard: 35, absoluteYard: 52 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
  },
  {
    id: "cv-cb-l",
    kind: "route",
    startPlayerId: "cb-l",
    waypoints: [{ lateralYard: 7, absoluteYard: 55 }],
    end: { lateralYard: 7, absoluteYard: 60 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
  },
  {
    id: "cv-cb-r",
    kind: "route",
    startPlayerId: "cb-r",
    waypoints: [{ lateralYard: 46, absoluteYard: 55 }],
    end: { lateralYard: 46, absoluteYard: 60 },
    interpolation: "straight",
    color: DEFENSE_COLOR,
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

// version/field zone/refreshJson 忘れを防ぐためボタンの差し替え軸（players/lines）だけ受ける。
function loadScene(players: Player[], lines: Line[]): void {
  playmaker.setPlayData({
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: playmaker.fieldZone },
    players,
    lines,
  });
  refreshJson();
}

addAction("サンプル隊形＋線を読み込む", () => loadScene(SAMPLE_PLAYERS, SAMPLE_LINES));
addAction("クリア", () => loadScene([], []));
// 密度ストレス（選手 22 + 線 20）。PRD 6.2「典型的フォーメーションを遅延なく」を
// このボタン 1 つで読み込み、描画・ゾーン切替・操作の体感速度を手動目視する。
addAction("密度ストレス (選手22+線20)", () => loadScene(STRESS_PLAYERS, STRESS_LINES));

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

// JSON パネル（往復・migration の目視）。静的 HTML のボタンに結線する。
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
