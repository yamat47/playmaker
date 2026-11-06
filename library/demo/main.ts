// A development playground for looking at src/browser changes. The public demo lives in
// yamat47/playmaker-demo; this page only needs to load diagrams, switch modes and locales, and
// round-trip PlayData.
import {
  CURRENT_PLAY_DATA_VERSION,
  FORMATION_PRESETS,
  getFormationPreset,
  getPlayPreset,
  type Line,
  PLAY_PRESETS,
  PLAYMAKER_LOCALE_VALUES,
  type PlayData,
  type Player,
  Playmaker,
  type PlaymakerLocale,
  type PlaymakerMode,
} from "@yamat47/playmaker";
// The distributed JS does not load the CSS, so load it separately, as the consumer does.
import "@yamat47/playmaker/styles.css";
import { STRESS_LINES, STRESS_PLAYERS } from "./stress.js";

function need<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) {
    throw new Error(`#${id} is not a ${type.name}`);
  }
  return el;
}

const mountPoint = need("stage", HTMLElement);
const statusEl = need("status", HTMLElement);
const dataStatus = need("data-status", HTMLElement);
const jsonArea = need("json", HTMLTextAreaElement);
const modeButton = need("mode-toggle", HTMLButtonElement);
const localeSelect = need("locale", HTMLSelectElement);
const playSelect = need("play", HTMLSelectElement);
const formationSelect = need("formation", HTMLSelectElement);

let changeCount = 0;
let mode: PlaymakerMode = "edit";

function toLocale(value: string | null): PlaymakerLocale {
  return (PLAYMAKER_LOCALE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as PlaymakerLocale)
    : "en";
}

// ?locale=ja opens the page in Japanese; the select switches it afterwards.
let locale = toLocale(new URLSearchParams(location.search).get("locale"));

function onChange(data: PlayData): void {
  changeCount += 1;
  statusEl.textContent = `onChange #${changeCount} | players ${data.players.length}, lines ${data.lines.length}, zone ${data.field.zone}`;
  jsonArea.value = JSON.stringify(data, null, 2);
}

function createEditor(initialData: unknown): Playmaker {
  return new Playmaker(mountPoint, { initialData, onChange, mode, locale });
}

let playmaker = createEditor(PLAY_PRESETS[0]?.data);
statusEl.textContent = "Waiting for onChange (edit the diagram to update)";

function refreshJson(): void {
  jsonArea.value = JSON.stringify(playmaker.getPlayData(), null, 2);
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

function syncModeButton(): void {
  modeButton.textContent = mode === "edit" ? "Switch to view" : "Switch to edit";
}
syncModeButton();

modeButton.addEventListener("click", () => {
  mode = mode === "edit" ? "view" : "edit";
  playmaker.setMode(mode);
  syncModeButton();
});

// The library fixes the locale at construction, so switching rebuilds the editor.
for (const value of PLAYMAKER_LOCALE_VALUES) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  localeSelect.appendChild(option);
}
localeSelect.value = locale;
localeSelect.addEventListener("change", () => {
  locale = toLocale(localeSelect.value);
  const data = playmaker.getPlayData();
  playmaker.dispose();
  playmaker = createEditor(data);
});

// The browser does not report CSS variable changes, so the host calls refresh() after setting them.
const app = need("app", HTMLElement);
need("theme-toggle", HTMLInputElement).addEventListener("change", (event) => {
  app.classList.toggle("themed", (event.target as HTMLInputElement).checked);
  playmaker.refresh();
});

need("clear", HTMLButtonElement).addEventListener("click", () => {
  replacePlayKeepingZone([], []);
  playSelect.value = "";
});

async function downloadPng(): Promise<void> {
  const blob = await playmaker.exportToPng();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `playmaker-${playmaker.mode}-${Date.now()}.png`;
  a.click();
  // click() downloads asynchronously in some environments, and a synchronous revoke drops the
  // download there, so it is delayed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusEl.textContent = `Exported PNG (${playmaker.mode} mode, ${Math.round(blob.size / 1024)} KB)`;
}

need("export-png", HTMLButtonElement).addEventListener("click", () => {
  downloadPng().catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    statusEl.textContent = `PNG export failed: ${reason}`;
  });
});

function appendPresetOptions(
  select: HTMLSelectElement,
  placeholderText: string,
  presets: readonly { readonly id: string; readonly name: string; readonly side: string }[],
): void {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = placeholderText;
  select.appendChild(placeholder);
  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${preset.name} (${preset.side})`;
    select.appendChild(option);
  }
}

// Every bundled play, so a rendering change can be checked against each shape of diagram.
appendPresetOptions(playSelect, "Load a play…", PLAY_PRESETS);
playSelect.value = PLAY_PRESETS[0]?.id ?? "";
playSelect.addEventListener("change", () => {
  const preset = getPlayPreset(playSelect.value);
  if (preset !== undefined) {
    playmaker.setPlayData(preset.data);
    refreshJson();
  }
});

// The toolbar has no formation picker; a host lists formations itself and calls loadFormation.
appendPresetOptions(formationSelect, "Load a formation…", FORMATION_PRESETS);
formationSelect.addEventListener("change", () => {
  const formation = getFormationPreset(formationSelect.value);
  if (formation !== undefined && !playmaker.loadFormation(formation)) {
    statusEl.textContent = `${formation.name} does not fit: it would exceed the player limit`;
  }
  // Back to the placeholder, so the same formation can be layered again.
  formationSelect.value = "";
});

need("load-stress", HTMLButtonElement).addEventListener("click", () => {
  replacePlayKeepingZone(STRESS_PLAYERS, STRESS_LINES);
  playSelect.value = "";
  statusEl.textContent = `Density stress: players ${STRESS_PLAYERS.length}, lines ${STRESS_LINES.length}`;
});

function loadFromJsonText(): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonArea.value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    dataStatus.textContent = `JSON parse error: ${reason}`;
    return;
  }
  playmaker.restorePlayData(parsed);
  refreshJson();
  playSelect.value = "";
  dataStatus.textContent = "Loaded (version migrated to the current one and shown again)";
}

function loadFixture(blob: unknown): void {
  jsonArea.value = JSON.stringify(blob, null, 2);
  loadFromJsonText();
}

need("json-export", HTMLButtonElement).addEventListener("click", () => {
  refreshJson();
  dataStatus.textContent = "Exported the current getPlayData";
});
need("json-import", HTMLButtonElement).addEventListener("click", loadFromJsonText);
// v1 wrote absolute yards; the migration makes them LOS-relative.
need("json-legacy", HTMLButtonElement).addEventListener("click", () =>
  loadFixture({
    field: { zone: "own-redzone" },
    players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 }, shape: "square" }],
  }),
);
// A version the library does not know yet: coerced to the current schema, unknown keys dropped.
need("json-future", HTMLButtonElement).addEventListener("click", () =>
  loadFixture({
    version: 99,
    field: { zone: "redzone", losYard: 60, weather: "rain" },
    players: [
      {
        id: "qb",
        position: { lateralYard: 26.5, downfieldYard: -5 },
        shape: "hexagon",
        label: "QB",
      },
    ],
    lines: [],
    annotations: [{ text: "not a thing yet" }],
  }),
);
refreshJson();
