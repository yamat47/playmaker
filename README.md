# Playmaker

A UI-framework-agnostic TypeScript library for creating and displaying
American football play diagrams. It is the "diagram-authoring core" that the commercial software embeds.
It does not take on host responsibilities such as persistence, authentication, or sharing (see `docs/prd.md` for details).

It is published on npm as `@yamat47/playmaker` (MIT). The demo is at https://playmaker-demo.yamat47.me/.

## Installation

```sh
npm install @yamat47/playmaker
```

The output is ESM only, so the consumer runs it through a bundler. It assumes modern browsers and mouse input on a PC.
Pages without a bundler can load it from a CDN. It has no dependencies, and the fonts are bundled into the JS.
Replace `0.1.0` in the URL with the version you use.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yamat47/playmaker@0.1.0/dist/playmaker.css" />
<script type="module">
  import { Playmaker } from "https://cdn.jsdelivr.net/npm/@yamat47/playmaker@0.1.0/dist/playmaker.js";
</script>
```

The version matches the git tag `vX.Y.Z`. Pushing the tag makes `.github/workflows/release.yml` publish it.
The unscoped `playmaker` is a different package, so always include `@yamat47/`.

## Usage

Pass a container element and options to embed it. Load the styles separately.

```ts
import { Playmaker, type PlayData } from "@yamat47/playmaker";
import "@yamat47/playmaker/styles.css";

const container = document.getElementById("play")!;

const playmaker = new Playmaker(container, {
  mode: "edit", // "edit" (default, with editing UI) / "view" (read-only)
  locale: "en", // language of the editing UI: "en" (default) / "ja"
  initialData: savedPlayData, // the value the commercial software persisted (optional; accepted without checking its shape)
  onChange: (data: PlayData) => {
    // Delivers the latest deep snapshot once per committed edit command or Undo/Redo.
    // You can serialize it to JSON and persist it as is.
    persist(JSON.stringify(data));
  },
});

// You can also subscribe after construction. Dispose the return value to unsubscribe.
const subscription = playmaker.onDidChange((data) => preview(data));
```

### Public API

| Member | Description |
|---|---|
| `new Playmaker(container, options?)` | Creates an instance. `options` takes `mode` / `locale` / `initialData` / `onChange` |
| `onDidChange(listener): IDisposable` | Subscribes to committed edits. Delivers the same value as `options.onChange` |
| `getPlayData(): PlayData` | The canonical snapshot of the current play diagram (a deep copy; `version` is the current one) |
| `restorePlayData(raw: unknown)` | Reloads a persisted value in full (resets the history; does not emit `onChange`) |
| `setPlayData(data: PlayDataInput)` | Loads a whole diagram assembled with the typed API (`field.losYard` is optional) |
| `loadFormation(formation): boolean` | Appends a formation to the existing diagram and returns whether it was placed (offense and defense presets can be layered in turn) |
| `get mode` / `setMode(mode)` | Switches between `edit` / `view`. The diagram and the Undo history remain |
| `get fieldZone` / `setFieldZone(zone)` | The field zone (`middle` / `redzone` / `own-redzone`) |
| `exportToPng(options?): Promise<Blob>` | Exports a PNG without the editing UI. `options.width` sets the output width (px). The upper limit is 4096 |
| `refresh()` | Re-reads the colors of the diagram and the panel after you change the theme's CSS variables |
| `dispose()` | Releases the DOM, subscriptions, and resources. Later changes do nothing and only warn during development |

Re-exports:

- Types: `PlaymakerOptions` `PlaymakerMode` `PlaymakerLocale`(`en`/`ja`) `PlayData` `PlayDataInput` `FieldState` `FieldZone`
  `FieldPosition` `Player` `PlayerShape`(`circle`/`square`) `PlayerFill`(`outline`/`solid`)
  `Line` `LineKind`(`route`/`block`/`motion`)
  `LineInterpolation`(`straight`/`bezier`) `Formation` `FormationPlayer` `PlayPreset` `PlayCategory`
  `TeamSide` `ImageExportOptions` `Event` `IDisposable`
- Values: `FORMATION_PRESETS` `getFormationPreset(id)` `PLAY_PRESETS` `getPlayPreset(id)`
  `FIELD_ZONE_VALUES` `FIELD_ZONE_LABELS` `PLAYMAKER_LOCALE_VALUES` `migratePlayData(raw)` `CURRENT_PLAY_DATA_VERSION`

### Presets

The bundled formations and plays are listed in the `FORMATION_PRESETS` and `PLAY_PRESETS` arrays.
A single one is retrieved with `getFormationPreset(id)` and `getPlayPreset(id)`. An unknown id returns `undefined`.

```ts
import { getFormationPreset } from "@yamat47/playmaker";

// A formation adds players to the current diagram. Offense and defense can be layered in turn.
const offense = getFormationPreset("i-formation");
if (offense) playmaker.loadFormation(offense);
```

```ts
import { PLAY_PRESETS } from "@yamat47/playmaker";

