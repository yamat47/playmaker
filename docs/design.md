# Playmaker design

This document describes the shape of the current code and why it is that way. The requirements are in `docs/prd.md`, and the test conventions are in `.claude/rules/testing.md`.
Paths are written relative to `library/`.

## Layer split

The code uses a lightened version of VSCode's layer separation. Lower layers do not depend on upper layers.

| Layer | Location | Contents |
|---|---|---|
| common | `src/common/` | Logic that does not touch the DOM. Data, coordinates, editing, commands, export dimensions, the shapes of line decorations |
| browser | `src/browser/` | Canvas rendering, theme reading, pointer and key input, toolbar and panel |
| Public entry | `src/playmaker.ts` | The `Playmaker` class that wires the two layers together, and re-exports of the types and values shown to the consumer |

For new logic, first consider whether it can go in common. The more decisions move into common, the thinner the browser shell can be.

browser depends on interfaces (`IPlayModel`, `IEditorController`, `ILayerRenderer`, and so on) rather than on the concrete classes of common, and goes through commands instead of writing to the Model directly. Dependencies are passed as constructor arguments. There are no decorators and no service container. Event subscriptions and DOM listeners are registered with their owner through `_register` of `Disposable` and released together by `dispose()`.

The direction of dependencies is enforced mechanically in 2 places.

- tsconfigs are split by purpose and type-checked together with `tsc -b`. `tsconfig.common.json` has only ES2022 in lib and an empty types, so writing `document` or `window` in common is a type error
- `noRestrictedImports` in `biome.jsonc` rejects imports of browser and `playmaker.ts` from common. `src/test-support/` is outside the build, so imports of it from the main code are rejected as well

| tsconfig | Target | lib and types |
|---|---|---|
| `tsconfig.base.json` | Shared compilerOptions | ES2022, no types |
| `tsconfig.common.json` | `src/common` (excluding tests) | As in base |
| `tsconfig.browser.json` | `src/browser`, `src/playmaker.ts`, `demo` | DOM, vite/client |
| `tsconfig.test.json` | Tests that run on node, and `src/test-support` | As in base |
| `tsconfig.browser-test.json` | `*.browser.test.ts` | DOM, vite/client, @vitest/browser-playwright |
| `tsconfig.tooling.json` | `vite.config.ts` | node |
| `tsconfig.build.json` | The range from which vite-plugin-dts emits type definitions | DOM, vite/client |

`tsconfig.json` only bundles the 5 configs other than the build one through references.

The common Emitter forwards listener exceptions to `console.error`. common has no type for console, so `base/event.ts` declares only `error` on `declare const console` inside the file. Declaring it globally would clash with the console of the DOM or @types/node. The option of having no default destination was not taken, because it would mean injecting an error destination into every Emitter in common.

## Data

### PlayData

`PlayData` has 4 parts: the version, the field, the players, and the lines. All types are readonly, so a consumer modifying a value it received does not affect the diagram.

```ts
interface PlayData {
  readonly version: 2;
  readonly field: { readonly zone: FieldZone; readonly losYard: number };
  readonly players: readonly Player[];
  readonly lines: readonly Line[];
}
```

Players and lines are drawn in array order, and later elements are stacked on top.

- A player has an id, a position, a shape, a label, and an optional color and fill. The fill is either outline (`outline`, the default) or solid (`solid`), and is held independently of the shape. Offense and defense and roles are told apart by this fill, and the presets omit both color and fill and draw with the defaults. The shapes are limited to 2 kinds, `circle` and `square`. Many kinds make the diagram cluttered, and both can be hit-tested with their circumscribed circle, so the hit-test does not need to branch on shape
- A line has an id, a kind (`route` / `block` / `motion`), the id of the start player, a sequence of waypoints, an end point, an interpolation (`straight` / `bezier`), and an optional color. The start is held as a player id rather than a coordinate, so moving the player moves the root of the line with it
- Lines have no width setting; every line of a kind is drawn at the same width, and emphasis is left to color. A `thickness` that version 0.2 and earlier saved is dropped on load, without bumping `CURRENT_PLAY_DATA_VERSION`, and the line is drawn at the default width
- Players and lines with color or fill omitted are drawn with the theme color and the default fill. The "default" button in the panel returns them to the omitted state
- The player color in the panel is chosen from 8 swatches, the outline and solid versions of each of the 4 colors. Making "solid or outline" a separate choice would mean choosing twice, so it is chosen together with the color in one step. There is no free color input. The choice is limited to the same 4 colors as lines

