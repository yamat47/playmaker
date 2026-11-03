import {
  CURRENT_PLAY_DATA_VERSION,
  FORMATION_PRESETS,
  type Formation,
  type Line,
  PLAY_PRESETS,
  type PlayData,
  type Player,
  Playmaker,
  type PlayPreset,
  type TeamSide,
} from "playmaker";
// 配布版の JS は CSS を読み込まないので、利用者と同じく別に読む。
import "playmaker/styles.css";
import {
  type Chip,
  categoryChip,
  chipElement,
  forEachSide,
  groupTitle,
  need,
  sideChip,
  subTitle,
} from "./presets-ui.js";

const mountPoint = need("stage", HTMLElement);
const libraryScroll = need("library-scroll", HTMLElement);
const statusEl = need("status", HTMLElement);
const jsonArea = need("json", HTMLTextAreaElement);
const dataStatus = need("data-status", HTMLElement);
const infoName = need("playinfo-name", HTMLElement);
const infoChip = need("playinfo-chip", HTMLElement);
const infoPers = need("playinfo-pers", HTMLElement);
const infoSummary = need("playinfo-summary", HTMLElement);

// 静的 HTML のボタン/コンテナは HMR を跨いで生き残る。signal でリスナを束ねて再読込時に
// 外し、コンテナは作り直す前に空にする（束ねないとホットリロードごとに多重登録される）。
const demoLifetime = new AbortController();
const { signal } = demoLifetime;

// 要素が多い図でも描画と操作が重くならないかを目で確かめる図。丸と四角、3 種の線、
// straight と bezier、waypoint を複数持つ線を、1 回の読み込みですべて出す。
const STRESS_PLAYERS: Player[] = [
  { id: "ol-c", position: { lateralYard: 26.5, downfieldYard: -1 }, shape: "square", label: "C" },
  { id: "ol-lg", position: { lateralYard: 24, downfieldYard: -1 }, shape: "square", label: "LG" },
  { id: "ol-rg", position: { lateralYard: 29, downfieldYard: -1 }, shape: "square", label: "RG" },
  { id: "ol-lt", position: { lateralYard: 21.5, downfieldYard: -1 }, shape: "square", label: "LT" },
  { id: "ol-rt", position: { lateralYard: 31.5, downfieldYard: -1 }, shape: "square", label: "RT" },
  { id: "qb", position: { lateralYard: 26.5, downfieldYard: -3.5 }, shape: "circle", label: "QB" },
  { id: "rb", position: { lateralYard: 26.5, downfieldYard: -7 }, shape: "circle", label: "RB" },
  { id: "wr-x", position: { lateralYard: 7, downfieldYard: -0.5 }, shape: "circle", label: "X" },
  { id: "wr-z", position: { lateralYard: 46, downfieldYard: -0.5 }, shape: "circle", label: "Z" },
  { id: "wr-y", position: { lateralYard: 38, downfieldYard: -2 }, shape: "circle", label: "Y" },
  { id: "te", position: { lateralYard: 34, downfieldYard: -1 }, shape: "square", label: "TE" },
  {
    id: "de-l",
    position: { lateralYard: 21.5, downfieldYard: 1 },
    shape: "circle",
    fill: "solid",
    label: "",
  },
  {
    id: "dt-l",
    position: { lateralYard: 24, downfieldYard: 1 },
    shape: "circle",
    fill: "solid",
    label: "",
  },
  {
    id: "dt-r",
    position: { lateralYard: 29, downfieldYard: 1 },
    shape: "circle",
    fill: "solid",
    label: "",
  },
  {
    id: "de-r",
    position: { lateralYard: 31.5, downfieldYard: 1 },
    shape: "circle",
    fill: "solid",
    label: "",
  },
  {
    id: "lb-w",
    position: { lateralYard: 22, downfieldYard: 4 },
    shape: "circle",
    fill: "solid",
    label: "W",
  },
  {
    id: "lb-m",
    position: { lateralYard: 26.5, downfieldYard: 4 },
    shape: "circle",
    fill: "solid",
    label: "M",
  },
  {
    id: "lb-s",
    position: { lateralYard: 31.5, downfieldYard: 4 },
    shape: "circle",
    fill: "solid",
    label: "S",
  },
  {
    id: "cb-l",
    position: { lateralYard: 7, downfieldYard: 3 },
    shape: "circle",
    fill: "solid",
    label: "",
  },
  {
    id: "cb-r",
    position: { lateralYard: 46, downfieldYard: 3 },
    shape: "circle",
    fill: "solid",
    label: "",
  },
  {
    id: "fs",
    position: { lateralYard: 24, downfieldYard: 8 },
    shape: "circle",
    fill: "solid",
    label: "FS",
  },
  {
    id: "ss",
    position: { lateralYard: 30, downfieldYard: 7 },
    shape: "circle",
    fill: "solid",
    label: "SS",
  },
];