// A play is a diagram with the lines drawn in. Loading its data replaces the current diagram.
const play = PLAY_PRESETS[0];
if (play) playmaker.setPlayData(play.data);
```

Both have `name` and `side` (`offense` / `defense`), so you can use them for list headings or to split offense and defense.
A play also has `category`, `personnel`, and `summary`.
Custom formations managed by the commercial software can also be passed to `loadFormation`. Write player positions relative to the LOS.
Positions are limited to grid points of 0.5 yards (`GRID_STEP_YARDS`), and loaded values are snapped to the nearest grid point.
Horizontally, the range runs from the sideline to `FIELD_WIDTH_YARDS` (53). Vertically, the LOS is 0 and the offensive direction is positive.

### Data integration and versioning

- `onChange` delivers a deep snapshot of the latest PlayData **once per committed edit command or Undo/Redo**.
  It does not fire on construction, on `restorePlayData` / `setPlayData` reloads, or on PNG export
- `getPlayData()` can be persisted as is. Passing it back to `restorePlayData` / `initialData`
  restores an equivalent play diagram (round-trip contract)
- Even when given an old version, no version, a future version, or corrupted data, `migratePlayData` coerces it
  to the current schema and never throws (it only drops elements that cannot be restored). The source of truth for `PlayData.version` is
  `CURRENT_PLAY_DATA_VERSION`

### Modes

- `edit`: edit with the toolbar, the properties panel, and pointer operations. Undo = `Cmd/Ctrl+Z`,
  Redo = `Cmd/Ctrl+Shift+Z` or `Cmd/Ctrl+Y`, Delete or Backspace deletes the selection (or only the
  clicked bend of a selected line), and Esc steps back (cancels the drag or drawing in progress, then
  lets go of the clicked bend, then clears the selection, then returns to the select tool).
  A double-click or Enter finishes the line being drawn.
  Dragging a player moves its lines along with it; hold Option (Alt) to move the player alone.
  On a selected line, drag the small hollow circle halfway along a segment to add a bend there,
  and double-click a bend to remove it.
  The toolbar sits above the diagram and the panel sits to its right. Neither overlaps the diagram.
  The diagram is drawn at a size that fits the container area left after excluding them
- `view`: read-only. No editing UI is shown
- Switching with `setMode` only attaches or detaches the editing UI and input. The diagram and the Undo history remain

### Style customization

The colors and the UI font can be overridden with the CSS custom properties `--playmaker-*`.
Set them on the element that holds Playmaker or on one of its ancestors.
The fonts for yard numbers and player labels are fixed to the bundled ones and cannot be overridden.
When you change the variables after construction, call `refresh()` to apply them to the diagram and the panel.

The default colors come from the Material Design palette. The field has white grass with gray lines, and players and lines are black by default.
The UI font lists Roboto first and falls back to system-ui when it is unavailable.
The field variables have shades chosen for white grass. When you change the grass color, also change the variables for the lines, numbers, goal lines,
end zones, the area outside the sidelines, and the grid.

```css
.my-app {
  --playmaker-line-route: #6a1b9a;
  --playmaker-selection: #00acc1;
  --playmaker-ui-accent: #6a1b9a;
  --playmaker-ui-font: "Inter", system-ui, sans-serif;
}
```

Variables take the form `--playmaker-<part>-<component>`. The following are available.

- Field: `field-grass`, `field-oob`, `field-endzone`, `field-line`, `field-number`, `field-goal-line`, `field-pylon`, `field-goalpost`, and `field-grid` for the grid dots laid out in edit mode
- Players: `player-color` for players with no color set, and `player-label` for the labels of solid players. The inside of an outline player is filled with `field-grass`
- Lines: `line-route`, `line-block`, `line-motion`
- The 4 colors selectable for players and lines in the panel: `swatch-1` through `swatch-4`
- Selection: `selection`, and `selection-outline` for the outline of the handles
- Toolbar and panel: `ui-font`, `ui-surface`, `ui-border`, `ui-text`, `ui-accent`, and `ui-accent-text` for the text color of pressed buttons

## Supported environments

**Desktop environments only**, on modern browsers (the latest 2 versions of
Chrome / Firefox / Safari / Edge). Mobile / touch and a11y are out of scope (`docs/prd.md`, chapter 8).
The editing UI is English by default and ships Japanese, chosen with the `locale` option. Error messages are English only.

## Development

```
library/     The library itself (src/, the development playground in demo/, package.json, and the various configs)
docker/      The development image and compose
docs/        Requirements, design, and plans
Makefile     The entry point for development commands
```

Node / pnpm are not installed on the host. They run inside a Docker container. The host only needs
`make` and Docker (Docker Desktop, colima, or similar).

```sh
make setup          # Build the image and install the dependencies (first time and after changing the Dockerfile)
make up             # Start the development playground (library/demo/) at http://localhost:5173 (make down stops it)
make test           # Vitest (with a built-in 100% coverage gate for the common layer). FILE= runs one file only
make test-browser   # Verify Playmaker's wiring in Chromium with Vitest Browser Mode
make typecheck      # tsc -b (the 5 tsconfigs: common, browser, test, browser-test, and tooling)
make lint           # Biome (make fix applies automatic fixes)
make build          # Vite library mode, output to library/dist/ (ESM, types, CSS)
make check          # Run the same checks as CI
make pnpm ARGS="add -D <pkg>"  # Any pnpm command
make help           # List the targets
```

In VS Code, open with "Dev Containers: Reopen in Container" to use `library/` as the workspace.
The editor's type completion, Biome, and Vitest Explorer then run against the `node_modules` inside the container.
The same `make` targets also work from the Dev Containers terminal (container operations such as `up` / `down` run from the host).

See `docs/design.md` for the current design and its rationale, `docs/prd.md` for the requirements,
and `.claude/rules/testing.md`, `.claude/skills/writing-conventions/`, and `.claude/skills/typescript-idioms/` for the coding conventions.