### Coordinates

The vertical axis of the field is thought of in absolute yards. The own goal line is 0 and the opponent's goal line is 100. Including the end zones, the range is -10 to 110. Larger is the direction of attack, which is up on the screen.

The positions of players and lines are held relative to the LOS, not in absolute yards.

- `lateralYard` is the distance from the left sideline (0 to `FIELD_WIDTH_YARDS`)
- `downfieldYard` is the distance from the LOS. Positive is the direction of attack, negative is the backfield

Switching the zone moves the LOS to the default position for that zone (`LOS_YARD_BY_ZONE`: middle 50, opponent's RZ 85, own RZ 10). Because positions are relative to the LOS, the diagram moves with it while keeping its shape. When positions were held in absolute coordinates, a diagram drawn at midfield disappeared outside the window in the red zone.

`field.losYard` is included in the saved data, but on load it is decided again from the zone and the passed value is not used. The value is held so that the absolute positions of players can be restored from the saved data alone. An API that lets the consumer place the LOS anywhere will be considered once there is a request for it.

Both positions are limited to grid points at 0.5 yards (`GRID_STEP_YARDS`). The grid has the sideline as its origin horizontally and the LOS vertically, and `snapToGrid` moves a position to the nearest grid point. Snapping to the grid happens in 2 places: `parseFieldPosition`, the entry point for positions from outside (`setPlayData`, `restorePlayData`, and the formation and play presets), and `clampToField` in `EditorController`, which decides positions from the pointer. These 2 are the only places that create positions, so there is no off-grid position inside the model. Patches from the panel carry only the label, shape, color, and fill, and have no position. This is the mechanism for aligning rows and columns without building an operation that aligns elements to each other, and there is no way to leave the grid and place freely. When positions were held as continuous values, the only way to align them was by eye.

The field width is 53 yards (`FIELD_WIDTH_YARDS`), not the regulation 53⅓ yards. This puts the center (26.5) on a grid point so that symmetric placements can be written on the grid, and the difference is only 1 foot. The hash positions are rounded to grid points for the same reason.

The zone window is decided by `fieldZoneWindow`. The middle shows 30 yards vertically, and the red zones show from 25 yards before the goal line through the end zone. The red zone window is deeper than the actual 20 yards to keep the 20-yard line off the edge of the window, where the yard numbers would be cut off.
Positions placed by dragging or clicking are moved inside the window by `clampToZoneWindow` before snapping to the grid, so players and points are never placed where they cannot be seen. Every window edge is a grid point, so rounding after clamping does not leave the window.

### Values received from outside

All values from outside are received as `unknown` and normalized before they enter. The entry points and contracts are as follows.

| Entry point | Accepted type | Passes through |
|---|---|---|
| `new Playmaker(container, { initialData })`, `restorePlayData(raw)` | `unknown` | `migratePlayData` |
| `setPlayData(data)` | `PlayDataInput` | `migratePlayData` (even when the type matches, duplicate ids and count limits are normalized) |
| `loadFormation(formation)` | `Formation` | `normalizeFormation` |
| `exportToPng({ width })` | `ImageExportOptions` | `resolveImageExportSize` |

Constructor options (`mode`, `locale`, `onChange`) are not normalized; their TypeScript types are the contract, and a value outside them is a caller bug.

`migratePlayData` does not throw. It reads the written version (treated as 0 if it is not a number), passes the data through each migration step newer than that version in order, and finally shapes it with `resolvePlayData`. Old versions, data without a version, and future versions all become `PlayData` of the current version. Only unreadable elements are dropped, and missing values are filled with defaults.

- Players whose position is not a finite number, lines whose start player does not exist, and lines whose end point cannot be read are dropped
- Players and lines without an id get an id from their array position, and for duplicate ids the second and later ones are reassigned to unused ids
- Players, lines, and waypoints per line are read only up to `MAX_PLAYERS`, `MAX_LINES`, and `MAX_WAYPOINTS_PER_LINE`. Only the first elements of the array up to the limit are examined, and unreadable elements count toward the limit. Even when a huge array or a sparse array is passed, the amount read stops at the limit

A real diagram has about 22 players and 20 lines, so the limits exist to keep rendering from stalling on broken or malicious data. The limits cannot be exceeded through editing either (see below).

Adding an optional key does not bump the version; `resolvePlayData` fills the missing value with the default (the player `fill` is an example). Removing an optional key does not bump it either; normalization drops the key (the line `thickness` is an example). When the meaning of an existing item changes, bump `CURRENT_PLAY_DATA_VERSION` by 1, add a step to `PLAY_DATA_MIGRATIONS` that converts from the previous version, and write tests for that step. A step only needs to convert the items whose meaning changes in the next version; `resolvePlayData` shapes the rest. The v1 to v2 step subtracts the zone's LOS from the v1 absolute yards to make them LOS-relative.

`Formation` writes player positions relative to the LOS. No migration is applied to custom formations written in v1 absolute yards. Players whose position cannot be read are dropped, and `loadFormation` returns false if there is not a single player that can be placed.

### Presets

Formations (`FORMATION_PRESETS`) and plays with lines drawn in (`PLAY_PRESETS`) are bundled. Both return frozen values as they are. They cannot be modified either at the type level or at runtime, so they are not copied on each hand-off.

- A formation is passed to `loadFormation` and appends players to the current diagram. Offensive and defensive formations can be layered one after another
- A play's `data` is a `PlayData` that can be passed directly to `setPlayData`, accompanied by a name, offense or defense, type, personnel, and a one-line description. How to show them in a list is up to the consumer, so they carry no color
- Alignments are held in one place, `presets/alignments.ts`, and both formations and plays are built from there. The defensive line is set on the shoulders of the OL (shaded), and block end points are placed on the edge of the opponent's marker, so it is readable who covers which gap and who blocks whom. Every defensive player also gets a label

## Editing

### PlayModel

`PlayModel` (`IPlayModel`) is the only place that holds the diagram state, and it emits `onDidChange` once on every change. It has the following invariants, and rejects changes that break them by throwing.

- Player and line ids are not duplicated
- The start of a line points to an existing player. Deleting a player also deletes the lines that start from that player, and Undo restores the original order
- The numbers of players, lines, and waypoints do not exceed the limits. Changes that increase a count go through a single commit, where the limit is checked
- Deletion records carry the index used to restore the original order. When the index points outside the current order, it throws instead of clamping to the end

The state is replaced on every change, so `getSnapshot` returns it without copying. Deep copies are made only for `getData`, which hands data out, and right before notifying the consumer.

### Commands and history

All edits are expressed as `ICommand` (`apply` / `undo`). There are commands for adding, deleting, and updating players, adding, deleting, and updating lines, switching the zone, and loading a formation.

- `apply` returns true when it changed the Model. An operation that changes nothing returns false without touching the Model, and `CommandService` does not push it onto the history. Undo never becomes a no-op step after a patch with unchanged values or a zone switch
- The previous state needed for the inverse operation is remembered by each command itself when `apply` runs. redo calls `apply` again
- Updates are passed as patches. Omitted keys keep the current value, and `null` clears the value of an optional key (color and fill). The rule lives in one place, `commands/patch.ts`

`UndoRedoService` is a linear history, and pushing a new edit discards the redo history. undo and redo take the function to run, and rearrange the history after it returns, so the history seen by a notified listener is always committed.

### EditorController

`EditorController` (`IEditorController`) knows nothing about the DOM. It receives the tool, the selection, and gestures in yard coordinates, and assembles commands. The browser input and UI call only this.

- The interface is split into reading (`IEditorScene`), gestures (`IEditorGestures`), and operations from buttons and panels (`IEditorActions`). The toolbar and panel receive `IEditorUi`, which knows nothing about gestures
- The selection is a desired id, and is not cleared when the target disappears. Existence is checked on read. "Nothing selected" is expressed as `kind: "none"`, the same as for overlays, and null and undefined are not used
- A drag or a drawing in progress is held as state in `interaction.ts` without emitting commands. `preview.ts` builds the diagram with the in-progress state layered over the committed diagram, plus the overlay, and rendering uses that. Neither the history nor `onChange` moves until the edit is committed
- The line tools are named after the line kinds (`route`, `block`, `motion`). The tool stays after a line is committed, because the lines of a play are drawn in runs, and the committed line is selected so the panel can adjust it before the next press starts another line
- Starting a drawing clears the selection. Left selected, the panel and the handles would keep pointing at another element while the line is drawn, and the panel shows how to finish the line instead
- A change to the diagram that a drag or drawing did not commit itself (Undo, a zone switch, a load, a deletion by key) ends that drag or drawing. Their own commits clear them before running, so a drag or drawing never sees its target change, and neither the drop nor the commit checks for a vanished or moved target
- Adding a player, starting a drawing, placing a point, and loading a formation do nothing when the limit is reached. The tool checks are gathered in `isToolAvailable` in `editor.ts` and shared with the check that disables the toolbar buttons. A formation that does not fit places no player at all, and `loadFormation` returns false so the host can tell
- Notifications are bundled by `EditorNotifier`. Every public operation is wrapped in one batch, and however many times the Model, history, selection, and in-progress state change, `onDidChangeScene` and `onDidChangeViewState` are each emitted once at the end of the operation. The view state notification is emitted only when the value changes, so the toolbar and panel are not synchronized during a drag

ids are assigned by `IdFactory`, which increases monotonically per prefix. Deleted ids are not reused, so they do not collide with elements restored by Undo.

Gesture interpretation and command assembly remain in the same class, and `editor-controller.ts` is about 400 lines. Splitting gestures into a separate class will be considered when the kinds of input grow.

### PlaySession

`PlaySession` holds the full set of parts for one diagram (Model, history, controller). `setPlayData` rebuilds the parts entirely, clears the history, and emits `onDidReset`. The option of keeping one controller and swapping only the Model was not taken, because it assumes the controller can swap its Model.

The session forwards `onDidChangeScene` and `onDidChangeViewState` of the current controller, so rendering does not need to resubscribe after a rebuild. The toolbar, panel, and pointer input hold the controller, so they reattach on `onDidReset`.

`onDidChange` passes a deep copy of the latest diagram once per committed edit. The copy is made per listener, so one listener modifying it does not affect the other listeners.

`PlaySession` and `IEditorController` are not public. Freezing a gesture-level API with compatibility guarantees has no benefit for the current consumer.

## Rendering

### Layers

`CanvasSurface` is responsible only for the canvas size, the DPR, and the timing of redraws. What to draw is left to the layers.

- A layer implements `ILayerRenderer { draw(ctx, frame) }`. `SurfaceLayers` has 4 stages: field (the field), backdrop (the grid laid down only while editing), play (lines and players), and editor (selection highlights and handles overlaid only while editing). They are drawn in this order, which puts lines under players
- The diagram layers (field and play) receive only `RenderFrame` (geometry, metrics, diagram, theme). The overlay (selection highlights and handles) is received only by the editor layer through `EditorRenderFrame`, so the type system makes it impossible for a diagram layer to draw the overlay
- The editing-only layers (backdrop and editor) are drawn only when an overlay is passed to `setScene`. view mode does not pass one, so neither the grid nor the selection highlight appears. The grid is a separate stage rather than part of play because it has to lie above the field and below lines and players, and because it must stay out of the export
- `draw` is declared as a function-typed property rather than a method. With method syntax, parameters are compared bivariantly, and putting an editor layer into an array of diagram layers would not be a type error
- Redraws are batched into one with `requestAnimationFrame`. When the size changes, the buffer is lost, so it draws immediately without waiting
- geometry is not held as state. It is computed each time from the host size and the zone, when drawing and when converting coordinates

The shapes of lines and players are decided in common, and browser only draws them. Curves convert Catmull-Rom to bezier and sample it into a polyline in yard space (`sampleLinePath`), and rendering and hit-testing use the same polyline. The arrowhead, the T of `block`, the trimming before the arrowhead (`line-decoration.ts`), and the outline of the player marker (`player-marker.ts`) are also in common and tested on node. How each line kind is drawn is in PRD 5.3.

### Theme

Colors and the UI font can be overridden with the CSS variables `--playmaker-<part>-<component>`.

- The default colors are chosen from the Material Design palette. The field is drawn as white grass with only shades of gray, so that the player and line colors are the focus of the diagram. The selection color is an orange that is not in the palette, so it is not confused with line colors
- The default values of the colors drawn on the Canvas are written in only one place, `THEME_TOKENS` in `browser/theme/tokens.ts`. The variables are read with `getComputedStyle` before drawing, and a value that is empty or cannot be read as a color falls back to the default. Read values are normalized by `normalizeCssColor` so that they can be compared with the panel swatches
- The toolbar and panel colors are decided by CSS alone, so their defaults are written once in the internal variables (`--_playmaker-ui-*`) of `styles.css`
- The public variables are not declared on `.playmaker-root`. Declaring them there would cancel the values the consumer sets on an ancestor element
- The browser does not notify when a CSS variable changes, so the consumer calls `refresh()` to read them again

The yard numbers and player labels are fixed to the bundled font (`src/assets/`, rebuilt with `make font`) and cannot be overridden. Canvas `ctx.font` does not interpret CSS `var()`, so the font is assembled from constants rather than variables. The font name is library-specific so that it does not collide with the fonts of the host page. The font is registered from JS with `FontFace`, not with `@font-face` in `styles.css`. This lets a PNG exported before the consumer loads the CSS still be drawn with the bundled font. The woff2 is embedded in the JS as a data URI at build time, so the consumer does not need to place a font file.

### PNG export

Export and on-screen rendering draw the diagram layers with the same `renderLayers`. Export does not go through the editing-only layers, so the grid, selection highlights, handles, and in-progress drawing shapes are not included. The toolbar and panel are elements outside the canvas, so they are never included in the first place.

- When the width exceeds `MAX_EXPORT_WIDTH`, it is clamped rather than rejected. The limit is a value that fits within the canvas area limit of Safari on iOS for every zone
- It rejects when a canvas cannot be allocated, when the image cannot be turned into a PNG, and after dispose. When the font cannot be loaded, it does not reject and draws with a fallback font

## Input and built-in UI

- `PointerInput` checks the pointer button and accepts only the primary button, and cancels the in-progress operation on `pointercancel`. The canvas in edit mode gets `touch-action: none` so that drags are not taken by page scrolling. Key bindings are decided by `resolveKeyAction` in `common/input/keymap.ts`. The only shortcuts are Undo and Redo, Delete and Backspace to delete the selection, Enter to commit a drawing, and Esc to step back. Esc backs out one level per press (the drag or drawing in progress, then the selection, then the tool), so pressing it repeatedly always lands on the select tool with nothing selected
- Every string the toolbar and panel show comes from a `Messages` dictionary in `browser/i18n/`. `en` is the default and `ja` is bundled; `PlaymakerOptions.locale` picks one at construction, and `Playmaker` sets `lang` on its root to the same value. Sentences whose word order differs between languages (a swatch name, a limit reason) are functions in the dictionary. Both dictionaries are a few kilobytes, so both are bundled rather than loaded on demand. There is no `setLocale`: the host knows its language at start-up, and switching means constructing again with the same data. Error messages, `console.warn`, command labels, and the preset summaries are English only and not in the dictionary, because developers read them
- The toolbar and panel are built with vanilla DOM. The panel remembers the kind and id of the element being shown, and while the same element is shown it writes only the values without rebuilding the inputs, so focus is not lost while typing
- When a limit is reached, the add-player and drawing buttons are made unpressable, and the reason is shown in the title. Buttons use `aria-disabled` rather than `disabled`, so they stay in the focus and Tab order. Setting `disabled` right after a press drops focus to the body
- The toolbar has no formation picker. Which formations to offer, and how to list them, is the host's decision; the host loads the chosen one with `loadFormation`
- The root in edit mode is a grid, with the toolbar above the diagram and the panel to its right. The canvas is drawn at the size of the remaining area and does not overlap the UI. view mode builds no UI, and the stage occupies the whole root

## Public API

The consumer touches only the `Playmaker` class and the types and values re-exported from `playmaker.ts`. The list of members is in the README.

- `setMode` keeps the `PlaySession`, which holds the diagram and history, and attaches or detaches only the bundle of editing UI, pointer input, and key input. Switching to view cancels the in-progress operation and does not draw the selection highlight. The selection itself is kept, so switching back to edit brings the highlight back
- The input types are split in 2: `restorePlayData(raw: unknown)`, which restores a persisted value without checking its shape, and `setPlayData(data: PlayDataInput)`, which takes a diagram assembled with types. `PlayDataInput` can omit `field.losYard`. Both are loads, not edits, so they clear the history and do not emit `onDidChange`
- Changes are subscribed to with `onDidChange: Event<PlayData>`, and disposing the returned `IDisposable` unsubscribes. `options.onChange` only registers with this at construction
- Changes after dispose do nothing and do not throw. `getPlayData` and `fieldZone` return the diagram as of dispose, and `exportToPng` rejects because it cannot return a Blob. Only in development does it report this with `console.warn`. Whether it is development is decided by `process.env.NODE_ENV`, which the bundler replaces; when loaded without the replacement, it is treated as production
- `Playmaker` does not extend `Disposable` and implements `IDisposable` instead. Extending would expose internal members such as `_register` in the type definitions

## Distribution

- Published to npm as `@yamat47/playmaker` (MIT). The package root is `library/`, and `files` is only `dist/`, so build artifacts are not committed. The LICENSE and the README for npm are placed at the package root, and the same LICENSE that GitHub reads is also placed at the repository root
- The version is `version` in `library/package.json` and the git tag `vX.Y.Z`. Pushing a tag makes `release.yml` run typecheck, lint, the node tests, and build before publishing. Publishing is irreversible, so tags are put only on main commits that have passed CI. Authentication is npm trusted publishing (OIDC), with no token. It is bound to the Actions environment `release`, and the environment is declared by infra-github
- A trusted publisher can only be registered for a package that already exists in the registry, so only 0.1.0 was published with a granular access token, and after that the trusted publisher (this repository, `release.yml`, environment `release`) was registered in the package settings on npmjs.com. Only `npm publish` is allowed; `npm dist-tag` is not (the workflow does not use it). `npm stage publish` is always allowed but not used. The verification before pushing the tag is enough, and there is no value in adding another approval step
- For consumers loading from a CDN (jsDelivr), `jsdelivr` and `unpkg` make the URL without a file name return the ESM. There are no dependencies and the font is bundled in the JS, so 2 URLs from the CDN, the JS and the CSS, are enough
- The output is ESM only. The consumer goes through a bundler, so CJS is not needed, and emitting CJS as well would hand ESM types to a consumer who uses require, making the types and the actual code diverge
- The CSS is loaded separately as `@yamat47/playmaker/styles.css`. `sideEffects` specifies only the CSS
- Type definitions are emitted by vite-plugin-dts and bundled by api-extractor into a single file, `dist/playmaker.d.ts`. The build-only `tsconfig.build.json` is used to fix the root at `src`


## Toolchain

### Development environment and CI

Node and pnpm are not installed on the host; they run inside a Docker container. The entry point for commands is the `Makefile`, and the procedures are in `CLAUDE.md`. In the cloud version of Claude Code, a SessionStart hook sets up the environment instead of Docker (this is also in `CLAUDE.md`).

CI (`.github/workflows/ci.yml`) runs 2 jobs side by side: `verify`, with type checking, lint, tests, and build, and `browser-test`, which runs the browser tests in Chromium. CI runs directly on the runner, because the pnpm store cache of setup-node is faster than running in the container.

Actions are pinned by SHA as a rule, but `yamat47/github-toolkit`, which the author maintains, follows `@main`. SHA pinning of upstream actions and updates through Dependabot are done on the toolkit side. Changes to the toolkit's main enter from the next CI run without going through review, so this exception holds only while the author maintains the toolkit.

### tsconfig

The enabled checks are in `tsconfig.base.json`. `module` is `preserve` because the bundler produces the output. In line with `erasableSyntaxOnly`, Biome's `noParameterProperties` also forbids constructor parameter properties.

`noPropertyAccessFromIndexSignature` is not adopted. Index signature types appear only at the normalization boundary, where values from outside are narrowed to `Record<string, unknown>` with `isRecord`. The values read there are `unknown` and go through a type guard as soon as they are read, so forcing bracket notation finds no errors. Biome's `useLiteralKeys` also suggests changing bracket notation to dot notation. This will be reconsidered if index signatures with typed values come into use outside the boundary.

### Biome

Lint and format are done with Biome, with `recommended` and `--error-on-warnings` so that warnings also fail CI.

- `useImportType` is turned off. tsc finds imports used only as types that lack `type` through `verbatimModuleSyntax`, so the same report would come from 2 places
- Promise handling and switch exhaustiveness are checked with Biome's nursery rules `noFloatingPromises`, `noMisusedPromises`, and `useExhaustiveSwitchCases`, without adding typescript-eslint. This keeps the lint tooling to one tool. Nursery rules may change their names or behavior with Biome updates. When they move to the stable group, move the configuration there. If false positives or misses make them unusable, switch to the type-aware rules of typescript-eslint

### TypeScript 7 workaround

TypeScript 7.0 is a native implementation, and the `typescript` package no longer bundles the JS API (`ts.createProgram` and so on) and `lib.*.d.ts`. Type checking (`tsc -b`) works on TS 7, but generating type definitions needs the JS API.

- vite-plugin-dts (unplugin-dts) reads from the official TypeScript compatibility package `@typescript/typescript6` when `typescript` has no JS API. That is why `@typescript/typescript6` is in devDependencies
- When api-extractor bundles the type definitions, unplugin-dts passes the location of the `typescript` package as the lib location. TS 7 has no `lib.*.d.ts` and cannot resolve `Omit` and the like, so `bundleTypes.invokeOptions.typescriptCompilerFolder` in `vite.config.ts` points it to `@typescript/old` (the typescript@6 that `@typescript/typescript6` depends on)

Two options were rejected. Replacing unplugin-dts's `typescript` with 6 through pnpm overrides removes the compatibility package and the workaround, but the workaround becomes hidden in the pnpm configuration and hard to find. The npm alias from the TS 7.0 announcement (making `typescript` point to `@typescript/typescript6`) makes the name `typescript` disagree with the TS 7 used for type checking, and the compatibility package has no `lib.*.d.ts` either, so the same workaround is needed.

Once unplugin-dts supports the TS 7.1 and later API and the `typescript` package alone can generate and bundle type definitions, remove the `typescriptCompilerFolder` setting and `@typescript/typescript6`.

Editor type checking is changed for the same reason. The TS 7 `typescript` package does not bundle tsserver, so the Dev Container installs the `TypeScriptTeam.native-preview` extension and uses tsgo through `typescript.experimental.useTsgo`. Once VS Code's built-in TypeScript extension uses the TS 7 language server by default, remove the extension and the `useTsgo` setting.

## Testing

Locations, writing style, and the coverage gate are in `.claude/rules/testing.md`. Editing behavior is verified by specification tests with `PlaySession` and `IEditorController` as the boundary, so changing the internal split does not require rewriting the tests. Moving decisions into common is also for running these tests and the coverage gate without the DOM.

## What the library does not have

As stated in PRD 4.1, ease of embedding comes first and richness of expression is narrowed. The following are deliberately not included.

- Visual refinement that matches tactical notation (wavy motion lines, arrowheads per route type). Final visual adjustments resume after trying the library in the commercial software
- Operations that add or remove waypoints one at a time. Redrawing the line gives the same shape
- UI frameworks, external drawing libraries, Shadow DOM, DI containers. Dependencies are limited to manual constructor injection
- Drawing the LOS, zoom and pan, multi-select, copy and paste (PRD 8.1)