const STRESS_LINES: Line[] = [
  {
    id: "bl-c",
    kind: "block",
    startPlayerId: "ol-c",
    waypoints: [],
    end: { lateralYard: 26.5, downfieldYard: 0.5 },
    interpolation: "straight",
  },
  {
    id: "bl-lg",
    kind: "block",
    startPlayerId: "ol-lg",
    waypoints: [],
    end: { lateralYard: 24, downfieldYard: 0.5 },
    interpolation: "straight",
  },
  {
    id: "bl-rg",
    kind: "block",
    startPlayerId: "ol-rg",
    waypoints: [],
    end: { lateralYard: 29, downfieldYard: 0.5 },
    interpolation: "straight",
  },
  {
    id: "bl-lt",
    kind: "block",
    startPlayerId: "ol-lt",
    waypoints: [],
    end: { lateralYard: 21.5, downfieldYard: 0.5 },
    interpolation: "straight",
  },
  {
    id: "bl-rt",
    kind: "block",
    startPlayerId: "ol-rt",
    waypoints: [],
    end: { lateralYard: 31.5, downfieldYard: 0.5 },
    interpolation: "straight",
  },
  {
    id: "rt-x",
    kind: "route",
    startPlayerId: "wr-x",
    waypoints: [{ lateralYard: 7, downfieldYard: 10 }],
    end: { lateralYard: 13, downfieldYard: 10 },
    interpolation: "straight",
  },
  {
    id: "rt-z",
    kind: "route",
    startPlayerId: "wr-z",
    waypoints: [
      { lateralYard: 46, downfieldYard: 8 },
      { lateralYard: 43, downfieldYard: 10 },
    ],
    end: { lateralYard: 40, downfieldYard: 6 },
    interpolation: "bezier",
  },
  {
    id: "rt-y",
    kind: "route",
    startPlayerId: "wr-y",
    waypoints: [{ lateralYard: 36, downfieldYard: 4 }],
    end: { lateralYard: 18, downfieldYard: 11 },
    interpolation: "bezier",
  },
  {
    id: "rt-te",
    kind: "route",
    startPlayerId: "te",
    waypoints: [{ lateralYard: 33, downfieldYard: 3 }],
    end: { lateralYard: 38, downfieldYard: 6 },
    interpolation: "straight",
    color: "#1976d2",
  },
  {
    id: "rt-rb",
    kind: "route",
    startPlayerId: "rb",
    waypoints: [{ lateralYard: 35, downfieldYard: -4 }],
    end: { lateralYard: 45, downfieldYard: 1 },
    interpolation: "bezier",
  },
  {
    id: "mo-y",
    kind: "motion",
    startPlayerId: "wr-y",
    waypoints: [{ lateralYard: 35, downfieldYard: -2 }],
    end: { lateralYard: 30, downfieldYard: -2.5 },
    interpolation: "straight",
  },
  {
    id: "pr-de-l",
    kind: "route",
    startPlayerId: "de-l",
    waypoints: [],
    end: { lateralYard: 22, downfieldYard: -1 },
    interpolation: "straight",
  },
  {
    id: "pr-dt-l",
    kind: "route",
    startPlayerId: "dt-l",
    waypoints: [],
    end: { lateralYard: 24, downfieldYard: -1 },
    interpolation: "straight",
  },
  {
    id: "pr-dt-r",
    kind: "route",
    startPlayerId: "dt-r",
    waypoints: [],
    end: { lateralYard: 29.5, downfieldYard: -1 },
    interpolation: "straight",
  },
  {
    id: "pr-de-r",
    kind: "route",
    startPlayerId: "de-r",
    waypoints: [],
    end: { lateralYard: 32, downfieldYard: -1 },
    interpolation: "straight",
  },
  {
    id: "cv-lb-w",
    kind: "route",
    startPlayerId: "lb-w",
    waypoints: [{ lateralYard: 22, downfieldYard: 2 }],
    end: { lateralYard: 20, downfieldYard: -0.5 },
    interpolation: "straight",
  },
  {
    id: "cv-lb-m",
    kind: "route",
    startPlayerId: "lb-m",
    waypoints: [{ lateralYard: 28, downfieldYard: 4 }],
    end: { lateralYard: 33, downfieldYard: 3 },
    interpolation: "bezier",
  },
  {
    id: "cv-lb-s",
    kind: "route",
    startPlayerId: "lb-s",
    waypoints: [{ lateralYard: 32, downfieldYard: 3 }],
    end: { lateralYard: 35, downfieldYard: 2 },
    interpolation: "straight",
  },
  {
    id: "cv-cb-l",
    kind: "route",
    startPlayerId: "cb-l",
    waypoints: [{ lateralYard: 7, downfieldYard: 5 }],
    end: { lateralYard: 7, downfieldYard: 10 },
    interpolation: "straight",
  },
  {
    id: "cv-cb-r",
    kind: "route",
    startPlayerId: "cb-r",
    waypoints: [{ lateralYard: 46, downfieldYard: 5 }],
    end: { lateralYard: 46, downfieldYard: 10 },
    interpolation: "straight",
  },
];

