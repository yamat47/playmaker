// ローカル確認用 playground のエントリ。「Sideline Slate」筐体で以下を目視する:
// - 左レールのプリセット・ライブラリ（フォーメーション 13・プレー図 16）をワンクリック読込
// - 中央フィールドでの内蔵 UI（ツールバー/プロパティパネル）編集と view/edit 切替
// - PNG エクスポート（編集 UI を含まない）
// - 開発者ドロワー: PlayData 往復（getPlayData→setPlayData・版なし/未来版の migration）と
//   密度ストレス（選手 22 + 線 20）を手動目視する fixture
import {
  CURRENT_PLAY_DATA_VERSION,
  FORMATION_PRESETS,
  type Formation,
  type Line,
  PLAY_PRESETS,
  type PlayCategory,
  type PlayData,
  type Player,
  Playmaker,
  type PlaymakerMode,
  type PlaymakerOptions,
  type PlayPreset,
} from "playmaker";

function need<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) {
    throw new Error(`#${id} が見つかりません`);
  }
  return el as T;
}

const mountPoint = need("stage");
const libraryScroll = need("library-scroll");
const statusEl = need("status");
const jsonArea = need<HTMLTextAreaElement>("json");
const dataStatus = need("data-status");
const infoName = need("playinfo-name");
const infoChip = need("playinfo-chip");
const infoPers = need("playinfo-pers");
const infoSummary = need("playinfo-summary");

// 静的 HTML のボタン/コンテナは HMR を跨いで生き残る。signal でリスナを束ねて再読込時に
// 外し、コンテナは作り直す前に空にする（束ねないとホットリロードごとに多重登録される）。
const demoLifetime = new AbortController();
const { signal } = demoLifetime;

const DEFENSE_COLOR = "#8f4034";

// タイプ分類 → コールシート色タグ（ラン/パス/RPO/カバレッジ/プレッシャー）。
const CATEGORY_META: Record<PlayCategory, { label: string; color: string }> = {
  "run-zone": { label: "RUN", color: "var(--cat-run)" },
  "run-gap": { label: "RUN", color: "var(--cat-run)" },
  "pass-quick": { label: "PASS", color: "var(--cat-pass)" },
  "pass-dropback": { label: "PASS", color: "var(--cat-pass)" },
  "pass-deep": { label: "PASS", color: "var(--cat-pass)" },
  pa: { label: "PA", color: "var(--cat-pass)" },
  rpo: { label: "RPO", color: "var(--cat-rpo)" },
  coverage: { label: "COV", color: "var(--cat-cov)" },
  pressure: { label: "PRES", color: "var(--cat-pres)" },
};