let changeCount = 0;

function onChange(data: PlayData): void {
  changeCount += 1;
  statusEl.textContent = `onChange #${changeCount}｜選手 ${data.players.length}・線 ${data.lines.length}・ゾーン ${data.field.zone}`;
  jsonArea.value = JSON.stringify(data, null, 2);
}

function refreshJson(): void {
  jsonArea.value = JSON.stringify(playmaker.getPlayData(), null, 2);
}

statusEl.textContent = "onChange 待ち（編集すると更新されます）";
const playmaker = new Playmaker(mountPoint, { initialData: PLAY_PRESETS[0]?.data, onChange });

let activeButton: HTMLButtonElement | null = null;

function setActive(button: HTMLButtonElement | null): void {
  activeButton?.classList.remove("is-active");
  button?.classList.add("is-active");
  activeButton = button;
}

function setInfo(name: string, chip: Chip | null, pers: string, summary: string): void {
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

function presetButton(name: string, chip: Chip): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preset";
  const nameEl = document.createElement("span");
  nameEl.className = "preset__name";
  nameEl.textContent = name;
  button.append(chipElement(chip, "preset__chip"), nameEl);
  return button;
}

function replacePlayKeepingZone(players: readonly Player[], lines: readonly Line[]): void {
  playmaker.setPlayData({
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: playmaker.fieldZone },
    players,
    lines,
  });
  refreshJson();
}

function loadPlay(preset: PlayPreset): void {
  playmaker.setPlayData(preset.data);
  refreshJson();
}

interface PresetRow {
  name: string;
  chip: Chip;
  /** 図を読み込めなかったときは false を返す。 */
  select: () => boolean;
}

// フォーメーションとプレー図で違うのは 1 行の見た目と押したときの処理だけなので、それを toRow で受け取る。
function addSection<T extends { id: string; side: TeamSide }>(
  title: string,
  items: readonly T[],
  toRow: (item: T) => PresetRow,
): void {
  libraryScroll.append(groupTitle(title));
  forEachSide(items, (side, matching) => {
    libraryScroll.append(subTitle(side));
    for (const item of matching) {
      const row = toRow(item);
      const button = presetButton(row.name, row.chip);
      button.dataset.presetId = item.id;
      button.addEventListener("click", () => {
        if (row.select()) {
          setActive(button);
        }
      });
      libraryScroll.append(button);
    }
  });
}

function formationRow(formation: Formation): PresetRow {
  return {
    name: formation.name,
    chip: sideChip(formation.side),
    select: () => {
      if (!playmaker.loadFormation(formation)) {
        infoSummary.textContent = `${formation.name} は、選手の上限を超えるので置きませんでした。`;
        return false;
      }
      setInfo(
        formation.name,
        null,
        "Formation",
        "今の図に選手を足しました（線は付きません）。攻守の隊形を重ねられます。",
      );
      return true;
    },
  };
}

function playRow(preset: PlayPreset): PresetRow {
  const chip = categoryChip(preset.category);
  return {
    name: preset.name,
    chip,
    select: () => {
      loadPlay(preset);
      setInfo(preset.name, chip, preset.personnel, preset.summary);
      return true;
    },
  };
}

libraryScroll.replaceChildren();
addSection("Formations", FORMATION_PRESETS, formationRow);
addSection("Plays", PLAY_PRESETS, playRow);

// 初期表示は先頭プレー図に同期する（左レールのハイライトと Play info も合わせる）。
const initialPreset = PLAY_PRESETS[0];
if (initialPreset !== undefined) {
  const initialButton = libraryScroll.querySelector<HTMLButtonElement>(
    `[data-preset-id="${initialPreset.id}"]`,
  );
  if (initialButton !== null) {
    setActive(initialButton);
    setInfo(
      initialPreset.name,
      categoryChip(initialPreset.category),
      initialPreset.personnel,
      initialPreset.summary,
    );
  }
}

const modeButton = need("mode-toggle", HTMLButtonElement);
modeButton.addEventListener(
  "click",
  () => {
    playmaker.setMode(playmaker.mode === "edit" ? "view" : "edit");
    syncModeButton();
  },
  { signal },
);

function syncModeButton(): void {
  const { mode } = playmaker;
  modeButton.textContent = mode === "edit" ? "view モードへ" : "edit モードへ";
  modeButton.setAttribute("aria-pressed", String(mode === "view"));
}
syncModeButton();

need("clear", HTMLButtonElement).addEventListener(
  "click",
  () => {
    replacePlayKeepingZone([], []);
    setActive(null);
    setInfo("—", null, "", "");
  },
  { signal },
);

async function downloadPng(): Promise<void> {
  const blob = await playmaker.exportToPng();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `playmaker-${playmaker.mode}-${Date.now()}.png`;
  a.click();
  // click() のダウンロードは環境により非同期。同期 revoke で取りこぼす環境があるため遅延する。
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusEl.textContent = `PNG 出力（${playmaker.mode} モード・${Math.round(blob.size / 1024)}KB）`;
}

need("export-png", HTMLButtonElement).addEventListener(
  "click",
  () => {
    downloadPng().catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      statusEl.textContent = `PNG 出力に失敗しました: ${reason}`;
    });
  },
  { signal },
);

const drawer = need("drawer", HTMLElement);
const devToggle = need("dev-toggle", HTMLButtonElement);
devToggle.addEventListener(
  "click",
  () => {
    const open = drawer.classList.toggle("is-open");
    devToggle.setAttribute("aria-pressed", String(open));
  },
  { signal },
);

need("load-stress", HTMLButtonElement).addEventListener(
  "click",
  () => {
    replacePlayKeepingZone(STRESS_PLAYERS, STRESS_LINES);
    setActive(null);
    setInfo(
      "密度ストレス",
      null,
      `選手 ${STRESS_PLAYERS.length}・線 ${STRESS_LINES.length}`,
      "描画・操作の体感速度を手動目視する fixture。",
    );
  },
  { signal },
);

function loadFromJsonText(): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonArea.value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    dataStatus.textContent = `JSON 解析エラー: ${reason}`;
    return;
  }
  playmaker.restorePlayData(parsed);
  refreshJson();
  dataStatus.textContent = "読込完了（version は現行へ寄せて再表示）";
}

function loadFixture(blob: unknown): void {
  jsonArea.value = JSON.stringify(blob, null, 2);
  loadFromJsonText();
}

need("json-export", HTMLButtonElement).addEventListener(
  "click",
  () => {
    refreshJson();
    dataStatus.textContent = "現在の getPlayData を書き出し";
  },
  { signal },
);
need("json-import", HTMLButtonElement).addEventListener("click", loadFromJsonText, { signal });
need("json-legacy", HTMLButtonElement).addEventListener(
  "click",
  () =>
    loadFixture({
      field: { zone: "own-redzone" },
      players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 }, shape: "square" }],
    }),
  { signal },
);
need("json-future", HTMLButtonElement).addEventListener(
  "click",
  () =>
    loadFixture({
      version: 99,
      field: { zone: "redzone" },
      players: [{ id: "qb", position: { lateralYard: 26, downfieldYard: -2 }, shape: "circle" }],
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