// 密度ストレス用 fixture（選手 22 + 線 20）。PRD 6.2 を手動目視するため demo に常設し、
// 2 形状（丸/四角）・3 線種・straight/bezier・複数 waypoint を 1 ロードで漏れなく確認する。
const STRESS_PLAYERS: Player[] = [
  { id: "ol-c", position: { lateralYard: 26.7, absoluteYard: 49 }, shape: "square", label: "C" },
  { id: "ol-lg", position: { lateralYard: 24.4, absoluteYard: 49 }, shape: "square", label: "LG" },
  { id: "ol-rg", position: { lateralYard: 29, absoluteYard: 49 }, shape: "square", label: "RG" },
  { id: "ol-lt", position: { lateralYard: 22.1, absoluteYard: 49 }, shape: "square", label: "LT" },
  { id: "ol-rt", position: { lateralYard: 31.3, absoluteYard: 49 }, shape: "square", label: "RT" },
  { id: "qb", position: { lateralYard: 26.7, absoluteYard: 46.5 }, shape: "circle", label: "QB" },
  { id: "rb", position: { lateralYard: 26.7, absoluteYard: 43 }, shape: "circle", label: "RB" },
  { id: "wr-x", position: { lateralYard: 7, absoluteYard: 49.5 }, shape: "circle", label: "X" },
  { id: "wr-z", position: { lateralYard: 46, absoluteYard: 49.5 }, shape: "circle", label: "Z" },
  { id: "wr-y", position: { lateralYard: 38, absoluteYard: 48 }, shape: "circle", label: "Y" },
  { id: "te", position: { lateralYard: 33.6, absoluteYard: 49 }, shape: "square", label: "TE" },
  {
    id: "de-l",
    position: { lateralYard: 21.5, absoluteYard: 51 },
    shape: "circle",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "dt-l",
    position: { lateralYard: 24.4, absoluteYard: 51 },
    shape: "circle",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "dt-r",
    position: { lateralYard: 29, absoluteYard: 51 },
    shape: "circle",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "de-r",
    position: { lateralYard: 31.9, absoluteYard: 51 },
    shape: "circle",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "lb-w",
    position: { lateralYard: 22, absoluteYard: 54 },
    shape: "circle",
    label: "W",
    color: DEFENSE_COLOR,
  },
  {
    id: "lb-m",
    position: { lateralYard: 26.7, absoluteYard: 54 },
    shape: "circle",
    label: "M",
    color: DEFENSE_COLOR,
  },
  {
    id: "lb-s",
    position: { lateralYard: 31.4, absoluteYard: 54 },
    shape: "circle",
    label: "S",
    color: DEFENSE_COLOR,
  },
  {
    id: "cb-l",
    position: { lateralYard: 7, absoluteYard: 53 },
    shape: "circle",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "cb-r",
    position: { lateralYard: 46, absoluteYard: 53 },
    shape: "circle",
    label: "",
    color: DEFENSE_COLOR,
  },
  {
    id: "fs",
    position: { lateralYard: 24, absoluteYard: 58 },
    shape: "circle",
    label: "FS",
    color: DEFENSE_COLOR,
  },
  {
    id: "ss",
    position: { lateralYard: 30, absoluteYard: 57 },
    shape: "circle",
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
  statusEl.textContent = `onChange #${changeCount}｜選手 ${data.players.length}・線 ${data.lines.length}・ゾーン ${data.field.zone}`;
  jsonArea.value = JSON.stringify(data, null, 2);
}

function refreshJson(): void {
  jsonArea.value = JSON.stringify(playmaker.getPlayData(), null, 2);
}

function create(initialData?: PlayData): Playmaker {
  changeCount = 0;
  statusEl.textContent = "onChange 待ち（編集すると更新されます）";
  const options: PlaymakerOptions = { mode, onChange };
  if (initialData !== undefined) {
    options.initialData = initialData;
  }
  return new Playmaker(mountPoint, options);
}

let playmaker = create(PLAY_PRESETS[0]?.data);

// ---- 左レール: プリセット・ライブラリ ----
let activeButton: HTMLButtonElement | null = null;

function setActive(button: HTMLButtonElement): void {
  activeButton?.classList.remove("is-active");
  button.classList.add("is-active");
  activeButton = button;
}

function setInfo(
  name: string,
  chip: { label: string; color: string } | null,
  pers: string,
  summary: string,
): void {
  infoName.textContent = name;
  if (chip === null) {
    infoChip.hidden = true;
  } else {
    infoChip.hidden = false;
    infoChip.textContent = chip.label;
    infoChip.style.background = chip.color;
  }
  infoPers.textContent = pers;
  infoSummary.textContent = summary;
}

function presetButton(name: string, tag: string, tagColor: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preset";
  const tagEl = document.createElement("span");
  tagEl.className = "preset__tag";
  tagEl.textContent = tag;
  tagEl.style.background = tagColor;
  const nameEl = document.createElement("span");
  nameEl.className = "preset__name";
  nameEl.textContent = name;
  button.append(tagEl, nameEl);
  return button;
}

function groupTitle(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "group__title";
  el.textContent = text;
  return el;
}

function subTitle(text: string, offense: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = offense ? "group__sub group__sub--off" : "group__sub";
  el.textContent = text;
  return el;
}

function loadFormation(formation: Formation): void {
  const players: Player[] = formation.players.map((p, i) => ({ ...p, id: `${formation.id}-${i}` }));
  playmaker.setPlayData({
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: playmaker.fieldZone },
    players,
    lines: [],
  });
  refreshJson();
}

function loadPlay(preset: PlayPreset): void {
  playmaker.setPlayData(preset.data);
  refreshJson();
}

interface PresetRow {
  name: string;
  tag: string;
  tagColor: string;
  select: () => void;
}

// 1 行ぶんの見た目と読込処理を item から導く（フォーメーション/プレー図で差分はここだけ）。
function addSection<T extends { id: string; side: "offense" | "defense" }>(
  items: readonly T[],
  side: "offense" | "defense",
  label: string,
  toRow: (item: T) => PresetRow,
): void {
  const matching = items.filter((it) => it.side === side);
  if (matching.length === 0) {
    return;
  }
  libraryScroll.append(subTitle(label, side === "offense"));
  for (const item of matching) {
    const row = toRow(item);
    const button = presetButton(row.name, row.tag, row.tagColor);
    button.dataset.presetId = item.id;
    button.addEventListener("click", () => {
      setActive(button);
      row.select();
    });
    libraryScroll.append(button);
  }
}

function formationRow(formation: Formation): PresetRow {
  const offense = formation.side === "offense";
  return {
    name: formation.name,
    tag: offense ? "OFF" : "DEF",
    tagColor: offense ? "var(--off)" : "var(--def)",
    select: () => {
      loadFormation(formation);
      setInfo(
        formation.name,
        null,
        "Formation",
        "選手配置のみ（ライン無し）。現在の図を差し替えます。",
      );
    },
  };
}

function playRow(preset: PlayPreset): PresetRow {
  const meta = CATEGORY_META[preset.category];
  return {
    name: preset.name,
    tag: meta.label,
    tagColor: meta.color,
    select: () => {
      loadPlay(preset);
      setInfo(preset.name, meta, preset.personnel, preset.summary);
    },
  };
}

libraryScroll.replaceChildren();
libraryScroll.append(groupTitle("Formations"));
addSection(FORMATION_PRESETS, "offense", "Offense", formationRow);
addSection(FORMATION_PRESETS, "defense", "Defense", formationRow);
libraryScroll.append(groupTitle("Plays"));
addSection(PLAY_PRESETS, "offense", "Offense", playRow);
addSection(PLAY_PRESETS, "defense", "Defense", playRow);

// 初期表示は先頭プレー図に同期する（左レールのハイライトと Play info も合わせる）。
const initialPreset = PLAY_PRESETS[0];
if (initialPreset !== undefined) {
  const initialButton = libraryScroll.querySelector<HTMLButtonElement>(
    `[data-preset-id="${initialPreset.id}"]`,
  );
  if (initialButton !== null) {
    setActive(initialButton);
    const meta = CATEGORY_META[initialPreset.category];
    setInfo(initialPreset.name, meta, initialPreset.personnel, initialPreset.summary);
  }
}

// ---- トップバー ----
const modeButton = need<HTMLButtonElement>("mode-toggle");
modeButton.addEventListener(
  "click",
  () => {
    // mode 切替は再マウント（現在のプレー図はそのまま引き継ぐ）。
    const snapshot = playmaker.getPlayData();
    playmaker.dispose();
    mode = mode === "edit" ? "view" : "edit";
    playmaker = create(snapshot);
    syncModeButton();
    refreshJson();
  },
  { signal },
);

function syncModeButton(): void {
  modeButton.textContent = mode === "edit" ? "view モードへ" : "edit モードへ";
  modeButton.setAttribute("aria-pressed", String(mode === "view"));
}
syncModeButton();

need<HTMLButtonElement>("clear").addEventListener(
  "click",
  () => {
    playmaker.setPlayData({
      version: CURRENT_PLAY_DATA_VERSION,
      field: { zone: playmaker.fieldZone },
      players: [],
      lines: [],
    });
    refreshJson();
    activeButton?.classList.remove("is-active");
    activeButton = null;
    setInfo("—", null, "", "");
  },
  { signal },
);

need<HTMLButtonElement>("export-png").addEventListener(
  "click",
  async () => {
    const blob = await playmaker.exportToPng();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playmaker-${mode}-${Date.now()}.png`;
    a.click();
    // click() のダウンロードは環境により非同期。同期 revoke で取りこぼす環境があるため遅延する。
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    statusEl.textContent = `PNG 出力（${mode} モード・${Math.round(blob.size / 1024)}KB）`;
  },
  { signal },
);

const drawer = need("drawer");
const devToggle = need<HTMLButtonElement>("dev-toggle");
devToggle.addEventListener(
  "click",
  () => {
    const open = drawer.classList.toggle("is-open");
    devToggle.setAttribute("aria-pressed", String(open));
  },
  { signal },
);

// ---- 開発者ドロワー: 往復・migration・密度ストレスの目視 ----
need<HTMLButtonElement>("load-stress").addEventListener(
  "click",
  () => {
    playmaker.setPlayData({
      version: CURRENT_PLAY_DATA_VERSION,
      field: { zone: playmaker.fieldZone },
      players: STRESS_PLAYERS,
      lines: STRESS_LINES,
    });
    refreshJson();
    activeButton?.classList.remove("is-active");
    activeButton = null;
    setInfo("密度ストレス", null, "選手 22・線 20", "描画・操作の体感速度を手動目視する fixture。");
  },
  { signal },
);

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

function loadFixture(blob: unknown): void {
  jsonArea.value = JSON.stringify(blob, null, 2);
  loadFromJsonText();
}

need<HTMLButtonElement>("json-export").addEventListener(
  "click",
  () => {
    refreshJson();
    dataStatus.textContent = "現在の getPlayData を書き出し";
  },
  { signal },
);
need<HTMLButtonElement>("json-import").addEventListener("click", loadFromJsonText, { signal });
need<HTMLButtonElement>("json-legacy").addEventListener(
  "click",
  () =>
    loadFixture({
      field: { zone: "own-redzone" },
      players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 }, shape: "square" }],
    }),
  { signal },
);
need<HTMLButtonElement>("json-future").addEventListener(
  "click",
  () =>
    loadFixture({
      version: 99,
      field: { zone: "redzone" },
      players: [{ id: "qb", position: { lateralYard: 26, absoluteYard: 48 }, shape: "circle" }],
      lines: [],
      futureOnlyField: { whatever: true },
    }),
  { signal },
);

refreshJson();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    demoLifetime.abort();
    playmaker.dispose();
  });
}
